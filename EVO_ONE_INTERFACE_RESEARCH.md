# EVO-ONE external-control interface research (Phase 2)

Vehicle and system: 2017 Audi A6 C7.5 2.0 TDI (RHD, auto, push-start, South Africa). Fortin
EVO-ONE, bypass firmware 60.12, RS firmware 1.31, DCryptor done, wire-to-wire guide #79791,
factory-key 3× Lock start working, no Fortin RF kit.

## 0. Method, limitations and labels

- **Blocked:** fortin.ca, its CDN, the Fortin/Wirecolor Q&A mirrors and manualslib could **not be
  opened** from this environment. The proxy refused them and WebFetch failed on DNS (checked
  2026-10-21). Every Fortin statement below comes from **search-engine extracts** of the cited
  page. An extract is not the full manufacturer document: tables, notes and figures may be
  missing or out of context.
- **Read in full:** GitHub was reachable. OpenRemoteStart's source and SIMCom's modem documents (via
  the LILYGO repository) were read in full.
- **Excluded:** no vehicle, EVO-ONE, serial port or remote server was touched. The Audi CAN bus and
  the immobiliser are excluded by design.

| Label | Meaning |
|---|---|
| **DOC-EXTRACT** | Text attributed to a Fortin-published document or Fortin-hosted page, seen only as a search extract |
| **QA-EXTRACT** | Fortin/Wirecolor Q&A answer (community or staff not distinguishable), seen as a search extract |
| **SOURCE-READ** | Read in full in this session (file path and line cited) |
| **INFERRED** | Engineering deduction |
| **UNKNOWN** | Not established |

Confidence levels: **High** (several consistent sources, or read in full), **Medium** (one good
source, or consistent extracts), **Low** (a single extract, community claims that conflict, or
old documents).

## 1. Summary of findings

| # | Finding | Label | Confidence |
|---|---|---|---|
| 1 | The EVO-ONE has a port Fortin labels **"(4-PIN) RS-232 DATA-LINK & FLASH-LINK UPDATER PORT"**, separate from a "(4-PIN) ANTENNA" port | DOC-EXTRACT [F1] | Medium |
| 2 | Fortin markets a "2-way datalink port" for "compatible telematic units" | DOC-EXTRACT [F16] | High |
| 3 | **No public Fortin specification** of that port's electrical levels, pinout, framing, baud rate or command set was found. A Fortin Q&A thread asks exactly this; its answer could not be read. | QA-EXTRACT [F8]; search | High (that none is public) |
| 4 | Officially supported devices on the data-link are **specific partner telematics** (Fortin EVO-START/EVO-START 2, DEI/Directed SmartStart DSM-series, MyCar), connected with Fortin cables or harness changes | DOC-EXTRACT [F9][F10]; QA-EXTRACT [F11][F12] | Medium |
| 5 | Those partner units are **North American cellular products**. None is known to support South African bands. | INFERRED (Phase 1 SIM_FEASIBILITY.md §3) | Medium |
| 6 | **Function #38 "System control by OEM remote"** is a documented, single-choice EVO-ONE option. Its modes include *Disable*, *Press 3× Lock to remote start*, *Alarm control by OEM remote*, ***Start/Stop on trigger shock sensor*** (mode 3) and *Press Lock-Unlock-Lock to remote start* | DOC-EXTRACT [F2][F3][F4][F5] | Medium |
| 7 | Mode 3 reportedly turns the **middle pin of the 3-pin shock-sensor port** into a **negative** external start/stop trigger. One 2016 answer calls it a "hidden test feature". | QA-EXTRACT [F6] | Low |
| 8 | Community answers **conflict** on the shock-port pin order and connector. One warns that a wrong connector can short the trigger pin to the sensor's +12 V pin, damaging the unit and voiding the warranty. | QA-EXTRACT [F6][F7] | Low (conflicting) |
| 9 | Because Function #38 is single-choice, **selecting mode 3 would probably disable the 3× Lock start you use today** | INFERRED from [F2][F3] | Medium; **ask Fortin** |
| 10 | OpenRemoteStart talks to Fortin modules over the **antenna data-link**, not the RS-232 port, by impersonating an RF antenna. It is unofficial and reverse-engineered (2019). | SOURCE-READ (OPENREMOTESTART_REVIEW.md) | High |

