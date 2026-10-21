# Implementation roadmap

Each phase ends with an explicit go/no-go. No phase involves modifying EVO-ONE firmware, the
bypass, or the vehicle's networks.

## Phase 0: confirm the integration point (gating, no spend)

- [ ] From guide #79791, the EVO-ONE option list and FlashLink Manager, find any **documented**
      input that starts and stops the engine when driven by an external contact, with full EVO-ONE
      safety logic.
- [ ] Ask Fortin technical support in writing:
  1. What is the documented way for a third-party telematics device to request remote start and stop on an EVO-ONE in this configuration?
  2. Is there a documented status output (for example remote start active)?
  3. Is there an EVO-START LTE unit and plan that Fortin supports in South Africa?
  4. Which modem does the EU-version EVO-START LTE use?
- [ ] Record the answers in `RESEARCH_REPORT.md` §6 and §9.

**Decision:**
- A documented input exists → Phase 1 (Option C).
- No such input, but Fortin supports an SA unit → Option A; stop here.
- Neither → keep the factory-key 3× Lock start; stop.

## Phase 1: software only (no vehicle, no hardware)

- [x] Offline tests of the existing protocol client (`test/zxy.test.js`).
- [x] Signed-command PoC + tests (`poc/secure-command/`, `test/secure-command.test.js`).
- [ ] Fix relay findings R1–R6 (RESEARCH_REPORT.md §5.2), keeping current behaviour and adding tests.
- [ ] Phone-side signer: Home Assistant script or a small app using the platform keystore.
- [ ] Self-hosted MQTT broker (Mosquitto) with TLS. Test the end-to-end flow against a **simulated** controller (Node, using the PoC).

**Exit:** the full command and ack round trip works in simulation, and every test passes.

## Phase 2: bench prototype (no vehicle)

- [ ] Buy one LILYGO T-A7670E (or equivalent), an automotive buck converter, an opto/relay and antennas. Check ICASA approval of the board or module variant first.
- [ ] Firmware: modem bring-up on a RICA'd Vodacom or MTN prepaid SIM with APN from NVS; MQTT/TLS; the command handler ported from the PoC; NVS counters; flash encryption and secure boot.
- [ ] Measure: idle current, data per day (to check the 1–4 MB/month estimate), and NAT keepalive limits on each operator.
- [ ] The output drives an LED or a dummy load only. Verify the pulse limit, the boot state and the kill switch.
- [ ] Fault tests: power cycling mid-command, brown-out, SIM removal, clock loss.

**Exit:** the bench unit meets S1–S5 and P1 (CUSTOM_CONTROLLER_DESIGN.md §1).

## Phase 3: integration (with the installer)

- [ ] A qualified installer connects the isolated contact to the **documented** EVO-ONE input per Fortin's documentation, with the power tap fused and placed correctly for the A6's energy management.
- [ ] First tests in open air with the vehicle attended, using the EVO-ONE's own safety conditions (for example hood or brake inputs, as documented).
- [ ] Add a `mqtt-signed` back end to `src/server.js` (ARCHITECTURE.md §3), keeping the ZXY back end as the default.
- [ ] Two weeks of soak testing: battery voltage trend, missed commands, data use.

**Exit:** reliable start and stop, with no battery or warning-light issues, for two weeks.

## Phase 4: hardening and maintenance

- [ ] Signed OTA. Key-rotation procedure. Revocation runbook.
- [ ] Optional: GNSS telemetry, geofence alerts, push notifications via Home Assistant.
- [ ] Consider the B28-capable modem (EC200U-EU / EG915U-EU) for rural coverage.
- [ ] Re-check 2G/3G sunset and bundle-rule changes yearly (SIM_FEASIBILITY.md §4–6).

## Rough effort and cost

| Phase | Effort (INFERRED) | Spend |
|---|---|---|
| 0 | 1–2 weeks elapsed (waiting on Fortin) | R0 |
| 1 | 2–4 evenings | R0 (or a ~USD 5/month VPS if not self-hosted) |
| 2 | 1–2 weekends | ~R1,000–1,700 parts + SIM |
| 3 | 1 installer visit + 2 weeks soak | Installer labour |
| 4 | Ongoing, small | Data ~R29/month |
