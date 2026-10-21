# Hardware research

Evidence labels follow [RESEARCH_REPORT.md §2](RESEARCH_REPORT.md#2-scope-method-and-limitations).
External claims are **SOURCE** (from search extracts of the cited page) unless marked otherwise.
Re-check them before buying anything.

## 1. Fortin EVO-START LTE

### 1.1 Product identity

| Item | Finding | Label |
|---|---|---|
| SKUs | `EVO-START-LTE` ("3rd gen"); `EVO-START LTE-USA` (MPN 0482120006030); `FOREVOSTART`; bundles `EVO-ONE-LTE`, `EVO-ALL-LTE`, `EVO-START-PKG` | SOURCE [H1–H6] |
| Box contents | 1 × EVO-START LTE module, 1 × connecting cable | SOURCE [H1][H5] |
| Hosts | EVO-ONE, EVO-X-ONE, EVO-ALL (E400 in guide #102151) | SOURCE [H7][H8] |
| Connection | Blue connector into the EVO-ONE's small blue port, not the T-harness | SOURCE [H9] |
| Extra wiring | Yellow wire to ignition for tachless mode (option 20.2) | SOURCE [H11] |
| Link type | Fortin "2-way datalink port". No public pinout or protocol. It is not OBD. Whether it is RS-232 is UNKNOWN. | SOURCE [H6][H7] / UNKNOWN |

### 1.2 Cellular modem

| Item | Finding | Label |
|---|---|---|
| Regulatory ID in Fortin's user guide #102171 | "EVO-START antenna: FCC ID XMR201606EC21A / IC 10224A-201611EC21A" | SOURCE [H12][H13] |
| Module | Quectel **EC21-A** (grantee XMR = Quectel), LTE Cat 1, Qualcomm MDM9207 | SOURCE [H14][H15][H16] |
| LTE bands | **B2 / B4 / B12** | SOURCE [H14][H15] |
| 3G bands | WCDMA B2 / B4 / B5 | SOURCE [H15] |
| 2G | The research extract mentions GSM; the EC21-A datasheet should be checked. | UNKNOWN |
| Fortin's own LTE FCC filing | None found under grantees 2ACKU or 2APEH. Fortin probably relies on Quectel's modular grant. | SOURCE [H17][H18] / INFERRED |
| EU or "3rd gen" variant modem | Not published. It might be an EC21-E or similar. | UNKNOWN |

**INFERRED (decisive):** EC21-A bands have **no overlap** with South African bands
(SIM_FEASIBILITY.md §2), so a North American unit cannot register on any SA network.

### 1.3 SIM, subscription and region

| Item | Finding | Label |
|---|---|---|
| SIM form | An EU-version user reports "SIM card inside, activated" and binding by QR device ID with default passcode 888888 | SOURCE [H21] |
| Carrier | A retailer listing fragment mentions "LTE Verizon X1 Sim Card". This conflicts with the EC21-A bands, which lack Verizon B13. | SOURCE [H3] / UNKNOWN |
| Coverage | "Global cellular network with a range covering North America (United States and Canada)". A Canadian unit works only in Canada; a US unit only in the US. | SOURCE [H22][H23][H24] |
| Subscription | 1 year $49.95, 3 years $129.95 (CAD according to a reseller). Canada units include 3 years; US units include 1 year. "An active EVOStart subscription is required." | SOURCE [H12][H24][H25] |
| Activation | App account, then a 9-character activation code from page 1 of the guide (reported to expire after about 48 h), then name the vehicle. Renew via service@fortin.ca with the 810-prefixed device number. | SOURCE [H12][H26] |
| Without subscription | What still works (for example Bluetooth only) | UNKNOWN |

### 1.4 Firmware and features

- **Updates:** host modules update through FlashLink Manager + FlashLink Updater (USB), or FlashLink Mobile (BLE) [H27][H28]. Updates for the LTE module itself, public firmware files and teardowns: **UNKNOWN / none found**.
- **Features:** start/stop, lock/unlock, trunk and AUX, alarm notifications, multi-user, battery voltage, interior temperature, GPS with 60-day history and geofences [H7][H29][H30].
- **Links:** a hybrid of Bluetooth and cellular [H22][H31].
- **Fuel level:** "not supported for about 99.9% of vehicles" [H9].

### 1.5 Availability outside North America

- **SOURCE:** sold in Estonia for €509 [H33]. An "EU version" exists [H21].
- **Not found:** South African, Australian or Middle East reports. Fortin's official materials describe only US and Canada coverage.

## 2. Fortin EVO-ONE (installed)

| Item | Status |
|---|---|
| Firmware | Bypass 60.12, remote start 1.31 (user-reported) |
| Install | Wire-to-wire per guide #79791; DCryptor done (user-reported) |
| Remote start trigger | Factory key 3× Lock, working (user-reported) |
| Ports | Blue 4-pin data-link / antenna ports (SOURCE [H10]) |
| Documented external start/stop input | **UNKNOWN. This is the Option C gate** (RESEARCH_REPORT.md §6) |
| Documented status output | **UNKNOWN** |

This research does not cover the internals of the data-link port or the bypass (RESEARCH_REPORT.md §6).

## 3. Cellular modules for a custom controller

South Africa needs FDD B1/B3/B8, plus B20/B28 for rural coverage, and TDD B38/B40 for Rain and Telkom (SIM_FEASIBILITY.md §2).

| Module | Category | Bands (SOURCE) | SA fit (INFERRED) | Notes |
|---|---|---|---|---|
| **SIMCom A7670E / A7672E** | Cat 1 | LTE B1/3/5/7/8/20, GSM 900/1800 [N47][N48] | **Good**: Vodacom, MTN, Cell C. No B28 or TDD. | Cheapest; LILYGO T-A7670E ESP32 board from about $30 [N58] |
| **Quectel EG915U-EU** | Cat 1 | LTE B1/3/5/7/8/20/28, GSM [N51] | **Very good**: all SA FDD bands | |
| **Quectel EC200U-EU** | Cat 1 | As above + B38/40/41 [N52] | **Best Cat-1 fit** | |
| SIMCom SIM7600G-H | Cat 4 | Global FDD + TDD, 3G, 2G [N49] | Full coverage | More cost and power; LILYGO T-SIM7600 about $50–63 [N58][N60] |
| Quectel EG25-G | Cat 4 | Global FDD + TDD, 3G, 2G [N53] | Full coverage | More power |
| u-blox LARA-R6801 | Cat 1 | B1/3/7/8/20/28 [N56] | Good | Industrial, more costly |
| SIMCom SIM7080G, u-blox SARA-R5, Quectel BG95 | LTE-M / NB-IoT | — | **Poor**: no consumer LTE-M or NB-IoT in SA (SIM_FEASIBILITY.md §4) | Avoid |
| u-blox LARA-R6401, SIMCom SIM7600A-H | NA only | B2/4/5/12/13/… | **Will not work** | Avoid |

**Primary pick for prototyping: LILYGO T-A7670E** (ESP32 + A7670E, with GNSS on some variants).
**Production pick:** EC200U-EU or EG915U-EU, for B28 rural coverage. Confirm ICASA type approval
of the exact module variant first (SIM_FEASIBILITY.md §7).

## 4. Supporting hardware (custom controller)

| Part | Purpose | Requirement |
|---|---|---|
| Automotive buck converter, 12 V → 5 V/3.8 V | Power | Wide input range (6–36 V), load-dump/TVS protection, and enough current for the modem's ~2 A transmit bursts (INFERRED from typical Cat-1 datasheets) |
| Inline fuse (≤ 3 A) | Protection | Fit at the tap point |
| Optocoupler or small signal relay (dry contact) | Galvanically isolated trigger into the **documented** EVO-ONE input only | Rated for the input's documented voltage and current |
| Voltage divider into the ESP32 ADC | Battery voltage and low-voltage cut-off | High impedance (µA draw) |
| LTE antenna (+ GNSS antenna) | RF | Mount away from the bypass module and wiring |
| IP-rated enclosure | Mounting | Under-dash, away from airbag and pedal areas |

**Parasitic draw (INFERRED):**
- An idle ESP32 in light sleep plus a Cat-1 modem in DRX probably draws on the order of 5–30 mA. Measure it.
- At 30 mA that is about 0.7 Ah/day, or about 10 Ah over two weeks. Hence the firmware low-voltage
  cut-off (CUSTOM_CONTROLLER_DESIGN.md §6).
- The C7 A6 has battery energy management. Where the supply tap connects relative to the battery
  monitoring sensor is a question for the installer. **UNKNOWN; verify.**

## 5. Cost estimates

Exchange-rate **assumption**: R18/USD and R20/EUR. Prices are SOURCE retail-in-USD where cited;
everything else is an INFERRED estimate. No rand retail prices were found.

| Item | USD | ZAR (approx.) |
|---|---|---|
| LILYGO T-A7670E (ESP32 + modem) | 30–45 | 540–810 |
| Buck converter, fuse, opto/relay, divider, connectors | 10–20 | 180–360 |
| LTE + GNSS antennas | 8–15 | 145–270 |
| Enclosure, harness, sundries | 10–15 | 180–270 |
| **Total, Option C prototype** | **60–95** | **~1,050–1,700** |
| Shipping and import VAT (15%) | +20–40% | |
| *Comparison:* EVO-START LTE (EU retail) | ~550 (€509) | ~10,200 |
| *Comparison:* Fortin plan | 49.95/yr | ~900/yr |

## Sources

- H1 https://basselectronics.ca/products/fortin-evo-start-lte-3rd-gen
- H2 https://lockdownsecuritycanada.ca/products/evo-start-lte-smartphone-controller-usa-version-1-year-subscription-included
- H3 https://gofst.com/product/fortin-evo-start-lte/
- H4 https://jbspowercentre.com/products/fortin-evo-start-lte-mobile-remote-control-and-tracking-evo-start-pkg
- H5 https://www.ebay.com/itm/116201662466 ; https://www.ebay.com/itm/127103046620
- H6 https://fortin.ca/en/products/all-in-one-bundles/evo-all-lte/
- H7 https://fortin.ca/en/products/remote-control-and-fleet-management-applications/evo-start+lte/
- H8 https://fortin.ca/download/102151/EVO-ONE_IG_EVO-START_QUICK-GUIDE_F_102151.pdf
- H9 https://wirecolor.com/qa/123272/lexus-nx300-fortin-evo-one-with-evo-start-lte-cannot-remote-start-with-app
- H10 https://www.wirecolor.com/en/qa/134432/installing-evo-start-lte-on-evo-one-with-exsiting-rf-kit
- H11 https://www.wirecolor.com/qa/126825/evo-one-start-lte-on-2000-ford-mustang-convertible-not-working
- H12 https://fortin.ca/download/102171/BAS-UG_BI_EVO-START_B_102171.pdf
- H13 https://evo-start.ca/files/5597/evo-start-lte-user-guide-en-fr.pdf
- H14 https://fccid.io/XMR201606EC21A
- H15 https://techinfodepot.shoutwiki.com/wiki/Quectel_EC21-A
- H16 https://quectel.com/content/uploads/2024/03/Quectel_EC21_Series_LTE_Standard_Specification_V2.4-1.pdf
- H17 https://fccid.io/2ACKU
- H18 https://fccid.io/2APEH
- H19 https://device.report/fccid/2ackuantnfcbt
- H20 https://docplayer.net/188055045-Activation-code-phone-application-user-guide-phone-not-included-evo-start-bt-antenna-fcc-id-2acku-antnfcbt-ic-12084a-antnfcbt.html
- H21 https://www.wirecolor.com/en/qa/131434/how-to-bind-the-device-in-evo-start-lte-app
- H22 https://evo-start.ca/en/resources/faq
- H23 https://evo-start.ca/en/products/evo-start-lte
- H24 https://lockdownsecuritycanada.ca/products/fortin-evo-start-lte-smartphone-controller-with-4g-lte-and-gps
- H25 https://evo-start.ca/en/plans
- H26 https://www.wirecolor.com/en/qa/129288/how-do-you-renew-your-evo-start-lte-when-included-plan-is-almost-expired
- H27 https://fortin.ca/en/products/installation-programming-tools/flashlink+updater/
- H28 https://fortin.ca/en/products/installation-accessories/FLASHLINK+MOBILE/
- H29 https://fortin.ca/en/resources/fleet-management-and-tracking-with-evo-start-lte/
- H30 https://fortin.ca/en/resources/evo-start-lte/
- H31 https://apps.apple.com/us/app/evostart/id6443850421
- H33 https://www.autoextra.ee/en/a/fortin-evo-start-lte
- H34 https://manuals.plus/asin/B0CD7THQFH
- H36 https://apps.apple.com/us/app/btkey/id1538007835
- H37 https://apps.apple.com/us/developer/shenzhen-zhongxinyou-m2m-technology-co-ltd/id1489982535
- N-prefixed sources: see [SIM_FEASIBILITY.md § Sources](SIM_FEASIBILITY.md#sources).
