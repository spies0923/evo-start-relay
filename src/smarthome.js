'use strict';
// Google Smart Home "cloud-to-cloud" bridge: minimal OAuth2 (auth-code) account
// linking + SYNC/QUERY/EXECUTE fulfillment. Single-user/personal; account linking
// is gated by GH_LINK_SECRET, tokens persisted to disk.
//
// Devices are modeled as plain OnOff SWITCHes on purpose — see LESSONS.md
// ("unlock is blocked in automations", "one bad device fails the whole SYNC").
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const AGENT_USER_ID = 'evo-user';
const TOKENS_FILE = process.env.GH_TOKENS_FILE || path.join(__dirname, '..', 'gh-tokens.json');

// id -> {name, onAction, offAction}. Car: on=start/off=stop. Car Lock: on=lock/off=unlock.
const DEVICES = {
  car: {
    type: 'action.devices.types.SWITCH', traits: ['action.devices.traits.OnOff'],
    name: { name: 'Car', nicknames: ['my car', 'the car'] },
    onAction: 'start', offAction: 'stop', state: false,
  },
  car_lock: {
    type: 'action.devices.types.SWITCH', traits: ['action.devices.traits.OnOff'],
    name: { name: 'Car Lock', nicknames: ['car doors', 'the doors'] },
    onAction: 'lock', offAction: 'unlock', state: true,
  },
};

function loadTokens() { try { return JSON.parse(fs.readFileSync(TOKENS_FILE, 'utf8')); } catch { return { access: {}, refresh: {}, codes: {} }; } }
function saveTokens(t) { try { fs.writeFileSync(TOKENS_FILE, JSON.stringify(t)); fs.chmodSync(TOKENS_FILE, 0o600); } catch (e) { console.error('token save', e.message); } }
let TOK = loadTokens();
const rnd = () => crypto.randomBytes(24).toString('base64url');
const now = () => Date.now();

function bearerValid(req) {
  const m = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return false;
  for (const a in TOK.access) if (TOK.access[a].exp < now()) delete TOK.access[a];
  const e = TOK.access[m[1]];
  return !!(e && e.exp > now());
}

function htmlLogin(q, err) {
  return `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<body style="font-family:system-ui;max-width:24rem;margin:3rem auto;padding:0 1rem">
<h2>Link relay to Google</h2>${err ? `<p style="color:#c00">${err}</p>` : ''}
<form method="POST">
<input type=hidden name=client_id value="${q.client_id || ''}">
<input type=hidden name=redirect_uri value="${q.redirect_uri || ''}">
<input type=hidden name=state value="${q.state || ''}">
<p><input name=secret type=password placeholder="Link secret" autofocus style="width:100%;padding:.6rem;font-size:1rem"></p>
<button style="width:100%;padding:.6rem;font-size:1rem">Authorize</button></form></body>`;
}

function authorize(req, res, url, form, cfg) {
  const q = req.method === 'POST' ? form : Object.fromEntries(url.searchParams);
  if (q.client_id !== cfg.clientId) { res.writeHead(400).end('bad client_id'); return; }
  if (!/^https:\/\/oauth-redirect(-sandbox)?\.googleusercontent\.com\//.test(q.redirect_uri || '')) { res.writeHead(400).end('bad redirect_uri'); return; }
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(htmlLogin(q)); return; }
  const a = Buffer.from(q.secret || ''), b = Buffer.from(cfg.linkSecret);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { res.writeHead(200, { 'content-type': 'text/html' }); res.end(htmlLogin(q, 'Wrong secret')); return; }
  const code = rnd();
  TOK.codes[code] = { exp: now() + 6e5, redirect_uri: q.redirect_uri }; saveTokens(TOK);
  const to = new URL(q.redirect_uri); to.searchParams.set('code', code); if (q.state) to.searchParams.set('state', q.state);
  res.writeHead(302, { location: to.toString() }); res.end();
}

function token(req, res, form, cfg) {
  const send = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (form.client_id !== cfg.clientId || form.client_secret !== cfg.clientSecret) return send({ error: 'invalid_client' }, 400);
  if (form.grant_type === 'authorization_code') {
    const c = TOK.codes[form.code]; if (!c || c.exp < now()) return send({ error: 'invalid_grant' }, 400);
    delete TOK.codes[form.code];
    const access = rnd(), refresh = rnd();
    TOK.access[access] = { exp: now() + 36e5 }; TOK.refresh[refresh] = 1; saveTokens(TOK);
    return send({ token_type: 'Bearer', access_token: access, refresh_token: refresh, expires_in: 3600 });
  }
  if (form.grant_type === 'refresh_token') {
    if (!TOK.refresh[form.refresh_token]) return send({ error: 'invalid_grant' }, 400);
    const access = rnd(); TOK.access[access] = { exp: now() + 36e5 }; saveTokens(TOK);
    return send({ token_type: 'Bearer', access_token: access, expires_in: 3600 });
  }
  return send({ error: 'unsupported_grant_type' }, 400);
}

async function fulfillment(req, res, body, ctx) {
  const send = (o) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (!bearerValid(req)) { res.writeHead(401).end('{"error":"unauthorized"}'); return; }
  let msg; try { msg = JSON.parse(body); } catch { res.writeHead(400).end('bad json'); return; }
  const requestId = msg.requestId;
  const intent = msg.inputs && msg.inputs[0] && msg.inputs[0].intent;

  if (intent === 'action.devices.SYNC') {
    return send({ requestId, payload: { agentUserId: AGENT_USER_ID, devices: Object.entries(DEVICES).map(([id, d]) => ({
      id, type: d.type, traits: d.traits, name: d.name, willReportState: false,
      deviceInfo: { manufacturer: 'evo-start-relay', model: 'EVO-START' },
    })) } });
  }
  if (intent === 'action.devices.QUERY') {
    const devices = {};
    for (const q of msg.inputs[0].payload.devices) devices[q.id] = DEVICES[q.id]
      ? { online: true, status: 'SUCCESS', on: DEVICES[q.id].state } : { online: false, status: 'ERROR' };
    return send({ requestId, payload: { devices } });
  }
  if (intent === 'action.devices.EXECUTE') {
    const results = [];
    for (const cmd of msg.inputs[0].payload.commands) for (const dev of cmd.devices) {
      const d = DEVICES[dev.id];
      if (!d) { results.push({ ids: [dev.id], status: 'ERROR', errorCode: 'deviceNotFound' }); continue; }
      try {
        const states = { online: true };
        for (const ex of cmd.execution) if (ex.command === 'action.devices.commands.OnOff') {
          const on = !!ex.params.on;
          const rc = await ctx.doCommand(on ? d.onAction : d.offAction);
          console.log(new Date().toISOString(), 'EXECUTE', dev.id, on ? d.onAction : d.offAction, '->', rc);
          if (rc !== '000000') throw new Error('relay ' + rc);
          d.state = on; states.on = on;
        }
        results.push({ ids: [dev.id], status: 'SUCCESS', states });
      } catch (e) { console.error('EXECUTE', dev.id, e.message); results.push({ ids: [dev.id], status: 'ERROR', errorCode: 'transientError' }); }
    }
    return send({ requestId, payload: { commands: results } });
  }
  if (intent === 'action.devices.DISCONNECT') return send({});
  return send({ requestId, payload: { errorCode: 'notSupported' } });
}

module.exports = { authorize, token, fulfillment, DEVICES };
