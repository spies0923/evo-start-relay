# Architecture

## 1. Current architecture (this repository, unchanged)

```
 Home Assistant / curl / voice assistant
            │  HTTPS (your reverse proxy) → HTTP 127.0.0.1:3300, RELAY_SECRET
            ▼
   src/server.js  ── one warm session, serialised commands, 2-min keepalive
            │  plaintext TCP :3050, %08d frame + JSON + HMAC-SHA1(txnkey)
            ▼
   hyll / ZXY268 cloud (region-sharded; Fortin-branded "EvoStart")
            │  cellular (Fortin SIM, NA bands)
            ▼
   EVO-START LTE  ──blue data-link port──▶  EVO-ONE  ──▶  vehicle
```

- `src/zxy.js` builds frames and sends one transaction per TCP connection (`src/zxy.js:42-85`).
- `src/server.js` handles login, re-login on a stale session (`src/server.js:39-51`), the HTTP
  gate (`:57-61`) and routing (`:64-79`).
- `src/smarthome.js` is an optional Google cloud-to-cloud bridge (`src/smarthome.js:55-126`).

**Dependencies:** Fortin hardware, a Fortin subscription, the third-party cloud, and North American
cellular coverage. In South Africa the cellular hop fails (SIM_FEASIBILITY.md §3), so this whole
chain is unavailable there with current hardware.

## 2. Target architecture (Option C)

```
 Phone app / Home Assistant (holds Ed25519 private key, never leaves device)
            │  signed command {dev,kid,ctr,ts,cmd} + sig        ▲ signed ack
            ▼                                                    │
   MQTT broker over TLS (self-hosted: home server or small VPS)   │   ← untrusted relay:
            │  device subscribes to cmd/<dev>, publishes ack/<dev>│     cannot forge commands
            ▼                                                    │
   Controller: ESP32 + LTE Cat-1 (SA bands), in vehicle ─────────┘
     • verifies signature, counter, time window, allow-list, rate limit
     • local kill switch, low-voltage cut-off
            │  isolated dry contact (optocoupler / relay)
            ▼
   EVO-ONE  — Fortin-DOCUMENTED trigger input only (Phase 0 gate)
            │  EVO-ONE applies all of its own start-safety logic
            ▼
   vehicle
```

### Design principles

1. **The EVO-ONE stays the only thing that touches the vehicle.** The controller has no CAN, OBD,
   immobiliser or data-link connection. It closes one isolated contact on an input that Fortin
   documents. The EVO-ONE keeps applying its own conditions for refusing a start or shutting down.
2. **End-to-end authenticity.** Commands are signed on the phone and verified in the car. The
   broker, the network and any home server are untrusted transport. Prototype:
   `poc/secure-command/protocol.js`; tests: `test/secure-command.test.js`.
3. **No inbound ports on the vehicle.** The controller dials out to the broker. Carrier NAT and
   CGNAT are not an issue.
4. **Fail safe.** Any doubt (bad signature, clock skew, rate limit, low battery, kill switch) means
   no actuation. The default state of the output is open.
5. **Cheap and replaceable.** Off-the-shelf ESP32 board, local prepaid SIM, open-source broker.

### Trust boundaries

| Zone | Trusted for | Not trusted for |
|---|---|---|
| Phone / HA key holder | Issuing commands | — |
| Broker / VPS / network | Delivery and availability | Authenticity, integrity, freshness |
| Controller | Verification, rate limit, actuation | Holding phone private keys (it stores public keys only) |
| EVO-ONE | Vehicle-side start safety | — |

## 3. Reusing this repository

- `src/server.js`'s HTTP gate and Home Assistant `rest_command` pattern (`README.md:80-89`) carry
  over unchanged. Only the back end changes, from the ZXY268 cloud to "sign and publish to MQTT".
- `src/smarthome.js` can sit in front of either back end. The switch-not-lock modelling still
  applies (`LESSONS.md:24`).
- **Proposed** new back end: `src/backends/mqtt-signed.js` next to the existing ZXY back end,
  selected by env. The existing behaviour stays the default (Roadmap Phase 3).

## 4. Option A, for comparison

If Fortin can supply a unit confirmed for South Africa, the current repository architecture
(§1) applies as is. It inherits the cloud protocol's weaknesses
(RESEARCH_REPORT.md §5.1) and the single-session constraint (`README.md:58`).
