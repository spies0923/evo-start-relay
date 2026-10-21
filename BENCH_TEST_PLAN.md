# Bench test plan

**Rule zero:** no test in this plan connects to, or sends a command to, a vehicle or an EVO-ONE.
The "EVO-ONE" is always a generic stand-in (`poc/bench-sim/mocks.js`, or a second MCU running the
same model). It is **not** a model of Fortin firmware.

## 1. Levels

| Level | What | Where |
|---|---|---|
| **SIL**: software in the loop | Protocol + controller lifecycle + trigger adapter against mocks | `npm test` (`test/bench-sim.test.js`, `test/secure-command.test.js`) |
| **HIL-B**: hardware in the loop, bench | Real ESP32 + modem + output stage + stand-in MCU, bench PSU | ESP32_INTERFACE_DESIGN.md §2 |
| **VEH** | Vehicle integration | **Not in this plan.** Only after PHASE2_DECISION.md gates clear. |

## 2. Safety precautions (HIL-B)

- Current-limited bench supply. No car battery on the bench.
- The output contact drives an LED/stand-in only.
- Logic analyser on ARM, FIRE, contact and status for every run.
- Each test records: build hash, configuration, analyser capture and audit log.

## 3. Pass criteria common to all tests

- **No unintended activation:** the contact closes **only** for an accepted, authenticated, fresh
  start/stop that changes state. Each closure is ≤ `t_max`.
- Every decision appears in the audit log with key id, counter and reason.
- Refusals are signed acks with a reason code. There is never silence on an authenticated frame.

## 4. Test cases

**SIL** = automated now. **HIL** = same scenario repeated on bench hardware.

| ID | Case | SIL test | HIL procedure | Expected |
|---|---|---|---|---|
| 01 | Start accepted | SIL-01 | Send a signed start | One pulse; stand-in running; ack `ok`, `confirmed:true` |
| 02 | Stop accepted | SIL-02 | Send a signed stop | One pulse; stand-in stopped |
| 02b | Toggle safety | SIL-02b | Start while running, stop while stopped | **No pulse**; ack `changed:false` |
| 02c | Unknown state | SIL-02c | Disconnect the status line | Refused `status_unknown`; no pulse |
| 02d | Starter refuses | SIL-02d | Stand-in inhibited | One pulse; ack `confirmed:false` |
| 03 | Invalid command | SIL-03 | Unknown verb, unsupported verb, tampered field | Refused; no pulse |
| 04 | Replay | SIL-04 | Re-send a captured older frame | `replay`; no pulse |
| 05 | Expired | SIL-05 | Hold a frame past `exp` | `expired`; no pulse |
| 06 | Unknown device or key | SIL-06 | Un-enrolled key; frame for another device | `unknown_key` / `wrong_device` |
| 07 | Network loss | SIL-07/08 | Pull the antenna / block the broker | Nothing actuates; reconnect logic runs |
| 08 | LTE reconnect | SIL-07/08, SIL-08b | Restore the network after 20 s and after 5 min | Within TTL: executes once. Past TTL: `stale`/`expired`. |
| 09 | Power interruption | SIL-09, SIL-09b | Cut the bench supply at random points, 100× (scripted relay) | No closure at power-up; no closure > `t_max`; NVS intact |
| 10 | Watchdog reset | SIL-10 | Force a task-WDT reset mid-idle and mid-command | Output released at boot; counters kept; replay rejected |
| 11 | Duplicate delivery | SIL-11 | Broker re-delivers (QoS 1) | One pulse; identical acks |
| 12 | Reboot with a request pending | SIL-12 | Reset between NVS commit and pulse | No pulse on retry (`replay`); a new command works |
| 13 | Maintenance mode | SIL-13, SIL-13b | Enable maintenance (signed), reboot; flip the kill switch | `remote_disabled` / `inhibited`; status still answered |
| 14 | No activation at startup | SIL-14 | Power-up 100×, with the analyser triggered on contact | Zero closures during boot; refused `not_ready` until the clock is valid |
| 15 | No activation on comm/auth failure | SIL-15 | Malformed frames, bad signatures, broker TLS failure | Zero closures |
| 16 | Supply sweep | — | 9 → 16 V slow ramp, plus 6 V crank dip, and 24 V for 60 s (jump-start) via the PSU | No closure; controller recovers |
| 17 | Modem droop | — | Scope VBAT during TX at the cell edge | Droop ≤ 300 mV (SIMCom V1.06 §3.1) |
| 18 | Standby current | — | DMM, 1 h average in each mode of ESP32_INTERFACE_DESIGN.md §7 | Record. Target ≤ 8 mA. |
| 19 | Data use | — | 7 days on a real SIM; operator usage counter | Record. Expect 1–4 MB/month equivalent. |
| 20 | Rate limit | (secure-command tests) | Four starts within an hour | Fourth refused `rate_limited` |

## 5. Running the SIL suite

```bash
npm test     # node --test test/*.test.js — offline, loopback only
```

## 6. Exit criteria for Phase 2 bench work

- Every SIL test passes. Every HIL case 01–20 passes 3 runs in a row.
- Zero unintended closures across ≥ 500 power cycles.
- Measured standby current and data use recorded in CELLULAR_HARDWARE_SELECTION.md.
