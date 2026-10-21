'use strict';
// Proof-of-concept of the command-authentication scheme proposed in
// CUSTOM_CONTROLLER_DESIGN.md. Pure Node crypto, no network, no hardware.
//
//   phone (Ed25519 private key)  --signed cmd-->  untrusted broker  -->  controller
//   controller verifies: enrolled key, signature, device id, strictly increasing
//   counter, timestamp window, expiry, command allow-list, maintenance mode,
//   hardware inhibit, rate limit; persists state; then calls the actuator and
//   returns an ack signed with its own device key.
//
// The broker/cloud never holds a key that can forge a command.
const crypto = require('crypto');

const DOMAIN_CMD = 'EVOCMD1\n';
const DOMAIN_ACK = 'EVOACK1\n';
const COMMANDS = new Set(['start', 'stop', 'lock', 'unlock', 'status']);
const ACTUATING = new Set(['start', 'stop', 'lock', 'unlock']);

// Deterministic JSON (sorted keys) so signer and verifier hash the same bytes.
function canonical(o) {
  if (Array.isArray(o)) return `[${o.map(canonical).join(',')}]`;
  if (o && typeof o === 'object') return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  return JSON.stringify(o);
}

const toKey = (k) => (typeof k === 'string' ? crypto.createPublicKey(k) : k);
const sign = (priv, domain, msg) => crypto.sign(null, Buffer.from(domain + canonical(msg)), priv).toString('base64');
const verify = (pub, domain, msg, sig) => {
  try { return crypto.verify(null, Buffer.from(domain + canonical(msg)), toKey(pub), Buffer.from(sig, 'base64')); } catch { return false; }
};

function keyId(pub) {
  return crypto.createHash('sha256').update(toKey(pub).export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
}

// Phone side.
function makeClient({ deviceId, privateKey, publicKey, counter = 0, clock = Date.now, ttlSec = 60 }) {
  const kid = keyId(publicKey);
  return {
    kid,
    command(cmd) {
      counter += 1;
      const ts = Math.floor(clock() / 1000);
      const msg = { v: 1, dev: deviceId, kid, ctr: counter, ts, exp: ts + ttlSec, cmd };
      return { msg, sig: sign(privateKey, DOMAIN_CMD, msg) };
    },
    verifyAck(ack, devicePublicKey) { return verify(devicePublicKey, DOMAIN_ACK, ack.msg, ack.sig); },
  };
}

const emptyStore = () => ({ counters: {}, keys: {}, starts: [], maintenance: false });

// Controller side. `store` stands in for NVS/flash and holds only JSON-safe data
// (public keys as PEM). `persist(store)` must durably commit it; it is called
// AFTER the counter is burned and BEFORE the actuator runs, so a crash can never
// re-enable a replay. If persist throws, nothing is actuated.
function makeController({
  deviceId, privateKey, actuator, clock = Date.now, store = emptyStore(),
  persist = () => {}, audit = () => {}, isInhibited = () => false,
  maxSkewSec = 120, maxTtlSec = 300, startLimit = { count: 3, windowSec: 3600 },
}) {
  for (const [k, v] of Object.entries(emptyStore())) if (store[k] === undefined) store[k] = v;
  const lastAck = {}; // kid -> {ctr, sig, ack}: answers duplicate deliveries without re-actuating

  function ack(req, ok, reason, extra = {}) {
    const m = req && req.msg;
    const msg = { v: 1, dev: deviceId, ts: Math.floor(clock() / 1000), ctr: m ? m.ctr : null, kid: m ? m.kid : null, cmd: m ? m.cmd : null, ok, reason, ...extra };
    const out = { msg, sig: sign(privateKey, DOMAIN_ACK, msg) };
    audit({ ts: msg.ts, kid: msg.kid, ctr: msg.ctr, cmd: msg.cmd, ok, reason });
    return out;
  }

  return {
    store,
    enrol(publicKey) {
      const pem = toKey(publicKey).export({ type: 'spki', format: 'pem' });
      const kid = keyId(pem);
      store.keys[kid] = pem; store.counters[kid] = store.counters[kid] || 0;
      persist(store); audit({ ts: Math.floor(clock() / 1000), kid, event: 'enrol' });
      return kid;
    },
    revoke(kid) { delete store.keys[kid]; persist(store); audit({ ts: Math.floor(clock() / 1000), kid, event: 'revoke' }); },
    setMaintenance(v) { store.maintenance = !!v; persist(store); audit({ ts: Math.floor(clock() / 1000), event: v ? 'maintenance_on' : 'maintenance_off' }); },
    setRemoteDisabled(v) { this.setMaintenance(v); },

    async handle(req) {
      const m = req && req.msg;
      if (!m || m.v !== 1 || typeof req.sig !== 'string') return ack(req, false, 'malformed');
      const pub = store.keys[m.kid];
      if (!pub) return ack(req, false, 'unknown_key');
      if (!verify(pub, DOMAIN_CMD, m, req.sig)) return ack(req, false, 'bad_signature');
      if (m.dev !== deviceId) return ack(req, false, 'wrong_device');
      const prev = lastAck[m.kid];
      if (prev && prev.ctr === m.ctr && prev.sig === req.sig) return prev.ack; // duplicate delivery
      if (!Number.isSafeInteger(m.ctr) || m.ctr <= store.counters[m.kid]) return ack(req, false, 'replay');
      const now = Math.floor(clock() / 1000);
      if (!Number.isSafeInteger(m.ts) || Math.abs(now - m.ts) > maxSkewSec) return ack(req, false, 'stale');
      if (!Number.isSafeInteger(m.exp) || m.exp <= m.ts || m.exp - m.ts > maxTtlSec) return ack(req, false, 'malformed');
      if (now > m.exp) return ack(req, false, 'expired');
      if (!COMMANDS.has(m.cmd)) return ack(req, false, 'unknown_command');

      // Authenticated and fresh: burn the counter first, even if we refuse below.
      store.counters[m.kid] = m.ctr;
      const finish = (a) => { lastAck[m.kid] = { ctr: m.ctr, sig: req.sig, ack: a }; return a; };

      if (ACTUATING.has(m.cmd)) {
        if (store.maintenance) { persistOrFail(); return finish(ack(req, false, 'remote_disabled')); }
        if (isInhibited()) { persistOrFail(); return finish(ack(req, false, 'inhibited')); }
      }
      if (m.cmd === 'start') {
        store.starts = store.starts.filter((t) => t > now - startLimit.windowSec);
        if (store.starts.length >= startLimit.count) { persistOrFail(); return finish(ack(req, false, 'rate_limited')); }
        store.starts.push(now);
      }
      try { persist(store); } catch { return finish(ack(req, false, 'storage_error')); }
      try {
        const result = await actuator(m.cmd);
        return finish(ack(req, true, 'ok', result === undefined ? {} : { result }));
      } catch (e) {
        return finish(ack(req, false, e && e.reason ? e.reason : 'actuator_error'));
      }

      function persistOrFail() { try { persist(store); } catch { /* refusal path: nothing to actuate */ } }
    },
  };
}

module.exports = { canonical, keyId, makeClient, makeController, emptyStore, COMMANDS };
