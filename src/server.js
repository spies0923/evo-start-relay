'use strict';
// EvoStart -> HTTP relay. Persistent ZXY268 session + token-gated /cmd endpoints +
// a self-hosted Google Smart Home cloud-to-cloud integration. Zero npm deps.
//
// Endpoints:
//   /cmd/<start|stop|lock|unlock|trunk|find|status>?token=RELAY_SECRET   (GET or POST)
//   /oauth/authorize  /oauth/token  /smarthome   (Google account-linking + fulfillment)
//   /health
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const zxy = require('./zxy');
const sh = require('./smarthome');

// minimal .env loader (no bash sourcing, no dep); real env wins
(() => { try {
  for (const line of fs.readFileSync(path.join(__dirname, '..', '.env'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/\r$/, '');
  }
} catch { /* rely on real env */ } })();

const CFG = {
  user: process.env.EVOSTART_USER, pass: process.env.EVOSTART_PASS, tid: process.env.EVOSTART_TID,
  secret: process.env.RELAY_SECRET,
  server: { host: process.env.ZXY_HOST, port: +(process.env.ZXY_PORT || 3050) },
  port: +(process.env.RELAY_PORT || 3300),
};
for (const [k, name] of [['user', 'EVOSTART_USER'], ['pass', 'EVOSTART_PASS'], ['tid', 'EVOSTART_TID'], ['secret', 'RELAY_SECRET']])
  if (!CFG[k]) { console.error('FATAL: missing env', name); process.exit(1); }
if (!CFG.server.host) { console.error('FATAL: missing env ZXY_HOST (your account server — see README)'); process.exit(1); }
const GH = { clientId: process.env.GH_CLIENT_ID || 'evo-google', clientSecret: process.env.GH_CLIENT_SECRET || CFG.secret, linkSecret: process.env.GH_LINK_SECRET || CFG.secret };

let session = null, chain = Promise.resolve();
const log = (...a) => console.log(new Date().toISOString(), ...a);
const serialize = (fn) => { const r = chain.then(fn, fn); chain = r.catch(() => {}); return r; };

async function login() {
  const o = await zxy.send(CFG.server, zxy.build('100010', { name: CFG.user, paswd: zxy.sha1U(CFG.pass), pushchnl: 'gcm', pushid: '', timezone: '0' }, {}));
  if (zxy.retCode(o) !== '000000' || !o.body || !o.body.ssk) throw new Error('login failed: ' + JSON.stringify(o.sys_head || o));
  session = { uid: o.body.uid, ssk: o.body.ssk, txnkey: o.body.txnkey, tid: CFG.tid };
  log('login ok uid', session.uid); return session;
}
async function tx(code, body) {
  if (!session) await login();
  let o = await zxy.send(CFG.server, zxy.build(code, body, session));
  const rc = zxy.retCode(o);
  if (rc && /^SC00(0[12]|08)|^SE0002|LOGIN/i.test(rc)) { log('session stale (', rc, ') -> relogin'); await login(); o = await zxy.send(CFG.server, zxy.build(code, body, session)); }
  return o;
}
const doCommand = (action) => serialize(() => tx(zxy.CMD[action], { tid: CFG.tid }).then((o) => zxy.retCode(o)));
const doStatus = () => serialize(() => tx('203100', { tid: CFG.tid }));

setInterval(() => serialize(async () => { try { const o = await tx('202110', {}); if (zxy.retCode(o) !== '000000') log('keepalive rc', zxy.retCode(o)); } catch (e) { log('keepalive err', e.message); } }), 2 * 60 * 1000).unref();

function authed(req, url) {
  const tok = url.searchParams.get('token') || (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-relay-token'] || '';
  const a = Buffer.from(tok), b = Buffer.from(CFG.secret);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const readBody = (req) => new Promise((r) => { let b = ''; req.on('data', (c) => { b += c; if (b.length > 1e6) req.destroy(); }); req.on('end', () => r(b)); });

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const json = (c, o) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  try {
    if (url.pathname === '/health') return json(200, { ok: true, loggedIn: !!session });
    if (url.pathname === '/oauth/authorize') return sh.authorize(req, res, url, req.method === 'POST' ? Object.fromEntries(new URLSearchParams(await readBody(req))) : {}, GH);
    if (url.pathname === '/oauth/token' && req.method === 'POST') return sh.token(req, res, Object.fromEntries(new URLSearchParams(await readBody(req))), GH);
    if (url.pathname === '/smarthome' && req.method === 'POST') return sh.fulfillment(req, res, await readBody(req), { doCommand });
    const m = url.pathname.match(/^\/cmd\/(start|stop|lock|unlock|trunk|find|status)$/);
    if (!m) return json(404, { ok: false, error: 'not found' });
    if (!authed(req, url)) return json(403, { ok: false, error: 'bad token' });
    if (m[1] === 'status') { const o = await doStatus(); return json(zxy.retCode(o) === '000000' ? 200 : 502, { ok: zxy.retCode(o) === '000000', body: o.body || null }); }
    const rc = await doCommand(m[1]); const ok = rc === '000000';
    log(m[1], '->', rc); return json(ok ? 200 : 502, { ok, action: m[1], ret_code: rc });
  } catch (e) { log('ERR', e.message); return json(500, { ok: false, error: e.message }); }
});
server.listen(CFG.port, '127.0.0.1', () => log(`relay on 127.0.0.1:${CFG.port} -> ${CFG.server.host}:${CFG.server.port}`));
