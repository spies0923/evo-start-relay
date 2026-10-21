'use strict';
// Maps authenticated start/stop/status commands onto ONE isolated discrete output
// and ONE status input. Hardware-independent: `output` and `status` are injected
// (mocks in poc/bench-sim/, real GPIO drivers later).
//
// Deliberately generic. Nothing here encodes a Fortin pin, polarity, voltage,
// pulse length or serial message: those are UNVERIFIED (see
// EVO_ONE_INTERFACE_RESEARCH.md) and must come from Fortin documentation.
//
// Safety model for a toggle-style input ("start/stop on trigger"):
//   - a pulse while the engine state is unknown could start OR stop -> refuse;
//   - start while already running / stop while not running -> no pulse;
//   - after a pulse, confirm the expected state change via the status input.
const refuse = (reason) => Object.assign(new Error(reason), { reason });

function makeTriggerAdapter({
  output, status, pulseMs, confirmTimeoutMs = 30000, pollMs = 500,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)), now = Date.now,
  allowBlindToggle = false,
}) {
  if (!Number.isInteger(pulseMs) || pulseMs <= 0) throw new Error('pulseMs must be set from Fortin documentation');

  async function waitFor(want) {
    const until = now() + confirmTimeoutMs;
    for (;;) {
      if (status.read() === want) return true;
      if (now() >= until) return false;
      await sleep(pollMs);
    }
  }

  return {
    async request(cmd) {
      if (cmd === 'status') return { remoteStart: status.read() };
      if (cmd !== 'start' && cmd !== 'stop') throw refuse('unsupported');
      const running = status.read();
      if (running === null && !allowBlindToggle) throw refuse('status_unknown');
      const want = cmd === 'start';
      if (running === want) return { remoteStart: running, changed: false };
      await output.pulse(pulseMs);
      const confirmed = await waitFor(want);
      return { remoteStart: status.read(), changed: true, confirmed };
    },
  };
}

module.exports = { makeTriggerAdapter, refuse };
