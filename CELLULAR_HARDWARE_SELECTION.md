# Cellular hardware selection

South African target bands (Phase 1, SIM_FEASIBILITY.md §2):
- **essential:** LTE FDD B1 / B3 / B8;
- **rural:** B20 (MTN 800) and B28 (Vodacom and Rain 700);
- **optional:** TDD B38 / B40 (Rain, Telkom).

The 2G/3G sunset is under way and LTE-M/NB-IoT is not consumer-available, so the requirement is
**LTE Cat 1 or Cat 1bis**.

## 1. Manufacturer-verified band support

Read in full from SIMCom documents in LILYGO's public repository
(https://github.com/Xinyuan-LilyGO/LilyGO-T-A76XX, commit `51b988a`, 2026-10-10, `datasheet/`).
simcom.com itself was blocked from this environment.

| Module | Document (rev) | GSM | LTE-FDD | LTE-TDD | Cat | SA fit |
|---|---|---|---|---|---|---|
| **A7670E** | *A7670系列硬件设计手册* (A7670 Series Hardware Design) **V1.06**, Table 1 | 900/1800 | **B1, B3, B5, B7, B8, B20** | — | 1 | Good: Vodacom and MTN core + MTN 800. **No B28** |
| A7670SA | same, Table 1 | 850/900/1800/1900 | B1, B2, B3, B4, B5, B7, B8, B28, B66 | — | 1 | Good, but **no B20** |
| **A7670G** | *A7670G Spec* (V 2021.11) | Yes | B1/2/3/4/5/7/8/12/13/18/19/20/25/26/28/66 | B38/39/40/41 | 1 | **All SA bands** |
| **SIM7672E** | *SIM7672X Series Hardware Design* **V1.02** (2023-07-27, marked "early release"), Table 2 | none (LTE-only) | **B1, B3, B5, B7, B8, B20, B28** | — | 1 | **All SA FDD bands**, no 2G |
| SIM7672G | same, Table 2 | none | Global FDD incl. B1/3/7/8/20/28 | B34/38/39/40/41 | 1 | All SA bands |

Power figures from the same documents:

| Module | Peak current | Sleep / idle | Note |
|---|---|---|---|
| A7670 series | **up to 2 A** at maximum GSM transmit power (V1.06 §3) | sleep **< 2.5 mA**; power-off ~20 µA | The 2 A burst drives power-supply design |
| SIM7672X | **746 mA** peak; 4.13 mA average idle | sleep 1.5 mA at DRX 0.32 s, **477 µA at DRX 1.28 s** (GNSS off) | LTE-only, so no GSM burst |

**Not manufacturer-verified here:** Quectel EG915U-EU, EC200U-EU and EG25-G, and u-blox LARA-R6801.
quectel.com was blocked, so their band lists are search extracts only (Phase 1). Verify them before
choosing one.

## 2. Options compared

| Option | Bands (verified) | Power | Availability | Cost (USD, extract) | Notes |
|---|---|---|---|---|---|
| **LILYGO T-A7670G** (ESP32-WROVER + A7670G) | All SA | 2 A GSM bursts | LILYGO store, AliExpress | ~30–45 | Best band coverage on an integrated board |
| LILYGO T-A7670E (ESP32-WROVER + A7670E) | No B28 | 2 A GSM bursts | As above | ~30 | Fine in metro areas on Vodacom/MTN; weaker rural |
| ESP32-S3 + SIM7672E (discrete or carrier board) | All SA FDD | **746 mA peak**, lowest sleep | Module through distributors; LILYGO board availability **UNKNOWN** | Module ~15–25 (estimate) | Best automotive power profile; more design work |
| LILYGO T-SIM7670G-S3 (ESP32-S3 + SIM7670G) | **Not verified**: SIM7670G document not read | — | LILYGO | — | Check the SIM7670G datasheet first |
| ESP32 + Quectel EG915U-EU / EC200U-EU | Extract only | — | Distributors | — | Verify from Quectel documents |
| LTE-M/NB-IoT (SIM7080G, BG95, SARA-R5) | — | Lowest | — | — | **Rejected**: no consumer service in SA |

LILYGO T-A7670X board facts, from the schematic (`schematic/esp32/T-A7670X-V1.4.pdf`, read):
classic **ESP32-WROVER** module, **CH9102F** USB-UART, and 18650/solar inputs. It is a consumer
development board with no automotive front-end. Its own quiescent draw (USB-UART, LEDs,
regulators) must be **measured**.

## 3. Recommendation

| Stage | Choice | Why |
|---|---|---|
| **Bench (buy now)** | **LILYGO T-A7670G** (or T-A7670E if G is unavailable) | Verified SA bands; integrated; mature examples (TinyGSM fork) |
| **Vehicle build** | ESP32-S3 + **SIM7672E** (or A7670G if the supply is sized for 2 A bursts) | All SA FDD bands, 746 mA peak, sub-mA sleep |

**MCU choice:**
- **ESP32-S3** for the vehicle build: two Xtensa cores, USB-OTG, flash encryption + secure boot v2, enough GPIO and RAM for TLS. Good ESP-IDF support.
- **ESP32-C3** is viable: single RISC-V core, secure boot v2 and flash encryption, low power, fewer GPIO.
- **Classic ESP32 (WROVER)** is fine on the bench. For production, secure boot v2 needs ECO3 silicon or later; **check the module revision**.

## 4. SIM, antennas and data

- **SIM:** RICA-registered Vodacom or MTN prepaid with a monthly recurring bundle (about R29 for 240 MB/month, Phase 1 extract). Out-of-bundle charges disabled.
- **Antennas:**
  - An LTE antenna covering 698–960 MHz and 1710–2690 MHz, so that B28/B20/B8 low bands and B1/B3/B7 are included.
  - Mount it outside the metal cabin shadow, for example on the windscreen edge.
  - GNSS antenna optional.
- **Data:** about 1–4 MB/month (Phase 1 SIM_FEASIBILITY.md §8). This must be measured on the bench (BENCH_TEST_PLAN.md §5).

## 5. Sourcing in South Africa

- **Rand prices:** no South African retail prices were found (Phase 1). LILYGO boards are usually imported (AliExpress or the LILYGO store) with 15% VAT plus duties.
- **ICASA type approval:** check whether the module or board variant already holds ICASA type approval before any non-personal use (SIM_FEASIBILITY.md §7).
- **Estimate:** see PHASE2_DECISION.md §4.