## 2. The EVO-ONE "RS-232" data-link port: answers to the 12 questions

| # | Question | Answer | Label / confidence |
|---|---|---|---|
| 1 | Exact connector | "(4-PIN) RS-232 DATA-LINK & FLASH-LINK UPDATER PORT" [F1]. Community posts disagree on whether it is the black or the middle blue housing [F15]. | DOC-EXTRACT, Medium for existence; Low for which housing |
| 2 | Type, pitch, pin count, orientation | 4 pins (from the label). Type, pitch and orientation: **UNKNOWN** | — |
| 3 | Pin assignments | **UNKNOWN.** No Fortin pinout seen. Community photos were not used, per your instruction. | — |
| 4 | True RS-232 or TTL | **UNKNOWN.** Fortin's label says "RS-232", but marketing often uses that for any UART. OpenRemoteStart reports 5 V logic on the *antenna* data-link (a different port), which is not evidence about this one. | — |
| 5 | Baud, parity, data, stop bits | **UNKNOWN** for this port | — |
| 6 | Hardware flow control | **UNKNOWN** | — |
| 7 | Binary or ASCII | **UNKNOWN** | — |
| 8 | Firmware configuration needed | Yes for partner telematics. For example, an older DroneMobile needed a specific EVO-ONE firmware ("0.50"), and newer DroneMobile protocol changes broke compatibility [F11][F12]. | QA-EXTRACT, Medium |
| 9 | Extra Fortin hardware | Partner cables or harness changes (DEI XL202 swap of blue and white wires [F9]; SmartStart cable [F10]) | DOC-EXTRACT, Medium |
| 10 | Start / stop / lock / unlock / status | Supported **for partner telematics** ("2-way") [F16][F11]. For a custom device: **UNKNOWN** | Medium / — |
| 11 | Status or fault codes | **UNKNOWN** | — |
| 12 | Works with ignition OFF | INFERRED yes for partner telematics, since they start a parked car. Not documented. | INFERRED, Medium |

**Conclusion:** the port exists and is Fortin's supported route for **partner** telematics. Its
protocol is **not publicly documented** for third parties. Without Fortin's specification there
is nothing safe to implement against. Emulating a partner device's proprietary protocol would be
the same undocumented reverse engineering that Phase 1 excluded.
**Direct RS-232 control by an ESP32 is not possible on the evidence available. Confidence: High**
(unless Fortin supplies the specification).

## 3. Other Fortin interfaces

### 3.1 Antenna data-link (RF kits, telematics)

- Fortin RF kits plug into the EVO-ONE antenna port. When an EVO-START LTE is also fitted, the RF
  kit is programmed with the EVO-START LTE unplugged [F13] (Phase 1 [H8][H10]).
- The EVO-START LTE plugs into the "small blue port" [H9]. The EVO-START 2 has a blue 4-pin
  *antenna* connector plus an optional black 4-pin *data-link T-harness* connector [F14].
- **INFERRED, Low confidence:** Fortin's own smartphone accessories use the **antenna data-link**
  bus, and third-party telematics use the **RS-232 data-link** port. The public material does not
  say so explicitly and port naming is inconsistent [F15]. Do not assume the EVO-START LTE uses
  RS-232.
- **Not documented for third parties.** OpenRemoteStart's reverse engineering shows the bus
  accepts commands from any device presenting a learned or cloned remote address (§5,
  OPENREMOTESTART_REVIEW.md). That makes it unsuitable for an internet-connected custom device.

### 3.2 Documented discrete trigger: Function #38 mode 3

