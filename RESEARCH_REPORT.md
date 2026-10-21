# EVO-START LTE in South Africa: research report

Vehicle: 2017 Audi A6 C7.5 2.0 TDI, RHD, automatic, push-to-start, South Africa.
Installed: Fortin EVO-ONE (bypass fw 60.12, RS fw 1.31), DCryptor programmed, wire-to-wire
install per Fortin guide #79791, working factory-key 3× Lock remote start, no Fortin RF kit.

Companion documents:
[ARCHITECTURE.md](ARCHITECTURE.md) · [HARDWARE_RESEARCH.md](HARDWARE_RESEARCH.md) ·
[SIM_FEASIBILITY.md](SIM_FEASIBILITY.md) · [CUSTOM_CONTROLLER_DESIGN.md](CUSTOM_CONTROLLER_DESIGN.md) ·
[IMPLEMENTATION_ROADMAP.md](IMPLEMENTATION_ROADMAP.md)

---

## 1. Executive summary

1. **A North American EVO-START LTE cannot work on South African networks, whatever SIM is fitted.**
   Fortin's user guide lists the Quectel EC21-A modem (FCC ID XMR201606EC21A). That modem supports
   LTE B2/B4/B12 and WCDMA B2/B4/B5. South African operators run LTE on B1/B3/B8/B20/B28/B38/B40 and
   3G on B1/B8, so there is **no band overlap at all**. A local SIM, a different APN or eSIM
   provisioning cannot fix a radio band mismatch. This rules out **Option B** in practice.
2. **Fortin sells the product for the US and Canada and region-locks it.** A Canadian unit works only
   in Canada and a US unit only in the US. Coverage is described as "North America". The
   subscription costs USD/CAD 49.95/year. An "EU version" exists (sold in Estonia for about €509),
   but its modem, SIM and roaming terms are not public, and South Africa is not a listed market.
   **Option A** is possible only if Fortin or a distributor confirms in writing that a specific unit
   and plan work in South Africa.
3. **The existing code in this repository (`src/`) is a client for Fortin's cloud.** It needs a
   working EVO-START LTE plus an active subscription, so on its own it cannot remove the hardware
   or subscription dependency. Its cloud protocol also has weak security (plaintext TCP, session key
   sent in clear, unauthenticated replies; see §5). That is relevant if anyone considers relying on
   that cloud.
4. **Option C, an independent ESP32 + LTE Cat-1 controller, is technically straightforward and
   cheap.** Estimates: about USD 60–90 in parts, about 1–3 MB of data a month, and about R0–30 a
   month in running costs. It **depends on one fact this research could not verify**: whether
   the EVO-ONE, as installed per guide #79791, has a **Fortin-documented input for triggering remote
   start** that an external dry contact can drive. This must be confirmed from Fortin documentation
   or Fortin support (Roadmap Phase 0) before any hardware is bought.

### Recommendation

**Option C**, gated on Phase 0. Build an independent controller that triggers the EVO-ONE **only
through a Fortin-documented input**, with end-to-end signed commands (prototype in
`poc/secure-command/`). It must make no connection to the vehicle CAN bus, the immobiliser or the
EVO-ONE's proprietary data-link port.

- **If Phase 0 finds no documented input**, the fallback is Option A, but only with Fortin's
  written confirmation of South African support.
- **If neither is possible**, keep the working factory-key 3× Lock start. Do **not** adopt any
  approach that leaves a working key in the car (§7).

## 2. Scope, method and limitations

| Item | What was done |
|---|---|
| Local repository | Read every file (571 lines, one commit `36930af "Initial release"`). Added offline tests (`test/`) and a PoC (`poc/`). |
| External research | Public web sources only: Fortin manuals and FAQs, FCC/ISED records, retailer listings, operator and regulator pages. **Limitation:** page fetches failed in this environment (DNS/proxy). External claims come from search-engine extracts of the cited pages and are labelled accordingly. Re-check them before anything is bought. |
| Android static analysis | **Not repeated in this session**: the APK could not be downloaded. Findings come from the repository's existing write-up (`LESSONS.md`) and code. The method for repeating it is in §4.3. |
| Live testing | **None.** No real vehicle, Fortin cloud server, ZXY268 server or connected device was contacted. Tests run on loopback only. |
| Deliberately out of scope | Reverse engineering or emulating the EVO-ONE's proprietary data-link/telematics port, the immobiliser bypass, or the vehicle CAN bus. See §6. |

