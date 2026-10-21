'use strict';
// Offline tests for poc/secure-command. The actuator is a recording stub.
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');
const { makeClient, makeController, canonical } = require('../poc/secure-command/protocol');

function rig({ now = 1_800_000_000_000 } = {}) {
  const t = { now };
  const clock = () => t.now;
  const phone = crypto.generateKeyPairSync('ed25519');
  const dev = crypto.generateKeyPairSync('ed25519');
  const calls = [];
  const ctl = makeController({ deviceId: 'car-1', privateKey: dev.privateKey, clock, actuator: async (c) => { calls.push(c); } });
  ctl.enrol(phone.publicKey);
  const cli = makeClient({ deviceId: 'car-1', privateKey: phone.privateKey, publicKey: phone.publicKey, clock });
  return { t, ctl, cli, calls, phone, dev };
}

test('canonical() is key-order independent', () => {
  assert.strictEqual(canonical({ b: 1, a: [2, { d: 3, c: 4 }] }), canonical({ a: [2, { c: 4, d: 3 }], b: 1 }));
});

test('valid command runs once and returns an ack signed by the device', async () => {
  const { ctl, cli, calls, dev } = rig();
  const ack = await ctl.handle(cli.command('start'));
  assert.strictEqual(ack.msg.ok, true);
  assert.deepStrictEqual(calls, ['start']);
  assert.ok(cli.verifyAck(ack, dev.publicKey));
});

test('replaying the same signed frame is rejected', async () => {
  const { ctl, cli, calls } = rig();
  const req = cli.command('start');
  await ctl.handle(req);
  const again = await ctl.handle(JSON.parse(JSON.stringify(req)));
  assert.strictEqual(again.msg.reason, 'replay');
  assert.deepStrictEqual(calls, ['start']);
});

test('an older, never-delivered frame is rejected once a newer one ran', async () => {
  const { ctl, cli } = rig();
  const held = cli.command('unlock');
  await ctl.handle(cli.command('lock'));
  assert.strictEqual((await ctl.handle(held)).msg.reason, 'replay');
});

test('stale timestamp is rejected', async () => {
  const { ctl, cli, t } = rig();
  const req = cli.command('start');
  t.now += 10 * 60 * 1000;
  assert.strictEqual((await ctl.handle(req)).msg.reason, 'stale');
});

test('tampering with any field breaks the signature', async () => {
  const { ctl, cli, calls } = rig();
  const req = cli.command('lock');
  req.msg.cmd = 'unlock';
  assert.strictEqual((await ctl.handle(req)).msg.reason, 'bad_signature');
  assert.deepStrictEqual(calls, []);
});

test('a key that is not enrolled (or was revoked) is rejected', async () => {
  const { ctl, cli } = rig();
  const other = crypto.generateKeyPairSync('ed25519');
  const intruder = makeClient({ deviceId: 'car-1', ...other });
  assert.strictEqual((await ctl.handle(intruder.command('start'))).msg.reason, 'unknown_key');
  ctl.revoke(cli.kid);
  assert.strictEqual((await ctl.handle(cli.command('start'))).msg.reason, 'unknown_key');
});

test('a frame for another vehicle is rejected', async () => {
  const { ctl, phone } = rig();
  const cli2 = makeClient({ deviceId: 'car-2', ...phone });
  assert.strictEqual((await ctl.handle(cli2.command('start'))).msg.reason, 'wrong_device');
});

test('commands outside the allow-list are rejected', async () => {
  const { ctl, cli } = rig();
  assert.strictEqual((await ctl.handle(cli.command('open_hood'))).msg.reason, 'unknown_command');
});

test('remote starts are rate limited per window', async () => {
  const { ctl, cli, calls, t } = rig();
  for (let i = 0; i < 3; i++) assert.strictEqual((await ctl.handle(cli.command('start'))).msg.ok, true);
  assert.strictEqual((await ctl.handle(cli.command('start'))).msg.reason, 'rate_limited');
  t.now += 3601 * 1000;
  assert.strictEqual((await ctl.handle(cli.command('start'))).msg.ok, true);
  assert.strictEqual(calls.length, 4);
});

test('local kill switch blocks everything except status', async () => {
  const { ctl, cli, calls } = rig();
  ctl.setRemoteDisabled(true);
  assert.strictEqual((await ctl.handle(cli.command('start'))).msg.reason, 'remote_disabled');
  assert.strictEqual((await ctl.handle(cli.command('status'))).msg.ok, true);
  assert.deepStrictEqual(calls, ['status']);
});

test('counter survives a controller "reboot" via the persisted store', async () => {
  const { ctl, cli, dev } = rig();
  const req = cli.command('start');
  await ctl.handle(req);
  const rebooted = makeController({ deviceId: 'car-1', privateKey: dev.privateKey, store: ctl.store, clock: () => 1_800_000_000_000, actuator: async () => {} });
  assert.strictEqual((await rebooted.handle(req)).msg.reason, 'replay');
});

test('actuator failure is reported, and the counter is still consumed', async () => {
  const { dev, phone } = rig();
  const ctl = makeController({ deviceId: 'car-1', privateKey: dev.privateKey, clock: () => 1_800_000_000_000, actuator: async () => { throw new Error('no'); } });
  ctl.enrol(phone.publicKey);
  const cli = makeClient({ deviceId: 'car-1', ...phone, clock: () => 1_800_000_000_000 });
  const req = cli.command('start');
  assert.strictEqual((await ctl.handle(req)).msg.reason, 'actuator_error');
  assert.strictEqual((await ctl.handle(req)).msg.reason, 'replay');
});
