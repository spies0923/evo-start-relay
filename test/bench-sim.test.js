'use strict';
// BENCH_TEST_PLAN.md §4 (software-in-the-loop). Mocks only: no serial port, no GPIO,
// no network, no vehicle. Test names carry the plan's case numbers (SIL-xx).
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { makeVehicleController } = require('../poc/controller/controller');
const { makeClient } = require('../poc/secure-command/protocol');
const { MockOutput, MockRemoteStarter, MockNvs, MockLink } = require('../poc/bench-sim/mocks');

const T0 = 1_800_000_000_000;

function bench(opts = {}) {
  const t = { now: T0 };
  const clock = () => t.now;
  const phone = crypto.generateKeyPairSync('ed25519');
  const dev = crypto.generateKeyPairSync('ed25519');
  const starter = new MockRemoteStarter();
  const output = new MockOutput({ onPulse: () => starter.onPulse() });
  const nvs = opts.nvs || new MockNvs();
  const audit = [];
  const mk = () => makeVehicleController({
    deviceId: 'car-1', privateKey: dev.privateKey, nvs, output, status: starter.statusSource(), clock,
    clockSynced: opts.clockSynced || (() => true), isInhibited: opts.isInhibited, audit: (e) => audit.push(e),
    adapter: { pulseMs: 800, sleep: async () => { t.now += 500; }, now: clock, confirmTimeoutMs: 5000 },
  });
  const ctl = mk();
  ctl.boot();
  ctl.enrol(phone.publicKey);
  const cli = makeClient({ deviceId: 'car-1', privateKey: phone.privateKey, publicKey: phone.publicKey, clock });
  const link = new MockLink((f) => ctl.handle(f));
  return { t, ctl, cli, starter, output, nvs, link, audit, mk, phone, dev };
}

test('SIL-01 start command accepted: one pulse, starter running, confirmed', async () => {
  const b = bench();
  const [ack] = await b.link.publish(b.cli.command('start'));
  assert.strictEqual(ack.msg.ok, true);
  assert.deepStrictEqual(ack.msg.result, { remoteStart: true, changed: true, confirmed: true });
  assert.strictEqual(b.output.pulses.length, 1);
  assert.strictEqual(b.starter.running, true);
});

test('SIL-02 stop command accepted', async () => {
  const b = bench();
  await b.link.publish(b.cli.command('start'));
  const [ack] = await b.link.publish(b.cli.command('stop'));
  assert.strictEqual(ack.msg.ok, true);
  assert.strictEqual(b.starter.running, false);
  assert.strictEqual(b.output.pulses.length, 2);
});

test('SIL-02b toggle safety: start while running / stop while off never pulses', async () => {
  const b = bench();
  const [stop] = await b.link.publish(b.cli.command('stop'));
  assert.deepStrictEqual(stop.msg.result, { remoteStart: false, changed: false });
  await b.link.publish(b.cli.command('start'));
  const [again] = await b.link.publish(b.cli.command('start'));
  assert.deepStrictEqual(again.msg.result, { remoteStart: true, changed: false });
  assert.strictEqual(b.output.pulses.length, 1);
  assert.strictEqual(b.starter.running, true);
});

test('SIL-02c unknown engine state refuses start/stop (toggle could do the opposite)', async () => {
  const b = bench();
  b.starter.statusWired = false;
  const [ack] = await b.link.publish(b.cli.command('start'));
  assert.strictEqual(ack.msg.reason, 'status_unknown');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-02d starter refuses (inhibited): pulse sent, ack reports unconfirmed', async () => {
  const b = bench();
  b.starter.inhibited = true;
  const [ack] = await b.link.publish(b.cli.command('start'));
  assert.strictEqual(ack.msg.ok, true);
  assert.strictEqual(ack.msg.result.confirmed, false);
  assert.strictEqual(b.starter.running, false);
});

test('SIL-03 invalid commands rejected: unknown verb, unsupported verb, tampered frame', async () => {
  const b = bench();
  assert.strictEqual((await b.link.publish(b.cli.command('open_hood')))[0].msg.reason, 'unknown_command');
  assert.strictEqual((await b.link.publish(b.cli.command('unlock')))[0].msg.reason, 'unsupported');
  const f = b.cli.command('stop'); f.msg.cmd = 'start';
  assert.strictEqual((await b.link.publish(f))[0].msg.reason, 'bad_signature');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-04 replayed command rejected', async () => {
  const b = bench();
  const captured = b.cli.command('start');
  await b.link.publish(captured);
  await b.link.publish(b.cli.command('stop'));
  assert.strictEqual((await b.link.publish(captured))[0].msg.reason, 'replay');
  assert.strictEqual(b.output.pulses.length, 2);
});