### Evidence labels used in all documents

- **VERIFIED (local)**: read in this repository; the file and line are cited.
- **VERIFIED (test)**: shown by a test in `test/` that passes (`npm test`).
- **SOURCE**: stated by a cited external page, based on a search extract. The full page was not opened in this session.
- **INFERRED**: an engineering deduction from the evidence above.
- **UNKNOWN**: not found; it must be confirmed.

## 3. What the repository contains

| File | Role | Notes |
|---|---|---|
| `src/zxy.js` | Client for the hyll/ZXY268 cloud protocol | Framing: `%08d` length + JSON + HMAC-SHA1 (`src/zxy.js:6-10`, `:42-62`, `:64-85`) |
| `src/server.js` | HTTP relay; keeps one cloud session warm | Token-gated `/cmd/*` (`src/server.js:57-61`, `:72-77`); 2-minute keepalive (`:55`) |
| `src/smarthome.js` | Optional Google Smart Home OAuth + fulfilment | Devices modelled as switches (`src/smarthome.js:15-27`) |
| `LESSONS.md` | Reverse-engineering notes | Servers, ports, transaction and return codes (`LESSONS.md:30-54`) |
| `README.md` | Setup | Cloud dependency and single-session limitation (`README.md:31-38`, `:58`) |

Git history: one commit (`36930af`, 2026-08-10). There are no other branches beyond `main` and the
working branch. No upstream remote was added.

## 4. EvoStart cloud protocol and the Android app

### 4.1 Protocol (VERIFIED local, VERIFIED test)

- **Transport:** plaintext TCP to the command server on port 3050, one connection per transaction (`src/zxy.js:64-73`).
- **Frame:** 8 ASCII digits holding the UTF-8 byte length, then the body (`src/zxy.js:66`). Test: `test/zxy.test.js` "send() writes an 8-digit…".
- **Body:** a `{sys_head, app_head, body}` JSON envelope followed by an uppercase HMAC-SHA1 suffix (`src/zxy.js:49-61`).
- **Login (`100010`):** `paswd = SHA1(password)` uppercase (`src/server.js:40`). The reply contains `uid`, `ssk` and `txnkey` (`src/server.js:42`).
- **Login-family frames are signed with an empty HMAC key** (`src/zxy.js:45-48`). Test: "login frame … EMPTY key".
- **Commands (`3031xx`):** signed with the session `txnkey` (`src/zxy.js:48`, `:61`). The control codes are in `src/zxy.js:23-30`, and the fuller list is in `LESSONS.md:49-50`.
- **Freshness:** the only per-frame freshness fields are `consumer_ssn` (uid + timestamp + a 4-digit counter) and `trans_date`/`trans_time` (`src/zxy.js:36-40`, `:51-53`). Whether the server rejects replays is **UNKNOWN** and was not tested.
- **Sharding:** the server can redirect clients with `SCDM06` (`LESSONS.md:45`). Accounts are region-sharded (`LESSONS.md:12`).
- **Single session:** a login from the relay logs out the phone app (`README.md:58`, `LESSONS.md:13`).

### 4.2 Platform identity (SOURCE + INFERRED)

The servers `zxy268.com` / `htrack.cn` / `topm2m.net` (`LESSONS.md:36-43`) and the `com.hyll`
SDK (`LESSONS.md:7`) belong to a white-label Chinese telematics stack.

- **SOURCE:** the `d.zxy268.com` domain hosts the app for the CHADWICK 886BT-X5 kit's BLEKey [H34].
- **SOURCE:** the BTKey app publisher is Shenzhen Zhongxinyou M2M Technology Co. [H36][H37].
- **INFERRED:** "ZXY" = **Z**hong**X**in**Y**ou.
- **UNKNOWN:** no public source ties Fortin to this ODM by name.

### 4.3 Android static analysis: status and method

The APK was not obtainable in this session. To repeat the analysis (read-only, no device control):

1. `adb shell pm path com.fortin.evostart1` → `adb pull` (`README.md:75`).
2. `jadx --no-res -d out base.apk` (`LESSONS.md:57`). Focus on `com.hyll` (`LESSONS.md:7`).
3. Look for: certificate pinning (none is expected, because the transport is plaintext); whether
   the response HMAC is checked on the client; the BLE pairing and key-exchange code; push (MQTT
   `d.zxy268.com:3313`, `LESSONS.md:40`); and APN/region strings.