| Item | Status |
|---|---|
| Input name | "Start/Stop on trigger shock sensor" (Function #38, mode 3) [F2][F3][F4][F5] |
| Pin | Middle pin of the 3-pin shock-sensor port, according to a Q&A answer [F6]. **Not seen in a Fortin diagram** |
| Polarity | Negative ("negative pulse"), according to the Q&A answer [F6]. **Unconfirmed** |
| Pulse duration | **UNKNOWN** |
| Start versus stop | Name says "Start/Stop on trigger", which suggests **toggle** behaviour. **UNKNOWN** whether a second pulse stops the engine, or whether a held contact differs |
| Repeated or held activation | **UNKNOWN** |
| Lock/unlock via this input | Not indicated. Assume **no** |
| Status feedback | Not part of this input. A documented status output (for example a remote-start-active or ground-when-running output) is **UNKNOWN** for the EVO-ONE in this install |
| Coexistence with 3× Lock | Probably **mutually exclusive** (one option, several modes). **Ask Fortin** |
| Firmware 1.31 support | **UNKNOWN.** The guides seen are older revisions (#94011 rev A, RF751W #32971 rev N). The 2016 answer calls it hidden. |
| Interaction with alarm option 14.2 | One answer says the shock port works only with alarm option 14.2 enabled [search extract]. Whether that applies to mode 3 is **UNKNOWN** |
| Safety logic retained | INFERRED yes. The trigger asks the EVO-ONE to start, and the EVO-ONE still applies its own conditions (bonnet, brake, gear, takeover). **Fortin should confirm** |

**This is the most promising supported interface:** documented by name in Fortin's option table,
a simple isolated contact, no protocol, and the EVO-ONE stays in charge of the vehicle. It is
**not yet sufficiently specified to wire**.

### 3.3 Factory-remote control (currently in use)

Function #38 mode "Press 3× Lock" works today. **Driving it from an ESP32 is rejected.** It would
need a working factory key in the car, which defeats the immobiliser on a keyless push-start
vehicle (Phase 1 RESEARCH_REPORT.md §7).

### 3.4 Fortin RF remote, button-actuated (fallback)

- A Fortin RF kit (antenna + remote) is a supported Fortin path. An ESP32 could press a dedicated
  Fortin remote's buttons through opto-isolated contacts.
- This needs no vehicle-side reverse engineering, and a Fortin remote is **not** a vehicle key.
- Drawbacks:
  - The remote's internals are undocumented for automation.
  - It needs a remote battery or power supply.
  - RF timing is uncertain.
  - It occupies the antenna port.
  - Button wiring is a modification of the remote, not of the vehicle.
- **Fallback only.**

### 3.5 Vehicle CAN bus

**Excluded** from implementation.

## 4. Interface comparison

| Criterion | RS-232 data-link | Function #38 mode 3 trigger | Fortin RF accessory (button-actuated) | Antenna data-link (emulated) | Vehicle CAN |
|---|---|---|---|---|---|
| Documentation | Port named; **protocol not public** | Mode named in option tables; **electrical details missing** | Product documented; automation use not | **None (reverse-engineered only)** | Excluded |
| Hardware complexity | Transceiver + protocol stack | One opto/relay contact + status input | Opto across remote buttons + remote power | Level shifter + protocol | — |
| Cost | Low (if specified) | Lowest | RF kit cost + low | Low | — |
| Reliability | Unknown | High (simple contact) if confirmed | Medium (RF path, remote battery) | Unknown; firmware updates may break it | — |
| Standby draw | UART idle, low | Negligible | Remote standby + ESP32 | UART idle, low | — |
| Safety | EVO-ONE logic retained | EVO-ONE logic retained; **toggle semantics need status** | EVO-ONE logic retained | Bus is unauthenticated; risk of rogue commands | — |
| Serviceability | Plug-in | Plug-in to shock port (connector risk) | Separate box | Plug-in | — |
| Firmware compatibility | Depends on Fortin spec and version | **Must be confirmed for RS 1.31** | Good | Fragile | — |
| Verdict | **Blocked**: needs Fortin spec | **Preferred**: pending Fortin confirmation | Fallback | **Rejected for production** | **Excluded** |

## 5. Security observation (defensive)

OpenRemoteStart's author documents that the antenna data-link accepts a device that **clones an
existing remote's address**. It includes a demonstration flag that would suppress the alarm by
sending unlock when a door opens (`src/openremotestart.ino:158-175`, `:581-586`, SOURCE-READ). Two practical
consequences:

1. Anything under the dash with access to that bus can, in principle, unlock the car. Mount the
   EVO-ONE and its harnesses securely, as installers normally do.
2. **An internet-connected device should never sit on that bus.** This research does not propose it.

## 6. What must come from Fortin

See [FORTIN_SUPPORT_EMAIL.md](FORTIN_SUPPORT_EMAIL.md). In short:
- the RS-232 specification, or confirmation that none is available to third parties;
- full Function #38 mode 3 details for RS firmware 1.31: pin, polarity, pulse width, toggle
  behaviour, held versus pulsed activation, coexistence with 3× Lock, and the safety logic retained;
- a documented status output;
- any warranty restrictions.

## Sources

Fortin documents are given with the revision shown in their file name. **All were seen as search
extracts only.**

- F1 Fortin, *EVO-ONE Quick Installation Guide, RM411*, doc #68771 rev D. https://fortin.ca/download/68771/EVO-ONE_QG_RM411_EN_D_68771.pdf
- F2 Fortin, *EVO-ONE Complete Install Guide*, doc #94011 rev A. https://fortin.ca/download/94011/evo-one_ig_complet_install_guide_evo-one_a_94011.pdf
- F3 Fortin, *EVO-ONE Quick Guide, RF751W*, doc #32971 rev N. https://cdn02.fortin.ca/download/32971/evo-one_qg_rf751w_n_32971.pdf
- F4 Fortin RFK942 EVO-ONE installation guide (Manuals+ copy). https://manuals.plus/fortin/rfk942-evo-one-all-in-one-data-interface-remote-starteralarm-manual
- F5 Fortin EVO ONE Install Manual, p. 22 "System Control By OEM Remote (Option #38)" (manualslib copy). https://www.manualslib.com/manual/1828372/Fortin-Evo-One.html?page=22
- F6 Fortin Q&A #68829 "Can I activate EVO-ONE via a pulse" (2016). https://www.wirecolor.pp.fortin.ca/en/qa/68829/can-i-activate-evo-one-via-a-pulse
- F7 Fortin Q&A #75308 "3-pin shock sensor connector". https://www.wirecolor.pp.fortin.ca/fr/qa/75308/3-pin-shock-sensor-connector
- F8 Fortin Q&A #137623 "RS-232 data-link capabilities and documentation for EVO-ONE". https://www.wirecolor.pp.fortin.ca/en/qa/137623/rs-232-data-link-capabilities-and-documentation-for-evo-one
- F9 Fortin, *DEI XL202 with EVO-ONE*, doc #25331. https://fortin.ca/download/25331/xl202_evo-one.pdf
- F10 Fortin Q&A #38903 "DEI SmartStart to EVO-ONE data-link cable modification". https://fortin.ca/en/qa/38903/dei-smartstart-to-evo-one-data-link-cable-modification
- F11 Fortin Q&A #96527 "DroneMobile X1 Max on Fortin EVO-ONE". https://www.wirecolor.pp.fortin.ca/en/qa/96527/dronemobile-x1-max-on-fortin-evo-one
- F12 Fortin Q&A #62633 "EVO-ONE with Drone Mobile". https://www.wirecolor.pp.fortin.ca/en/qa/62633/evo-one-with-drone-mobile
- F13 Fortin, *EVO-ONE / EVO-START quick guide*, doc #102151 rev F/H. https://fortin.ca/download/102151/EVO-ONE_IG_EVO-START_QUICK-GUIDE_F_102151.pdf ; https://cdn02.fortin.ca/download/102151/EVO-ONE_IG_EVO-START_QUICK-GUIDE_H_102151.pdf
- F14 Fortin, *EVO-START2 Quick Guide*, doc #69731 rev H. https://cdn02.fortin.ca/download/69731/EVO-START2_QG_H_69731.pdf
- F15 Fortin Q&A #96638 "EVO-START2 2020 Forte install question". https://www.wirecolor.pp.fortin.ca/en/qa/96638/evo-start2-2020-forte-install-question
- F16 Fortin EVO-ONE product page. https://fortin.ca/en/products/evo-series-modules/evo-one/
- H8/H9/H10/H13: see [HARDWARE_RESEARCH.md § Sources](HARDWARE_RESEARCH.md#sources).
