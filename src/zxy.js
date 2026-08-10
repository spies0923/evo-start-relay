'use strict';
// Minimal client for the EvoStart / "hyll" (ZXY268) telematics cloud used by
// rebadged Fortin EVO-START LTE remote starters and many similar GPS/remote-start
// modules. Reverse-engineered from the Android app (com.fortin.evostart1).
//
// Wire protocol (plaintext TCP, no TLS):
//   frame = 8 ASCII digits (UTF-8 byte length of body) + body
//   body  = {sys_head, app_head, body} JSON  +  HMAC-SHA1(txnkey, json) UPPER (suffix)
//   login (code 100010): app_head ssk/uid blank, HMAC key = "" (empty)
//   command (30xxxx):     app_head carries ssk/uid/tid, HMAC key = session txnkey
//
// Everything install-specific (server IP/host, command codes, tid) comes from env /
// the caller — see README "Finding your server & command codes".
const net = require('net');
const crypto = require('crypto');

const DISTRIBUTE = process.env.ZXY_DISTRIBUTE || 'evostart';
const AVER = process.env.ZXY_APPVER || '1.5.38';

// Transaction codes. These are the values observed for one EVO-START install; the
// exact control codes can vary by vehicle/module wiring (e.g. stop was 303125 here,
// but the base is 303124). Capture your own with `adb logcat` — see README.
const CMD = {
  start: process.env.ZXY_CODE_START || '303120',
  stop: process.env.ZXY_CODE_STOP || '303125',
  lock: process.env.ZXY_CODE_LOCK || '303110',
  unlock: process.env.ZXY_CODE_UNLOCK || '303115',
  trunk: process.env.ZXY_CODE_TRUNK || '303130',
  find: process.env.ZXY_CODE_FIND || '303101',
};

let _seq = 0;
const sha1U = (s) => crypto.createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();
const hmacSha1 = (key, data) => crypto.createHmac('sha1', key).update(data, 'utf8').digest('hex').toUpperCase();

function ssn(uid) {
  const t = new Date().toISOString().replace(/[-:T]/g, '').slice(2, 14);
  _seq = (_seq + 1) % 10000;
  return `${uid || ''}${t}${String(_seq).padStart(4, '0')}`;
}

function build(code, body, sess) {
  sess = sess || {};
  const d = new Date();
  const isLogin = code.startsWith('10001') || code === '100021' || code.startsWith('1020') || code.startsWith('1090');
  const uid = isLogin ? '' : (sess.uid || '');
  const ssk = isLogin ? '' : (sess.ssk || '');
  const txnkey = isLogin ? '' : (sess.txnkey || '');
  const env = {
    sys_head: {
      ver: '1.0', code, consumer_ssn: ssn(sess.uid),
      trans_date: d.toISOString().slice(0, 10).replace(/-/g, ''),
      trans_time: d.toISOString().slice(11, 19).replace(/:/g, ''),
      chnl: 'android', build_make: 'Google', build_model: 'Pixel', build_release: '14',
      distribute: DISTRIBUTE, aver: AVER, caver: '', skin: '', csver: '', lver: '',
    },
    app_head: { lang: 'en', ssk, tid: sess.tid || '', uid, timezone: '0' },
    body: body || {},
  };
  const json = JSON.stringify(env);
  return json + hmacSha1(txnkey, json);
}

function send(server, bodyStr, timeoutMs = 15000) {
  const raw = Buffer.from(bodyStr, 'utf8');
  const frame = Buffer.concat([Buffer.from(String(raw.length).padStart(8, '0'), 'ascii'), raw]);
  return new Promise((resolve, reject) => {
    const s = net.connect({ host: server.host, port: server.port });
    let buf = Buffer.alloc(0), need = null, done = false;
    const fin = (fn, a) => { if (!done) { done = true; s.destroy(); fn(a); } };
    s.setTimeout(timeoutMs, () => fin(reject, new Error('timeout')));
    s.on('error', (e) => fin(reject, e));
    s.on('connect', () => s.write(frame));
    s.on('data', (d) => {
      buf = Buffer.concat([buf, d]);
      if (need === null && buf.length >= 8) {
        const head = buf.slice(0, 8).toString('ascii');
        if (!/^\d{8}$/.test(head)) return fin(resolve, parse(buf.toString('utf8')));
        need = parseInt(head, 10); buf = buf.slice(8);
      }
      if (need !== null && buf.length >= need) fin(resolve, parse(buf.slice(0, need).toString('utf8')));
    });
    s.on('close', () => { if (!done && buf.length) fin(resolve, parse(buf.toString('utf8'))); });
  });
}

function parse(txt) {
  let t = txt;
  if (t.length > 40 && /^[0-9A-Fa-f]{40}$/.test(t.slice(-40))) t = t.slice(0, -40);
  try { return JSON.parse(t); } catch { return { _raw: txt.slice(0, 300) }; }
}

const retCode = (o) => (o && o.sys_head && o.sys_head.ret_code) || null;

module.exports = { CMD, sha1U, build, send, retCode };
