# ESP32 interface design

## Status

- **Interface:** **not yet verified.** The preferred interface is Fortin Function #38 mode 3,
  "Start/Stop on trigger shock sensor" (EVO_ONE_INTERFACE_RESEARCH.md §3.2), but its pin,
  polarity, pulse width and toggle semantics are unconfirmed.
- **This document therefore gives:**
  1. a complete **bench-only** design (§2), connected to nothing in the vehicle;
  2. the vehicle-side **architecture** (§3–8), with every interface-specific value left as a
     named parameter.

**No vehicle pin-to-pin connection diagram is given.** One will be added only after Fortin
confirms the interface (PHASE2_DECISION.md).

Hard constraints, carried into every block:
- The ESP32 never energises the starter.
- It never touches brake, bonnet, gear or immobiliser circuits or the CAN bus.
- Its only vehicle-side output is one **galvanically isolated contact** on a Fortin-documented input.

## 1. Block diagram (vehicle build, interface-agnostic)

```
 +12V (fused tap, per installer) ─┬─[F1 fuse]─[reverse-polarity FET]─[TVS]─[LC/CMC filter]─┐
                                   │                                                        │
 GND (single point) ───────────────┴────────────────────────────────────────────────────────┤
                                                                                             ▼
                                      ┌──────────── wide-Vin buck (≥ 40 V in) ─► 3.8 V ─► modem VBAT (EN = MCU)
                                      └──────────── buck/LDO ─► 3.3 V ─► ESP32-S3
                                                                     │
      ESP32-S3 ──UART/PWRKEY/RESET/RI──► LTE Cat-1 modem ── antenna (LTE, opt. GNSS)
         │
         ├─ GPIO ARM ─┐
         ├─ GPIO FIRE ┴─[AND + hardware one-shot (t_max)]─[kill switch]─► photo-MOSFET LED
         │                                                        isolated contact ═══► (Fortin-documented input: TBD)
         ├─ ADC ◄── high-Z divider ◄── +12 V sense (battery voltage)
         └─ GPIO ◄── bipolar-input optocoupler ◄═══ (Fortin-documented status output: TBD)
```

## 2. Bench-only design (build first; no vehicle parts)

| Item | Bench implementation |
|---|---|
| Supply | Current-limited bench PSU set to 12.6 V, then swept 9–16 V. Limit to 1 A. |
| Controller | LILYGO T-A7670G (or T-A7670E) on USB, then on the automotive front-end |
| EVO-ONE stand-in | A second MCU (any Arduino/ESP) running the **generic toggle model** of `poc/bench-sim/mocks.js` (`MockRemoteStarter`). It toggles a "running" LED on contact closure and drives a status line. **It is not a Fortin model.** |
| Output under test | Photo-MOSFET contact switching an LED + resistor and the stand-in's input |
| Instruments | Logic analyser on ARM, FIRE, contact and status; DMM in µA range for standby current; scope on the modem VBAT rail for droop |
| Network | Real Vodacom/MTN prepaid SIM. Broker on a laptop or VPS. Commands signed by the PoC client. |

Every BENCH_TEST_PLAN.md case runs against this rig before any vehicle work.

## 3. Output stage (generic)

- **Device:** photo-MOSFET solid-state relay (PhotoMOS-class). It gives an isolated, bipolar-capable
  contact with a low LED drive current and no coil, so there is no flyback and no
  contact-bounce surprises.
  - **Select the exact part only after** Fortin specifies the input's voltage, polarity and current.
  - Parameters to fill: contact voltage ≥ 2 × the specified open-circuit voltage; contact current ≥
    2 × the specified sink current; on-resistance low enough for the input's threshold.
- **Default-off by construction:**
  - pull-downs on ARM and FIRE;
  - the LED is driven only when **both** GPIOs are asserted, so a single stuck pin can't fire it;
  - a **hardware one-shot** (monostable, for example a 74LVC1G123-class part) caps the pulse at
    `t_max`, set slightly above Fortin's specified pulse;
  - a **physical kill switch** in series with the LED drive.
- **Boot behaviour:** ESP32 strapping pins are **not** used for ARM or FIRE. The GPIO state at
  reset must keep the LED off; verify on the logic analyser (BENCH_TEST_PLAN.md HIL-03).
- **Firmware rules:** on boot, ARM and FIRE are driven low before anything else
  (`poc/controller/controller.js` `boot()` calls `output.init()` first). The pulse width comes
  from configuration that must be set from Fortin documentation
  (`poc/controller/trigger-adapter.js` refuses to construct without `pulseMs`).

## 4. Status input (generic)

- **Purpose:** with a toggle-style trigger, start/stop is safe **only** when the controller knows
  the current state (`poc/controller/trigger-adapter.js`). Without a documented status output,
  start/stop is refused ("status_unknown").
