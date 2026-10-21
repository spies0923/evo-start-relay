'use strict';
// Offline tests for src/zxy.js. Nothing here contacts a real server: send() is
// exercised against a throwaway TCP server on 127.0.0.1.
const test = require('node:test');
const assert = require('node:assert');
const net = require('net');
const crypto = require('crypto');
const zxy = require('../src/zxy');

const SESS = { uid: 'U1', ssk: 'SSK1', txnkey: 'KEY1', tid: 'T1' };
const split = (frame) => ({ json: frame.slice(0, -40), mac: frame.slice(-40) });
const hmac = (k, d) => crypto.createHmac('sha1', k).update(d, 'utf8').digest('hex').toUpperCase();

test('sha1U matches the demo hash hard-coded in the app (SHA1("888888"))', () => {
  assert.strictEqual(zxy.sha1U('888888'), '1F82C942BEFDA29B6ED487A51DA199F78FCE7F05');
});

test('command frame = JSON + uppercase HMAC-SHA1(txnkey, JSON)', () => {
  const { json, mac } = split(zxy.build('303120', { tid: 'T1' }, SESS));
  assert.strictEqual(mac, hmac('KEY1', json));
  const env = JSON.parse(json);
  assert.strictEqual(env.sys_head.code, '303120');
  assert.deepStrictEqual(env.app_head, { lang: 'en', ssk: 'SSK1', tid: 'T1', uid: 'U1', timezone: '0' });
});

test('login frame blanks ssk/uid and signs with an EMPTY key (integrity only, no auth)', () => {
  const { json, mac } = split(zxy.build('100010', { name: 'n', paswd: 'p' }, SESS));
  assert.strictEqual(mac, hmac('', json));
  const env = JSON.parse(json);
  assert.strictEqual(env.app_head.ssk, '');
  assert.strictEqual(env.app_head.uid, '');
});

test('consumer_ssn changes between frames (the only per-frame freshness field)', () => {
  const a = JSON.parse(split(zxy.build('303120', {}, SESS)).json).sys_head.consumer_ssn;
  const b = JSON.parse(split(zxy.build('303120', {}, SESS)).json).sys_head.consumer_ssn;
  assert.notStrictEqual(a, b);
  assert.match(a, /^U1\d{12}\d{4}$/);
});

test('send() writes an 8-digit byte-length prefix and parses a framed, signed reply', async () => {
  const reply = JSON.stringify({ sys_head: { ret_code: '000000' }, body: { ok: 1 } });
  let got = null;
  const srv = net.createServer((s) => {
    let buf = Buffer.alloc(0);
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      const need = parseInt(buf.slice(0, 8).toString('ascii'), 10);
      if (buf.length - 8 >= need) {
        got = { head: buf.slice(0, 8).toString('ascii'), body: buf.slice(8).toString('utf8') };
        const out = Buffer.from(reply + hmac('', reply), 'utf8');
        s.end(Buffer.concat([Buffer.from(String(out.length).padStart(8, '0')), out]));
      }
    });
  });
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  try {
    const frame = zxy.build('303120', { tid: 'T1', note: 'é' }, SESS);
    const o = await zxy.send({ host: '127.0.0.1', port: srv.address().port }, frame, 2000);
    assert.strictEqual(zxy.retCode(o), '000000');
    assert.deepStrictEqual(o.body, { ok: 1 });
    assert.strictEqual(got.head, String(Buffer.byteLength(frame, 'utf8')).padStart(8, '0'));
    assert.strictEqual(got.body, frame);
  } finally { srv.close(); }
});

test('CMD defaults match LESSONS.md', () => {
  assert.deepStrictEqual(
    { start: zxy.CMD.start, stop: zxy.CMD.stop, lock: zxy.CMD.lock, unlock: zxy.CMD.unlock },
    { start: '303120', stop: '303125', lock: '303110', unlock: '303115' });
});
