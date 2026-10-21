# Custom controller design (Option C)

Status: **design + offline PoC**. No hardware is built and nothing is connected to a vehicle.
Everything that touches the vehicle depends on the Phase 0 gate in
[IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md).

## 1. Requirements

| ID | Requirement |
|---|---|
| F1 | Remote start / stop. Lock / unlock only if a documented EVO-ONE input exists for them. |
| F2 | Status: command result, controller battery-voltage reading, GPS position. Engine-running status only from a Fortin-documented output. |
| F3 | Works on Vodacom and MTN LTE in South Africa. |
| S1 | Only enrolled phone keys can command. The broker cannot forge commands. |
| S2 | Replay-proof: monotonic counter that persists across reboots, plus a ±120 s timestamp window. |
| S3 | At most 3 remote starts per hour (configurable). Local kill switch. |
| S4 | No connection to CAN, OBD, immobiliser or EVO-ONE data-link. One isolated contact on a documented input only. |
| S5 | Output is open by default, on power-up, on reset and on firmware fault. A pulse has a fixed maximum duration enforced by hardware or a watchdog. |
| P1 | Average idle draw ≤ 15 mA target. Cut-off at ≤ 12.0 V resting battery voltage (to be tuned). |
| C1 | Parts ≤ USD 100; running cost ≤ R50/month. |

## 2. Hardware

See HARDWARE_RESEARCH.md §3–5. Reference build:

- **MCU and modem:**
  - **Prototype:** LILYGO T-A7670E (ESP32 + SIMCom A7670E, LTE Cat-1 B1/3/5/7/8/20).
  - **Production:** EC200U-EU or EG915U-EU class modem, to add B28.
- **Power:** fused tap (≤ 3 A), then an automotive buck converter with TVS / load-dump protection, sized for ~2 A modem bursts.
- **Output:** optocoupler or signal relay giving an isolated dry contact, wired **only** to the documented EVO-ONE input, at the voltage and polarity that document specifies.
  - A hardware monostable or watchdog limits the pulse length.
  - A pull-down keeps the output off during ESP32 boot.
- **Sense inputs:**
  - High-impedance battery divider into the ADC.
  - Optional isolated input from a documented EVO-ONE status output.
- **Kill switch:** a physical switch in the cabin that breaks the output's drive line. It is a hardware interlock, independent of firmware.

## 3. Firmware (ESP-IDF, proposed)

| Component | Choice |
|---|---|
| Modem | AT commands over UART (ESP-IDF `esp_modem`) with PPP, or the modem's internal TCP/TLS stack |
| Transport | MQTT 3.1.1 over TLS 1.2+, with broker CA pinned. Keepalive 10–15 min, tuned to carrier NAT. |
| Signature verification | Ed25519 (libsodium component, or another vetted implementation. **Verify** the ESP-IDF component's availability and constant-time properties before use.) |
| Storage | NVS with flash encryption and secure boot v2 enabled. It holds enrolled public keys, last counters per key, APN, broker URL and device key. |
| Device key | Ed25519 key generated on the device at first boot, used to sign acks. Its public key is exported at enrolment. |
| Updates | Signed OTA only (secure boot). Updates over the cellular link are optional. USB is the default. |

### Command handling

Implemented in `poc/secure-command/protocol.js`:

1. Parse `{msg:{v,dev,kid,ctr,ts,cmd}, sig}`. Reject anything malformed.
2. Look up `kid`; if it isn't enrolled, return `unknown_key`.
3. Verify the Ed25519 signature over `"EVOCMD1\n" + canonical(msg)`; on failure, `bad_signature`.
4. `dev` must equal this controller; otherwise `wrong_device`.
5. `ctr` must be greater than the stored counter for this `kid`; otherwise `replay`.
6. `|now − ts| ≤ 120 s`; otherwise `stale`. Time comes from the network (modem `AT+CCLK`/NITZ) or NTP.
7. `cmd` must be on the allow-list; otherwise `unknown_command`.
8. **Persist the counter before acting.** A crash cannot reopen a replay window.
9. Check the kill switch, then the start rate limit, then low voltage.
10. Pulse the output, then return an ack signed with the device key.

**Tested offline** (`npm test`, 13 cases in `test/secure-command.test.js`):
- the valid path;
- replay of the same frame;
- an older, held-back frame;
- a stale timestamp;
- a tampered field;
- an unknown or revoked key;
- the wrong device;
- a command off the allow-list;
- the rate limit;
- the kill switch;
- the counter surviving a reboot;
- actuator failure.

### Why Ed25519 and not a shared HMAC key

- With a shared HMAC key, every party that can verify a command can also forge one. The
  ZXY268 cloud's `txnkey` design shows the cost (RESEARCH_REPORT.md §5.1 S2).
- With Ed25519, the car stores **only public keys**. Extracting them from a stolen controller
  gives no ability to command any other controller, or this one.

### Enrolment and revocation

- Enrolment happens only over USB or a local BLE session started by a physical button, never over the cellular link.
- Revocation is by `kid`. It can be sent remotely if signed by another enrolled key, and is always possible locally.
- If a phone is lost: revoke its `kid` from another phone or over USB.

## 4. Command and data flow

```
phone ──sign──▶ broker topic cmd/<dev> ──▶ controller verify ──▶ pulse documented input
phone ◀─verify── broker topic ack/<dev> ◀── controller sign ack {ctr, ok, reason, result}
```

- Commands are not retained on the broker. QoS 1 is used, and duplicates are absorbed by the counter check.
- Telemetry (battery voltage, GPS) goes on `tele/<dev>` and is signed with the device key.

## 5. Status without touching the vehicle bus

| Status | Source |
|---|---|
| Command accepted / refused | Controller ack (always) |
| Battery voltage | Controller ADC (always) |
| Location | Modem GNSS, if fitted |
| Engine running / remote-start active | Only from a **Fortin-documented** EVO-ONE status output. Otherwise report "start requested" only. |

## 6. Power management

- Light sleep between events. Modem in DRX with MQTT keepalive, or PSM if the operator supports it (**UNKNOWN** in South Africa).
- **Low-voltage policy (initial values, tune in Phase 2):**
  - Below 12.2 V resting: reduce the keepalive interval and send a warning.
  - Below 12.0 V: refuse remote start and report it.
  - Below 11.8 V: modem off and wake hourly, or the controller powers down.
- The Audi energy-management interaction is a question for the installer (HARDWARE_RESEARCH.md §4).

## 7. Threat model, summarised

| Threat | Mitigation |
|---|---|
| Broker or VPS compromised | Cannot forge commands (S1). Worst case: denial of service. |
| Replay of a captured command | Counter + time window (S2); tested. |
| Stolen phone | Revoke `kid`. Use the phone's OS biometric gate on the signing key (keystore / secure enclave). |
| Stolen or tampered controller | Flash encryption + secure boot. The device holds no phone private keys. The kill switch and the EVO-ONE's own logic still apply. |
| SIM swap or traffic interception | TLS + pinning. Commands are signed end to end in any case. |
| Firmware bug actuating the output | Output open by default, hardware pulse limit, physical kill switch. The EVO-ONE validates conditions before it starts. |
| Remote start in an unsafe place (CO) | User-side warning in the app. Rate limit. The EVO-ONE's runtime limit applies. |

## 8. Out of scope

Emulating the EVO-START on the data-link port, CAN or OBD interfacing, key or immobiliser handling,
and any change to EVO-ONE firmware or settings beyond those Fortin documents for the trigger input.
