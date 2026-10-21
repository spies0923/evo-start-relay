'use strict';
// Proof-of-concept of the command-authentication scheme proposed in
// CUSTOM_CONTROLLER_DESIGN.md. Pure Node crypto, no network, no hardware.
//
//   phone (Ed25519 private key)  --signed cmd-->  untrusted broker  -->  controller
//   controller verifies: enrolled key, signature, device id, strictly increasing
//   counter, timestamp window, command allow-list, rate limit; then calls the
//   actuator and returns an ack signed with its own device key.
//
// The broker/cloud never holds a key that can forge a command.
const crypto = require('crypto');

const DOMAIN_CMD = 'EVOCMD1\n';
const DOMAIN_ACK = 'EVOACK1\n';
const COMMANDS = new Set(['start', 'stop', 'lock', 'unlock', 'status']);

// Deterministic JSON (sorted keys) so signer and verifier hash the same bytes.
function canonical(o) {
  if (Array.isArray(o)) return `[${o.map(canonical).join(',')}]`;
  if (o && typeof o === 'object') return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  return JSON.stringify(o);
}

const sign = (priv, domain, msg) => crypto.sign(null, Buffer.from(domain + canonical(msg)), priv).toString('base64');
const verify = (pub, domain, msg, sig) => {
  try { return crypto.verify(null, Buffer.from(domain + canonical(msg)), pub, Buffer.from(sig, 'base64')); } catch { return false; }
};

function keyId(pub) {
  return crypto.createHash('sha256').update(pub.export({ type: 'spki', format: 'der' })).digest('hex').slice(0, 16);
}

// Phone side.
function makeClient({ deviceId, privateKey, publicKey, counter = 0, clock = Date.now }) {
  const kid = keyId(publicKey);
  return {
    kid,
    command(cmd) {
      counter += 1;
      const msg = { v: 1, dev: deviceId, kid, ctr: counter, ts: Math.floor(clock() / 1000), cmd };
      return { msg, sig: sign(privateKey, DOMAIN_CMD, msg) };
    },
    verifyAck(ack, devicePublicKey) { return verify(devicePublicKey, DOMAIN_ACK, ack.msg, ack.sig); },
  };
}

// Controller side. `store` stands in for NVS/flash: counters must survive reboot,
// and must be written BEFORE the actuator runs so a crash can't re-enable a replay.
function makeController({
  deviceId, privateKey, actuator, clock = Date.now, store = { counters: {}, keys: {} },
  maxSkewSec = 120, startLimit = { count: 3, windowSec: 3600 },
}) {
  const startLog = [];
  let remoteDisabled = false;

  function ack(req, ok, reason, extra = {}) {
    const msg = { v: 1, dev: deviceId, ctr: req && req.msg ? req.msg.ctr : null, kid: req && req.msg ? req.msg.kid : null, ok, reason, ...extra };
    return { msg, sig: sign(privateKey, DOMAIN_ACK, msg) };
  }

  return {
    store,
    enrol(publicKey) { const kid = keyId(publicKey); store.keys[kid] = publicKey; store.counters[kid] = store.counters[kid] || 0; return kid; },
    revoke(kid) { delete store.keys[kid]; },
    setRemoteDisabled(v) { remoteDisabled = !!v; },

    async handle(req) {
      const m = req && req.msg;
      if (!m || m.v !== 1 || typeof req.sig !== 'string') return ack(req, false, 'malformed');
      const pub = store.keys[m.kid];
      if (!pub) return ack(req, false, 'unknown_key');
      if (!verify(pub, DOMAIN_CMD, m, req.sig)) return ack(req, false, 'bad_signature');
      if (m.dev !== deviceId) return ack(req, false, 'wrong_device');
      if (!Number.isSafeInteger(m.ctr) || m.ctr <= store.counters[m.kid]) return ack(req, false, 'replay');
      const now = Math.floor(clock() / 1000);
      if (!Number.isSafeInteger(m.ts) || Math.abs(now - m.ts) > maxSkewSec) return ack(req, false, 'stale');
      if (!COMMANDS.has(m.cmd)) return ack(req, false, 'unknown_command');

      // Authenticated and fresh: burn the counter first, even if we refuse below.
      store.counters[m.kid] = m.ctr;

      if (remoteDisabled && m.cmd !== 'status') return ack(req, false, 'remote_disabled');
      if (m.cmd === 'start') {
        while (startLog.length && startLog[0] <= now - startLimit.windowSec) startLog.shift();
        if (startLog.length >= startLimit.count) return ack(req, false, 'rate_limited');
        startLog.push(now);
      }
      try {
        const result = await actuator(m.cmd);
        return ack(req, true, 'ok', result === undefined ? {} : { result });
      } catch (e) {
        return ack(req, false, 'actuator_error');
      }
    },
  };
}

module.exports = { canonical, keyId, makeClient, makeController, COMMANDS };
