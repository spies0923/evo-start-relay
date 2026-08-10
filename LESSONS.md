# Lessons: reverse-engineering EvoStart + wiring it to Google Home

Notes from building this, so the next person skips the dead ends.

## Reverse-engineering the app

- **The app is a thin shell over a white-label platform.** `com.fortin.evostart1` decompiles to ~6 classes; the real logic is in a vendored `com.hyll` package (the "hyll" / ZXY268 telematics platform, also sold as other GPS/remote-start brands). Chase the SDK package, not the app package.
- **`api.<vendor>.ca` was a red herring.** The marketing/CMS API is not the control plane. The control plane is a **persistent plaintext-TCP socket** (`ConnTcp`), with an HTTPS command endpoint as a secondary path.
- **Framing is trivial once you see it:** `PrintWriter.print(String.format("%08d", body.length))` then the body. So: **8 ASCII digits = byte length, then the JSON body.** Miss that length prefix and the server ignores you (a public prior-art repo made exactly this mistake and never connected).
- **Auth:** login is transaction `100010`, `body = {name, paswd}` with `paswd = SHA1(password)` uppercase (verified because the app hard-codes a demo hash that is exactly `SHA1("888888")`). The response returns `uid`, `ssk` (session key) and `txnkey` (the HMAC key for subsequent commands).
- **Signing:** every frame is `JSON + HMAC-SHA1(txnkey, JSON)` uppercase. Login-family codes sign with an **empty** key and blank `ssk`/`uid`.
- **Accounts are region-sharded.** The hardcoded default server had our (email) account returning `SC0006 "Invalid user name"`, while a numeric demo account returned `SC0007 "Invalid Password"` — same envelope, so the format was right; the account simply lived on a different regional server. We found the real one by reading the app's live TCP endpoint from `/proc/net/tcp` (no root). **Lesson: `SC0006` vs `SC0007` told us the envelope was correct long before login succeeded — read the error codes, don't just retry.**
- **Single active session.** Logging in from the relay logs the phone app out and vice-versa. Plan for it (keepalive, re-login on the stale-session ret codes).
- **You don't always need a MITM/proxy.** Pulling the APK (`adb`, read-only) + `jadx` gave the protocol; `adb logcat` gave the live command codes and the terminal id; `/proc/net/tcp` gave the server. No cert-unpinning, no traffic interception.

## Wiring a cloud device into a smart-home assistant (cloud-to-cloud notes)

**Home Assistant users can skip this** — you just hit the HTTP API and let HA bridge to whatever you use. These are notes from the **bundled cloud-to-cloud integration**, implemented against a major assistant's cloud (the only "direct" path — Assistant Actions are dead and routines can't call a webhook). You implement OAuth + `SYNC`/`QUERY`/`EXECUTE`; the same shape applies across assistant clouds. The gotchas:

1. **One malformed device fails the *entire* SYNC.** Add a device Google rejects and it drops your whole device list — *including the ones that were working*. Symptom: you re-sync and everything vanishes except a stale cache. Keep every device to Google's documented shape; add them one kind at a time.
2. **`WATER_HEATER` + a temperature trait was rejected at link time** ("couldn't reach service" right after entering the code). The **canonical `THERMOSTAT` + `TemperatureSetting` (only)** linked first try. Use the textbook type/trait combo; don't get creative.
3. **Changing a device's *capabilities* needs a full unlink + relink.** "Hey Google, sync my devices" refreshes *state* and can add/remove devices, but it will **not** teach Google a new trait on an existing device. If you added a capability and it "isn't there," relink.
4. **Account-linking must answer fast.** Linking runs SYNC *and* an initial QUERY, each within ~5 s. Our QUERY did a cold cloud round-trip (~5 s) and intermittently broke linking. Fix: serve QUERY from a warm in-memory cache, refresh in the background.
5. **You cannot *unlock* a lock from an automation.** Google blocks unlock (and garage-open) as automation actions for safety — the picker only offers "Lock." If you want unlock behind a custom phrase, model the lock as a plain **switch** (on = lock, off = unlock); switches have no such restriction.
6. **Relinking orphans your routines.** Unlink deletes Google's copy of each device; relink creates fresh ones, and routines that pointed at the old device don't auto-reconnect. Delete and recreate the routines (or re-point the action).
7. **New/relinked devices land unassigned** and won't appear in the automation device-picker until you assign them to a home/room.
8. **Respond to `EXECUTE` optimistically for slow backends.** If your upstream is far away/slow, answer Google within its timeout and let the command finish in the background — otherwise Google says "something went wrong" even though the command worked.
9. **A test/preview integration is enough** for personal use — no app-store review, no privacy-policy/logo. You just link it to your own account.

## Discovered platform reference (ZXY268 / "hyll")

Everything below is from decompiling the app + DNS/port probes. Servers are the
**platform's** infrastructure (shared by all users on it), not account-specific — but
**which one your account lives on varies by region**, so confirm yours via `/proc` (README).

**Servers & IPs observed**
| Host(s) | IP | Role |
|---|---|---|
| `s1.zxy268.com`, `s2.zxy268.com`, `www.zxy268.com`, `s1.htrack.cn`, `www.htrack.cn` | `119.23.228.82` | default / China command server |
| `d.zxy268.com` | `58.205.209.137` | MQTT / push (`tcp://d.zxy268.com:3313`) |
| *(regional shard — observed for a North-American account)* | `190.92.236.56` | command server (Huawei Cloud, `ecs-190-92-236-56.compute.hwclouds-dns.com`); ports 3050 / 3011 / 443 |
| `www.vsmart.top` | `154.210.76.140` | referenced as a redirect domain; now serves only a parked page |
| `www.topm2m.net` | (CDN) | HTTPS command endpoint `POST https://www.topm2m.net/mobiinv/do` (secondary path; only had legacy/numeric accounts in our tests) |

The app's hardcoded default is `s1.zxy268.com`. On login the server can reply **`SCDM06`** to redirect the client to another domain/ip (it hands back `domain`/`domain2`/`domain3`/`ip` in the body) — that's the sharding. `api.fortin.ca` (Cloudflare) is the marketing CMS, **not** the control plane — ignore it.

**Ports:** `3050` command · `3010`/`3011` status · `3012` track · `3313` MQTT · `7311` file · `7777` echo.

**Transaction codes:** login `100010` (name + `SHA1(pw)` upper) · account/push-reg `100103` · config/heartbeat `202110` · device status `203100` / `203101` · controls `3031xx`:
`start 303120` (variants 303121/303122) · `stop 303124`/**`303125`** (variants /126/127) · `lock 303110`/303111 · `unlock 303115`/303116 · `trunk 303130`/303131 (open/close) · `panic/find 303101` · `beacon 303112`/303117. Control-code choice depends on module wiring — capture yours.

**Ret codes:** `000000` success · `SC0006` invalid username · `SC0007` invalid password · `SCDM06` domain redirect · `SE0002` channel · `TE0003` / `PE0090` invalid terminal.

**Envelope:** `{sys_head, app_head, body}` JSON + `HMAC-SHA1(txnkey, json)` uppercase, wrapped in the `%08d` length frame. `distribute = "evostart"`, app version `1.5.38` (both go in `sys_head`; override via `ZXY_DISTRIBUTE` / `ZXY_APPVER`).

## Handy probes
- Decompile: `jadx --no-res -d out base.apk`
- Live server the app is using: read `/proc/net/tcp` for the app's uid (see README).
- Command codes: `adb logcat | grep -E 'lzhgsTxn|sendtcp'` while tapping buttons.
