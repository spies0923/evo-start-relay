# Phase 2 decision: go / no-go

Date: 2026-10-21.

Basis:
- EVO_ONE_INTERFACE_RESEARCH.md
- OPENREMOTESTART_REVIEW.md
- CELLULAR_HARDWARE_SELECTION.md
- ESP32_INTERFACE_DESIGN.md
- BENCH_TEST_PLAN.md

Limitation: Fortin's site and documents could not be opened from this environment. All Fortin
evidence is from search extracts. OpenRemoteStart and the SIMCom documents were read in full.

## 1. Decision

| Area | Decision |
|---|---|
| Software (protocol, controller lifecycle, simulator, phone signer, broker) | **GO** |
| Bench hardware with a generic EVO-ONE stand-in | **GO**: buy the bench items in §4 |
| Recommended vehicle interface | **Fortin Function #38 mode 3 "Start/Stop on trigger shock sensor"** + a documented status output. **Conditional on Fortin confirmation.** |
| Fallback interface | A dedicated Fortin RF kit remote, button-actuated through isolated contacts (supported Fortin path; automation not documented) |
| RS-232 data-link control | **NO-GO** until Fortin supplies a specification |
| Antenna data-link emulation (OpenRemoteStart approach) | **REJECTED**: undocumented, unauthenticated bus, unlock-capable |
| Vehicle CAN / immobiliser / factory key in car | **EXCLUDED** |
| Vehicle wiring, output-part selection, EVO-ONE connector purchase | **NO-GO** until blockers B1–B4 clear |

## 2. Blockers (all need Fortin, FORTIN_SUPPORT_EMAIL.md)

| ID | Blocker |
|---|---|
| B1 | Function #38 mode 3 on RS firmware 1.31: exact pin/connector, polarity, voltage and current, pulse width, toggle versus separate behaviour |
| B2 | Whether mode 3 replaces "3× Lock" (both are Function #38 modes) |
| B3 | A documented status output: needed because a toggle input without state feedback could stop when asked to start (`poc/controller/trigger-adapter.js` refuses in that case) |
| B4 | Confirmation that the EVO-ONE's safety and takeover logic applies identically to this trigger, and any warranty restriction |
| B5 (optional) | RS-232 data-link specification for third parties, if Fortin will share it |

## 3. Evidence summary

| Claim | Confidence |
|---|---|
| The EVO-ONE has an "RS-232 data-link & FlashLink updater" port, used by partner telematics | Medium |
| No public third-party RS-232 protocol specification exists | High |
| Function #38 includes "Start/Stop on trigger shock sensor" | Medium (several Fortin guide extracts; older revisions) |
| Electrical details of that trigger | Low (conflicting 2016–2018 Q&A answers) |
| OpenRemoteStart uses the antenna data-link, is reverse-engineered and is unsuitable | High (source read) |
| A7670E / A7670G / SIM7672E band support | High (SIMCom documents read) |

## 4. Cost estimate (ZAR)

Assumptions: R18/USD. No South African retail prices were found, so these are **estimates**.
Add 15% VAT and shipping on imports.

| Item | Phase | Est. ZAR |
|---|---|---|
| LILYGO T-A7670G (or E) ESP32 + LTE board | Bench (buy now) | 650–850 |
| Wideband LTE antenna (698–2690 MHz), SMA/IPEX adapter | Bench | 100–250 |
| Vodacom/MTN prepaid SIM (RICA) + monthly bundle | Bench | ~30 + 29/month |
| Second MCU as EVO-ONE stand-in (Arduino/ESP32 dev board) | Bench | 100–200 |
| 8-channel USB logic analyser | Bench | 150–300 |
| Breadboard parts: photo-MOSFET SSR samples, one-shot IC, AC-input optocouplers, resistors | Bench | 150–300 |
| Wide-input (≥ 40 V) buck module + TVS + fuse holder (front-end prototype) | Bench | 150–300 |
| Current-limited bench PSU (if not owned) | Bench, optional | 800–1,500 |
| **Bench subtotal** (excluding PSU) | | **~1,350–2,250** |
| Vehicle build: ESP32-S3 + SIM7672E/A7670G carrier, front-end PCB, enclosure, sealed connectors, harness | After B1–B4 | 900–1,800 |
| Fortin RF kit (only if the fallback is chosen) | Conditional | UNKNOWN (not priced) |
| **Total hardware (bench + vehicle)** | | **~2,250–4,050** (+ import costs) |
| Running cost | | ~R29/month data; broker self-hosted (R0) or a small VPS (~R90/month) |

## 5. Next practical milestone

**Milestone 2A, "Bench round trip"**, achievable before Fortin replies:
- a phone-signed start reaches a LILYGO board over a real South African LTE SIM via your MQTT broker;
- the board pulses the isolated contact into the generic stand-in;
- a signed, confirmed ack comes back;
- BENCH_TEST_PLAN.md cases 01–15 pass on hardware.

In parallel: **send the Fortin email** (§2 blockers).

## 6. Answers to the Phase 2 questions

1. **Can the EVO-ONE be controlled directly over RS-232?** Not on available evidence. The port
   exists and partner telematics use it, but no third-party specification is public. Confidence: High.
2. **Evidence:**
   - Fortin guide #68771 rev D labels the "(4-PIN) RS-232 DATA-LINK & FLASH-LINK UPDATER PORT";
   - Fortin documents for DEI XL202 and SmartStart integration exist;
   - Q&A #137623 asks for the specification, with no readable answer;
   - none was found in any search;
   - OpenRemoteStart uses the *antenna* data-link instead, by reverse engineering.
3. **Is there a manufacturer-documented external start input?** By name, yes: Function #38
   "Start/Stop on trigger shock sensor" in Fortin's option tables. Its electrical details are
   **not** documented in anything readable here.
4. **Is OpenRemoteStart suitable?** No. It is experimental, uses an undocumented and unauthenticated
   bus, includes an address-cloning and alarm-suppression demo, runs on 3G Americas hardware and
   has weak authentication. BSD-3 licensed, useful only as background.
5. **Which interface should we use?** Function #38 mode 3 plus a documented status output, once
   Fortin confirms it. Fallback: a button-actuated dedicated Fortin RF remote.
6. **What can be bought safely now?** The bench items in §4. Nothing that commits to the EVO-ONE
   connector or a vehicle wiring choice.
7. **What still needs Fortin?** B1–B5 (§2).
8. **What can proceed before hardware arrives?**
   - the phone-side signer;
   - the Mosquitto broker with TLS;
   - porting `poc/` logic to ESP-IDF (NVS, secure boot and flash-encryption plan);
   - the TinyGSM/esp_modem bring-up scripts;
   - extending SIL tests.
9. **Estimated hardware cost:** about R1,350–2,250 for the bench, and about R2,250–4,050 in total
   with the vehicle build, plus import costs and about R29/month for data.
10. **Next milestone:** Milestone 2A (§5), plus sending the Fortin email.