4. Record findings in `LESSONS.md`. Never commit account identifiers, `tid` or tokens.

### 4.4 Firmware

- **SOURCE:** Fortin modules update through FlashLink Manager/Updater or FlashLink Mobile [H27][H28].
- **UNKNOWN:** no public EVO-START LTE modem or application firmware files were found, and no teardown.
- **UNKNOWN:** whether the LTE module updates over the air.

## 5. Security assessment

### 5.1 Fortin/ZXY268 cloud protocol (VERIFIED local unless noted)

| # | Finding | Evidence | Impact |
|---|---|---|---|
| S1 | No TLS on the command channel | `src/zxy.js:6`, `:68` (`net.connect`) | Anyone on the network path can read all traffic. |
| S2 | The session HMAC key `txnkey` is returned in clear in the login reply | `src/server.js:42` | A passive observer of one login can forge signed commands for that session. |
| S3 | The password is sent as an unsalted SHA-1 | `src/server.js:40` | The hash works as the password for this protocol. It is also crackable offline and reusable. |
| S4 | Login frames are signed with an empty key | `src/zxy.js:45-48`; test | The signature is a checksum, not authentication. |
| S5 | Replies are not authenticated by the client: the HMAC suffix is removed, never checked | `src/zxy.js:89` | An on-path attacker could fake `000000` "success" or spoof status. |
| S6 | Replay protection depends only on server-side `consumer_ssn`/time checks | `src/zxy.js:36-40` | Behaviour is **UNKNOWN**. Do not assume replays are rejected. |
| S7 | Region redirect (`SCDM06`) can point clients at another host | `LESSONS.md:45` | Whether the official app checks the target is UNKNOWN. The relay does not follow redirects. |

**Conclusion (INFERRED):** the cloud protocol does not give the confidentiality, command
authenticity or replay protection expected for a system that can start an engine and unlock doors.
That is one more reason to prefer an architecture where commands are signed end to end on the phone (§8).

### 5.2 This repository's relay (VERIFIED local)

| # | Finding | Evidence | Suggested fix (not applied, to preserve behaviour) |
|---|---|---|---|
| R1 | The secret is accepted in the query string, so it can end up in proxy and access logs | `src/server.js:58` | Prefer the `Authorization` header. Document how to scrub logs. |
| R2 | `GH_CLIENT_SECRET` and `GH_LINK_SECRET` fall back to `RELAY_SECRET` | `src/server.js:33` | Require distinct values. |
| R3 | Reflected HTML injection: `state`, `redirect_uri` and `client_id` are inserted into the page unescaped | `src/smarthome.js:46-50` | HTML-escape them. |
| R4 | `client_secret` is compared without a timing-safe compare | `src/smarthome.js:70` | Use `crypto.timingSafeEqual`. |
| R5 | `redirect_uri` is stored with the auth code but not checked at token exchange | `src/smarthome.js:63`, `:72-73` | Compare it per RFC 6749 §4.1.3. |
| R6 | Refresh tokens never expire and cannot be revoked | `src/smarthome.js:75`, `:79` | Add expiry, rotation and a revoke endpoint. |

These are low-risk for a single user behind HTTPS, but they should be fixed before any wider use (Roadmap Phase 1).

## 6. EVO-ONE interface research

