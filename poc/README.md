# poc/: offline proofs of concept

Nothing in this directory talks to a vehicle, an EVO-ONE, a serial port or a remote server.

| Path | Kind | Purpose |
|---|---|---|
| `secure-command/protocol.js` | Controller logic (candidate for porting to firmware) | Ed25519-signed commands: counter, timestamp window, expiry, allow-list, rate limit, maintenance mode, hardware inhibit, persisted state, audit hook, duplicate-safe acks |
| `controller/trigger-adapter.js` | Controller logic | Maps start/stop/status onto one isolated output + one status input. Refuses on unknown state (toggle safety). **Holds no Fortin pin, polarity or pulse values.** |
| `controller/controller.js` | Controller logic | Boot lifecycle: release output, load NVS, wait for trusted clock, then accept |
| `bench-sim/mocks.js` | **Mocks only** | Generic output stage, toggle-style starter, NVS and LTE link stand-ins. **Not a model of Fortin firmware.** |

Tests: `npm test` (`test/secure-command.test.js`, `test/bench-sim.test.js`). Each mapping to
BENCH_TEST_PLAN.md is in the test names (SIL-xx).
