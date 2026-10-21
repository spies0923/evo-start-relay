'use strict';
// Controller lifecycle around the secure-command protocol and the trigger adapter.
// Mirrors what the ESP32 firmware must do:
//   boot: force output released -> load NVS -> wait for a trusted clock -> ready
//   ready: verify (poc/secure-command) -> persist -> actuate (trigger adapter)
// Until ready, every frame is refused and nothing can actuate.
const { makeController } = require('../secure-command/protocol');
const { makeTriggerAdapter } = require('./trigger-adapter');

function makeVehicleController({
  deviceId, privateKey, nvs, output, status, clock = Date.now, clockSynced = () => true,
  isInhibited = () => false, audit = () => {}, adapter = {}, limits = {},
}) {
  let state = 'off', proto = null;

  return {
    get state() { return state; },
    get store() { return proto && proto.store; },

    boot() {
      state = 'booting';
      output.init(); // released before anything else runs
      const store = nvs.load() || undefined;
      const trig = makeTriggerAdapter({ output, status, ...adapter });
      proto = makeController({
        deviceId, privateKey, clock, store, isInhibited, audit,
        persist: (s) => nvs.commit(s),
        actuator: (cmd) => trig.request(cmd),
        ...limits,
      });
      state = clockSynced() ? 'ready' : 'waiting_clock';
      audit({ ts: Math.floor(clock() / 1000), event: `boot:${state}` });
      return state;
    },

    clockAcquired() { if (state === 'waiting_clock') state = 'ready'; },

    enrol(pub) { return proto.enrol(pub); },
    revoke(kid) { return proto.revoke(kid); },
    setMaintenance(v) { return proto.setMaintenance(v); },

    async handle(req) {
      if (state !== 'ready') return { msg: { ok: false, reason: 'not_ready' } };
      return proto.handle(req);
    },
  };
}

module.exports = { makeVehicleController };