test('SIL-05 expired command rejected', async () => {
  const b = bench();
  const f = b.cli.command('start');
  b.t.now += 61 * 1000;
  assert.strictEqual((await b.link.publish(f))[0].msg.reason, 'expired');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-06 unknown key and wrong device rejected', async () => {
  const b = bench();
  const stranger = crypto.generateKeyPairSync('ed25519');
  const s = makeClient({ deviceId: 'car-1', ...stranger, clock: () => b.t.now });
  assert.strictEqual((await b.link.publish(s.command('start')))[0].msg.reason, 'unknown_key');
  const other = makeClient({ deviceId: 'car-2', ...b.phone, clock: () => b.t.now, counter: 100 });
  assert.strictEqual((await b.link.publish(other.command('start')))[0].msg.reason, 'wrong_device');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-07/08 link down: nothing delivered; reconnect: stale queued frame expires, fresh one works', async () => {
  const b = bench();
  b.link.down();
  assert.deepStrictEqual(await b.link.publish(b.cli.command('start')), []);
  assert.strictEqual(b.output.pulses.length, 0);
  b.t.now += 5 * 60 * 1000; // 5 min outage
  const flushed = await b.link.up();
  assert.strictEqual(flushed[0].msg.reason, 'stale');
  assert.strictEqual(b.output.pulses.length, 0);
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.ok, true);
});

test('SIL-08b short outage: queued frame still inside its TTL is executed once on reconnect', async () => {
  const b = bench();
  b.link.down();
  await b.link.publish(b.cli.command('start'));
  b.t.now += 20 * 1000;
  const flushed = await b.link.up();
  assert.strictEqual(flushed[0].msg.ok, true);
  assert.strictEqual(b.output.pulses.length, 1);
});

test('SIL-09 power interruption: flash write failure blocks actuation', async () => {
  const b = bench();
  b.nvs.failCommit = true;
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.reason, 'storage_error');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-09b pulse width is capped by the hardware limit even if firmware asks for more', async () => {
  const b = bench();
  await b.output.pulse(60_000);
  assert.deepStrictEqual(b.output.pulses, [b.output.maxPulseMs]);
});

test('SIL-10 watchdog reset: output released on boot, counters and keys restored, replay still rejected', async () => {
  const b = bench();
  const f = b.cli.command('start');
  await b.link.publish(f);
  b.output.asserted = true; // simulate a reset with the line stuck asserted
  const ctl2 = b.mk();
  ctl2.boot();
  assert.strictEqual(b.output.asserted, false);
  b.link.setHandler((x) => ctl2.handle(x));
  assert.strictEqual((await b.link.publish(f))[0].msg.reason, 'replay');
  assert.strictEqual((await b.link.publish(b.cli.command('stop')))[0].msg.ok, true);
});

test('SIL-11 duplicate delivery (MQTT QoS 1) actuates exactly once', async () => {
  const b = bench();
  b.link.duplicateNext = true;
  const acks = await b.link.publish(b.cli.command('start'));
  assert.strictEqual(acks.length, 2);
  assert.deepStrictEqual(acks[0], acks[1]);
  assert.strictEqual(b.output.pulses.length, 1);
});

test('SIL-12 reboot during a pending request: at-most-once, then a new command works', async () => {
  const b = bench();
  const f = b.cli.command('start');
  b.output.crashNext = true; // power lost after persist, before the pulse
  await b.link.publish(f);
  assert.strictEqual(b.output.pulses.length, 0);
  const ctl2 = b.mk(); ctl2.boot();
  b.link.setHandler((x) => ctl2.handle(x));
  assert.strictEqual((await b.link.publish(f))[0].msg.reason, 'replay');
  assert.strictEqual(b.output.pulses.length, 0);
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.ok, true);
  assert.strictEqual(b.output.pulses.length, 1);
});

test('SIL-13 maintenance mode blocks start/stop, allows status, survives reboot', async () => {
  const b = bench();
  b.ctl.setMaintenance(true);
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.reason, 'remote_disabled');
  assert.strictEqual((await b.link.publish(b.cli.command('status')))[0].msg.ok, true);
  const ctl2 = b.mk(); ctl2.boot();
  b.link.setHandler((x) => ctl2.handle(x));
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.reason, 'remote_disabled');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-13b hardware kill switch blocks actuation', async () => {
  const b = bench({ isInhibited: () => true });
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.reason, 'inhibited');
  assert.strictEqual(b.output.pulses.length, 0);
});

test('SIL-14 no activation during startup: refused before boot and while clock is unsynced', async () => {
  let synced = false;
  const b = bench({ clockSynced: () => synced });
  assert.strictEqual(b.ctl.state, 'waiting_clock');
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.reason, 'not_ready');
  const cold = b.mk();
  assert.strictEqual((await cold.handle(b.cli.command('start'))).msg.reason, 'not_ready');
  synced = true; b.ctl.clockAcquired();
  assert.strictEqual(b.output.pulses.length, 0);
  assert.strictEqual((await b.link.publish(b.cli.command('start')))[0].msg.ok, true);
});

test('SIL-15 no activation on any communication or authentication failure', async () => {
  const b = bench();
  const frames = [
    null, {}, { msg: { v: 2 }, sig: 'x' },
    (() => { const f = b.cli.command('start'); f.sig = Buffer.alloc(64).toString('base64'); return f; })(),
    (() => { const f = b.cli.command('start'); f.msg.kid = 'ffffffffffffffff'; return f; })(),
    (() => { const f = b.cli.command('start'); delete f.msg.exp; return f; })(),
  ];
  for (const f of frames) assert.strictEqual((await b.ctl.handle(f)).msg.ok, false);
  assert.strictEqual(b.output.pulses.length, 0);
  assert.ok(b.audit.filter((e) => e.ok === false).length >= frames.length);
});