- **Circuit:** a bipolar-input (AC-input) optocoupler with series resistor and clamp, so either
  output polarity is accepted without guessing. The resistor is sized once Fortin gives the
  output's voltage and type (ground-when-active or +12 V-when-active).
- **Alternative if no output exists:** monitor the controller's own supply voltage. A rise above
  about 13.2 V suggests the alternator is charging. This is **INFERRED** and unreliable with smart
  charging on the C7. **Not** a safety signal; use it only as a hint in the ack.

## 5. Power, protection and grounding

| Topic | Design |
|---|---|
| Fuse | ≤ 2 A blade fuse **at the tap point**. The installer chooses the tap: a constant 12 V circuit appropriate for the Audi energy management (Phase 1 HARDWARE_RESEARCH.md §4). |
| Reverse polarity | P-channel MOSFET or ideal-diode controller. A series Schottky also works, at higher loss. |
| Transients | Unidirectional TVS sized for ISO 7637-2 / ISO 16750-2 pulses. Buck rated **≥ 40 V input**. Assume suppressed load dump; confirm the clamp voltage is below the buck's absolute maximum. |
| Filtering | Common-mode choke + LC on input; ferrites on the harness |
| Modem supply | 3.8 V buck with an **MCU-controlled enable**. Per SIMCom A7670 Hardware Design V1.06: VBAT 3.4–4.2 V (3.8 V recommended); **≥ 300 µF bulk if the supply can deliver 2 A peaks, otherwise ≥ 600 µF**, droop ≤ 300 mV. Power-cut only as a last resort; normal shutdown via PWRKEY or `AT+CPOF`. |
| ESP32 supply | Separate 3.3 V rail; brownout detector enabled |
| Grounding | One ground point (the tap's ground, or a chassis stud chosen by the installer). The output contact and status input are **isolated**, so no ground loop reaches the EVO-ONE. |
| EMI/EMC | LTE antenna away from the EVO-ONE and its harness. Twisted pairs for contact and status lines. Short, filtered power lead. ESP32 Wi-Fi and Bluetooth **disabled** in the vehicle build. |

## 6. Firmware reliability

- **Watchdogs:** ESP-IDF task watchdog + RTC watchdog. A modem hang leads to a PWRKEY restart, then
  an enable-pin power cycle as a last resort.
- **Brownout:** brownout reset enabled. On every reset, `boot()` releases outputs, reloads NVS
  counters and maintenance state, and waits for a trusted clock (network time) before accepting
  commands (`poc/controller/controller.js`). Tested in `test/bench-sim.test.js` SIL-10, SIL-12 and SIL-14.
- **At-most-once actuation:** counters are committed to NVS **before** actuation, so a reset in
  between can never repeat a command (SIL-12).

## 7. Low power and battery drain

| Mode | Estimated controller draw | Latency | Notes |
|---|---|---|---|
| Always-connected MQTT, modem in DRX sleep, ESP32 light sleep | ~3–8 mA (INFERRED: A7670 sleep < 2.5 mA; SIM7672 0.48–1.5 mA; ESP32 light sleep ~1 mA; regulators) | seconds | Preferred. Measure on the bench. |
| SMS wake: modem sleeping, RI pin wakes ESP32, ESP32 fetches the signed command over TLS | ~2–5 mA | 5–30 s | The SMS carries no authority; it only says "check in" |
| Periodic poll every N minutes, modem off between | < 1 mA average | up to N min | Fallback for long parking |

**Battery budget (INFERRED):**
- At 8 mA the controller uses about 0.19 Ah/day.
- Battery capacity is **UNKNOWN**; assume 70–95 Ah AGM. At that size, 14 days of parking costs about 3–4% of capacity.
- **Low-voltage policy:** refuse start below 12.0 V resting; switch to periodic-poll mode below 12.2 V.

## 8. Enclosure, harness and device security

- **Enclosure and mounting:**
  - Enclosure: rated IP54 or better, flame-retardant.
  - Mounting: mechanically secured behind trim, away from airbags, pedals and the steering column.
  - Internal USB only.
- **Connectors:** sealed automotive types (MX150, Superseal or DTM class) with strain relief. Inline fuse holder at the tap.
- **Board:** conformal coat after the bench validation is complete.
- **ESP32-S3 hardening:**
  - secure boot v2 and flash encryption in release mode;
  - JTAG disabled by eFuse;
  - UART download mode secured;
  - NVS encryption;
  - unique device Ed25519 key generated on the device.

## 9. Information required before §3–4 become a wiring diagram

All of these must come from Fortin (FORTIN_SUPPORT_EMAIL.md):
- input pin and connector;
- polarity;
- open-circuit voltage and sink current;
- pulse width;
- toggle or separate start/stop behaviour;
- status output availability and type;
- firmware 1.31 support;
- coexistence with 3× Lock.