**Verified (from the user's installation):**
- The EVO-ONE is installed wire-to-wire per guide #79791, with DCryptor programming.
- Remote start works with the factory key (3× Lock). This proves the EVO-ONE's remote-start logic
  is fully functional and receives its trigger from the vehicle side.

**SOURCE (public Fortin material):**
- The EVO-START LTE plugs into the **small blue port** on the EVO-ONE (not the T-harness) [H9].
- Older guides describe the ports as Port A (white 16-pin, antenna), Port B (blue 4-pin female) and
  Port C (blue 4-pin male) [H10].
- Fortin calls this a "2-way datalink port" for "equipped telematic units" [H6][H7].
- If an RF kit is added, it is programmed with the EVO-START unplugged [H8][H10].

**Deliberate boundary.** Fortin publishes no specification for this port. Its protocol links to
the module that holds the immobiliser bypass for the vehicle. Reverse engineering or emulating it,
or tapping the vehicle CAN bus, could:
- break the bypass's safety logic, such as the conditions under which a start is refused;
- create a new remote path for unlocking or starting the car;
- void Fortin support.

So this research **does not** investigate or propose such interfacing. "RS-232/data-link
interface research" stops at the documented facts above.

**Open question that decides Option C (UNKNOWN):** does the EVO-ONE, in this install
configuration, have a Fortin-documented hard-wired input (or programmable option) that starts and
stops the engine when driven by an external contact, with every EVO-ONE safety check still active?
Sources to check:
- the EVO-ONE section of guide #79791 and the EVO-ONE function/option list;
- FlashLink Manager option descriptions;
- Fortin technical support (ask for the documented integration point for a third-party telematics trigger).

The same question applies to a documented **status output** (for example remote-start-active).

> **Phase 2 update:** see [EVO_ONE_INTERFACE_RESEARCH.md](EVO_ONE_INTERFACE_RESEARCH.md) and
> [PHASE2_DECISION.md](PHASE2_DECISION.md). Fortin's option tables name Function #38 mode 3,
> "Start/Stop on trigger shock sensor". Its electrical details and its coexistence with 3× Lock
> await Fortin confirmation. The RS-232 data-link has no public third-party specification.

## 7. Approaches considered and rejected

| Approach | Why it is rejected |
|---|---|
| A spare factory key or key board left in the car, "pressed" by a relay | On a keyless push-to-start car, a working key inside the vehicle defeats the immobiliser and lets anyone drive it away. It may also void insurance. |
| Fitting a South African SIM into a North American EVO-START LTE | No LTE or 3G band overlap (§1.1, SIM_FEASIBILITY.md). |
| Swapping the modem inside the EVO-START LTE | Needs hardware modification of an undocumented unit. It would still depend on Fortin's region-locked cloud and subscription. ICASA type approval would be lost or unclear. |
| Emulating the EVO-START on the blue data-link port | Undocumented, and tied to the security bypass (§6). Out of scope by design. |
| Controller on the CAN bus or OBD port | It could interfere with safety-relevant ECUs and brings a direct vehicle attack surface. Not needed. |

## 8. Options compared

| Criterion | A: official international EVO-START LTE | B: modified LTE + SA connectivity | C: independent ESP32/LTE controller |
|---|---|---|---|
| Works on SA networks | UNKNOWN; only an EU-variant unit might have suitable bands | **No** (NA unit bands); a modem swap is hardware surgery | **Yes**: choose a module with B1/B3/B8/B20/B28 |
| Integration with EVO-ONE | Native, supported (blue port) | Native port, but modified hardware | Only through a **documented** input (Phase 0 gate) |
| Recurring cost | ~USD/CAD 50/yr, if Fortin will sell an SA plan; roaming status UNKNOWN | Subscription + local SIM | About R0–30/month data + optional ~USD 5/month server (or self-hosted at home) |
| Up-front cost | About €509 (EU retail) | Unit + modem + labour | About USD 60–90 in parts (HARDWARE_RESEARCH.md §5) |
| Security | Weak cloud protocol (§5.1); vendor-controlled | Same, plus unknowns | End-to-end Ed25519, counter + time window, own keys (PoC tested) |
| Maintainability | Vendor-maintained; can be withdrawn | Poor | Yours to maintain; open components |
| Features | Rich: GPS, status, BLE, sharing | Same | Start/stop/lock/unlock + GPS + battery voltage; status depends on documented outputs |
| Risk to vehicle | Low (Fortin-supported) | Medium | Low **if** limited to a documented input with no bus connection |

## 9. Final decision

**Recommended: Option C**, built in phases (IMPLEMENTATION_ROADMAP.md). The first, gating step
costs nothing: confirm the documented EVO-ONE trigger input with Fortin.

- **If Fortin confirms a documented input:** build Option C. Expect about USD 60–90 one-off and
  a few rand a month, on Vodacom or MTN LTE.
- **If Fortin says no such input exists, but will supply a unit and plan confirmed for South
  Africa:** use Option A, and accept its cloud's security posture (§5.1).
- **If neither:** stay on factory-key 3× Lock remote start. Optionally ask Fortin about a
  Bluetooth-only accessory (EVO-START-BT appears in FCC records [H19][H20]; its EVO-ONE
  compatibility and subscription terms are UNKNOWN) for short-range smartphone control.

Option B is not recommended.

## 10. Sources

Local file and line references are given inline. External sources are listed in
[HARDWARE_RESEARCH.md § Sources](HARDWARE_RESEARCH.md#sources) (prefix `H`) and
[SIM_FEASIBILITY.md § Sources](SIM_FEASIBILITY.md#sources) (prefix `N`).
