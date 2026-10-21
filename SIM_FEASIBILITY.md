# SIM and network feasibility: South Africa

Evidence labels follow [RESEARCH_REPORT.md §2](RESEARCH_REPORT.md#2-scope-method-and-limitations).
External claims are **SOURCE** (search extracts) unless marked otherwise. Operator band use
changes; confirm with the operator before relying on any table here.

## 1. Question

Can an EVO-START LTE, or a custom controller, run on a South African SIM, and at what cost?

## 2. South African LTE bands

| Operator | LTE bands | Label |
|---|---|---|
| Vodacom | B3 (1800), B1 (2100), B8 (900). 700 MHz and 2600 MHz won at the 2022 auction; 700 MHz upgrades are under way | SOURCE [N1][N2][N3][N4]; B28/B7 mapping INFERRED |
| MTN | B3, B1, B8. 800 MHz and 2600 MHz won in 2022 | SOURCE [N5][N1]; B20/B7 deployment UNKNOWN |
| Cell C | Own radio network shut down (2023). Customers roam on MTN (prepaid) and Vodacom (postpaid) | SOURCE [N10][N11] |
| Telkom | B40 (TDD 2300) core; 800 MHz won in 2022 | SOURCE [N6][N7][N1] |
| Rain | B3, B38 (TDD 2600), 5G n78; 700 MHz won | SOURCE [N8][N9][N1] |

**Target band set for a device (INFERRED):** B1 / B3 / B8 is essential, B20 / B28 is strongly
preferred for rural coverage, and B38 / B40 is optional.

## 3. Band overlap: North American EVO-START LTE

Bands are taken from the EC21-A module listed in Fortin's guide (HARDWARE_RESEARCH.md §1.2).

| Technology | EC21-A | South Africa | Overlap |
|---|---|---|---|
| LTE | B2 (1900 PCS), B4 (AWS 1700/2100), B12 (700 lower-A/B/C) | B1, B3, B8, B20, B28, B38, B40 | **None** |
| WCDMA | B2, B4, B5 | B1 (2100), B8 (900), being retired | **None** |

**Why there is no overlap even where frequencies look close (INFERRED, standard 3GPP band plans):**
- B4's downlink (2110–2155 MHz) falls inside B1's, but B4 transmits at 1710–1755 MHz while B1 needs
  an uplink of 1920–1980 MHz. The device cannot transmit on a B1 network.
- B12's 700 MHz duplex plan is different from B28's (APT 700).

**Conclusion:** no SIM, APN or eSIM profile can make a North American EVO-START LTE register on a
South African network. **The SIM is not the obstacle; the radio is.** Unit-level roaming would not
help either, because roaming still needs a shared band.

**EU variant:** if it uses an EC21-E-class module (B1/B3/B5/B7/B8/B20), it would overlap
well with South African bands. Its modem is **UNKNOWN**. Even with matching bands, the
SIM is Fortin-provisioned and region-locked (HARDWARE_RESEARCH.md §1.3). Whether that SIM roams in
South Africa, and whether Fortin's terms allow it, are **UNKNOWN**. Only Fortin can answer.

## 4. 2G/3G sunset and LPWA

- **2G/3G sunset:**
  - In July 2025 the government dropped firm switch-off deadlines [N12][N13]. Older sources still cite 2027 [N17].
  - MTN is cutting 3G area by area, with targets reported for end-2025 and end-2026 [N14][N15][N16].
  - Vodacom expects 3G to go before 2G [N12].
  - **Do not buy 2G/3G-only modems.**
- **NB-IoT:** Vodacom runs NB-IoT on 900 MHz, but only via managed/private APNs for business
  [N19][N20][N21][N22]. **LTE-M:** no confirmed commercial service in South Africa [N21][N24].
  **Use LTE Cat 1 or Cat 1bis.**

## 5. SIM options for a custom controller

| Option | Cost (SOURCE where cited) | Pros | Cons / UNKNOWN |
|---|---|---|---|
| **Vodacom prepaid + monthly recurring bundle** | 240 MB monthly for R29 [N37] | Native network, no roaming risk, simple | RICA needed; bundle terms change |
| MTN prepaid | Current small-bundle price not found | Native network | UNKNOWN pricing |
| 1NCE (global IoT) | About $10 one-off for 10 years / 500 MB [N26][N27] | Very low lifetime cost | Which SA partner network it uses is UNKNOWN; permanent-roaming risk |
| KORE / Twilio Super SIM | From $0.10/MB; SA networks: Vodacom and Cell C available, MTN as backup [N28] | Multi-network | Price for SA not public |
| Telnyx | From $0.0625/MB + $1/SIM for SA [N29] | Cheap per MB | Roaming risk |
| Flickswitch / SIMcontrol | Not public [N34] | Local reseller with managed APN | Price UNKNOWN |

**Permanent roaming:** South Africa tolerates long-term use of foreign SIMs under roaming
agreements [N31]. Vendors say operators may block permanent roamers after 90–180 days. **UNKNOWN**
for any specific provider.

**Recommendation (INFERRED):** use a **local Vodacom or MTN prepaid SIM, RICA-registered to the
vehicle owner**, on a small monthly recurring bundle. A 1NCE SIM can be trialled as a second option.

## 6. APN and provisioning

| Operator | APN | Label |
|---|---|---|
| Vodacom | `internet` | SOURCE (third-party guide) [N40] |
| MTN | Third-party sources disagree; one blog says `mtn` | UNKNOWN; check with MTN [N42] |
| Cell C | `internet` | SOURCE [N43] |
| Telkom | `internet` | SOURCE (third-party guide) [N41] |

Controller provisioning:
- The APN is stored in device configuration (NVS), never hard-coded.
- No PIN on the SIM, or the PIN is stored in the encrypted NVS partition.
- Set the bundle to **monthly recurring**, and turn out-of-bundle charges **off**. ICASA rule changes effective 23 Jan 2027 make out-of-bundle charges opt-in [N39].

Fortin unit provisioning (Option A):
- The SIM is factory-fitted and activated by Fortin.
- The device binds to an app account using a 9-character activation code (HARDWARE_RESEARCH.md §1.3).
- The APN is not user-configurable as far as public sources show (**UNKNOWN**).

## 7. Regulatory

- **RICA:** every SIM must be registered with an ID/passport and proof of address [N33][N35]. There is no M2M exemption in the Act [N32]. Whether foreign roaming SIMs need RICA registration is UNKNOWN [N34].
- **ICASA type approval:** radio and terminal equipment needs ICASA type approval, and FCC/CE marks do not substitute [N61][N62][N63]. For a one-off personal build:
  - Prefer a module, or a board containing a module, that already carries ICASA approval for its exact variant.
  - Confirm with ICASA (TALinfo@icasa.org.za) before any commercial or multi-unit use.
  - How module approval transfers to a host device is **UNKNOWN**.

## 8. Data use (custom controller)

| Traffic | Estimate | Label |
|---|---|---|
| MQTT PINGREQ/PINGRESP over TLS + TCP/IP, including ACKs | ~200–300 B per exchange | INFERRED [N64][N65][N67] |
| Keepalive every 15 min | ~0.6–0.9 MB/month | INFERRED |
| Keepalive every 5 min (if carrier NAT needs it) | ~2–2.6 MB/month | INFERRED |
| One full TLS reconnect a day (~6.5 KB) | ~0.2 MB/month | SOURCE/INFERRED [N66] |
| Commands, acks, status (a few a day) | < 0.1 MB/month | INFERRED |
| GPS reports every 15 min while parked | ~0.5–1 MB/month | INFERRED |
| **Total** | **~1–4 MB/month** | INFERRED; measure in the field |

At about R29 for 240 MB/month, data costs **under R30/month**, and the bundle is far larger than
needed. A 1NCE 500 MB / 10-year SIM would last decades at this rate, if it works in South Africa.

## Sources

- N1 https://www.mobileworldlive.com/regulation/south-africa-completes-first-phase-of-delayed-auction/
- N2 https://r-spectrum.com.au/resources/mobile-network-operators/vodacom-south-africa
- N3 https://halberdbastion.com/intelligence/mobile-networks/vodacom-south-africa
- N4 https://www.businessday.co.za/companies/2026-10-08-vodacom-sets-aside-r500m-for-network-investment-in-western-cape/
- N5 https://portal.powertec.com.au/industry-resources/companies/mtn-south-africa
- N6 https://www.frequencycheck.com/carriers/telkom-south-africa
- N7 https://www.engineeringnews.co.za/article/telkom-records-test-speeds-of-over-100-mbs-2013-10-09
- N8 https://www.kimovil.com/es/frequency-checker/ZA
- N9 https://www.news24.com/business/tech/what-you-need-to-know-about-rains-roaming-deal-with-vodacom-20230509
- N10 https://www.connectingafrica.com/connectivity/sa-s-cell-c-migrating-customers-to-roam-on-competitor-networks
- N11 https://en.wikipedia.org/wiki/Cell_C
- N12 https://techcentral.co.za/why-2g-will-outlast-3g-in-south-africa/280940/
- N13 https://flickswitch.freshdesk.com/support/solutions/articles/23000020408-2g-3g-switch-off-in-south-africa
- N14 https://mybroadband.co.za/news/cellular/653722-mtn-switching-off-3g-in-parts-of-south-africa.html
- N15 https://www.datacenterdynamics.com/en/news/mtn-to-retire-3g-in-south-africa-by-end-of-2026/
- N16 https://www.telecomreviewafrica.com/articles/telecom-operators/4742-mtn-south-africa-accelerates-3g-shutdown-timeline
- N17 https://www.emnify.com/blog/global-2g-3g-phase-out
- N19 https://itweb.africa/article/vodacom-rolls-out-commercial-nb-iot-in-gauteng-sa/Gb3BwMW8wDdq2k6V
- N20 https://dataweek.co.za/60692n
- N21 https://flickswitch.freshdesk.com/support/solutions/articles/23000013586-what-is-nb-iot-what-is-the-current-status-of-nb-iot-rollout-in-south-africa-
- N22 https://techafricanews.com/?p=8728
- N24 https://community.particle.io/t/boron-lte-m-for-use-in-south-africa/67142
- N26 https://www.1nce.com/en-us/1nce-connect/features/500-mb-data-volume
- N27 https://www.g2.com/products/1nce-iot-flat-rate/discuss
- N28 https://docs.korewireless.com/en-us/supersim/available-networks
- N29 https://telnyx.com/sim-cards/south-africa
- N31 https://www.cullen-international.com/news/2026/03/Africa-tightens-oversight-of-IoT-connectivity-as-roaming-and-SIM-rules-diverge.html
- N32 https://flickswitch.freshdesk.com/support/solutions/articles/23000016077-rica-sim-registration-south-africa-
- N33 https://www.cellc.co.za/cellc/static-content/PDF/RICA.pdf
- N34 https://mybroadband.co.za/forum/threads/foreign-sim-card-for-m2m-or-iot-legal-in-sa-if-not-ricaed.1016788/
- N35 https://www.itnewsafrica.com/2019/07/vodacom-launches-iot-products/
- N37 https://www.vodacom.co.za/node/20976
- N39 https://businessreport.co.za/business/2026-01-26-relief-for-data-users-in-south-africa-as-icasa-overhauls-bundle-expiry-rules/
- N40 https://briefly.co.za/31110-vodacom-apn-settings-internet-settings-4g-settings-wifi-router-settings.html
- N41 https://briefly.co.za/31103-telkom-apn-mms-mobile-internet-wifi-settings.html
- N42 https://sophiecress.com/blog/mtn-5g-apn-settings-your
- N43 https://www.cellc.co.za/cellc/device-setup-android-phones
- N47 https://cn.simcom.com/product/A7670X.html
- N48 https://my.avnet.com/ebv/products/new-products/npi/2021/simcom-wireless-solutions-a7672x/
- N49 https://www.waveshare.com/product/iot-communication/long-range-wireless/4g-gsm-gprs/sim7600g-h-4g-hat.htm
- N51 https://python.quectel.com/en/products/eg915u-eu
- N52 https://www.4gltemall.com/quectel-ec200u.html
- N53 https://bluerobotics.com/wp-content/uploads/2025/05/Quectel_EG25-G_LTE_Standard_Specification_V1.2.pdf
- N56 https://u-blox.com/en/product/lara-r6-series
- N58 https://lilygo.cc/en-us/collections/t-sim-series
- N60 https://www.maritex.eu/en/products/wireless-modules?page=54
- N61 https://www.icasa.org.za/uploads/files/Type-Approval-Guidelines.pdf
- N62 https://www.icasa.org.za/uploads/files/Type-Approval-Regulations.pdf
- N63 https://evezone.evetech.co.za/quick-bytes/why-some-imported-wireless-gear-needs-icasa-approval
- N64 https://groups.google.com/g/mqtt/c/K0B7wem37j0
- N65 https://docs.devicewise.com/Content/Products/IoT_Portal_API_Reference_Guide/MQTT_Interface/MQTT-data-usage.htm
- N66 https://support.pushy.me/hc/en-us/articles/360044558272
- N67 https://www.hivemq.com/blog/how-does-tls-affect-mqtt-performance/
