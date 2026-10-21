# OpenRemoteStart review

## Repositories inspected

| Repo | HEAD | Notes |
|---|---|---|
| https://github.com/jmaxxz/OpenRemoteStart | `d913a0a` (2019-12-01) | Original, 11 commits from 2019-07-24 to 2019-12-01 |
| https://github.com/pyrovader/OpenRemoteStart | `d913a0a` | **Identical history**: an unmodified fork |

Both were cloned read-only into a scratch directory, outside this repository. Nothing was built,
flashed or run. The source was read in full. Paths below are relative to that repository.
**No OpenRemoteStart code, protocol constants or pinout images are copied into this repository.**

No other public implementation of Fortin external control was found (search 2026-10-21).

## Answers

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | Supported Fortin modules | "Fortin remote starter and car alarm systems". The README's only connection section is "How to connect to Fortin Evo-One". | `README.md:3-4`, `:41-47` |
| 2 | Physical interface | The **antenna data-link**, not the RS-232/FlashLink port | `README.md:3-4`; both UARTs named Remote and Starter (`src/openremotestart.ino:63-79`) |
| 3 | EVO-ONE controlled successfully? | The author implies it: a connection photo and schematic for the EVO-ONE, and an "unintended… side effect" that it works as a cellular remote. There are no test logs, firmware versions or vehicle details. **Unverified.** | `README.md:9-12`, `:41-47` |
| 4 | Serial commands or discrete triggers? | Serial. 9600-baud UARTs (`src/openremotestart.ino:265`, `:269`); framed binary messages with an additive checksum (`src/fortinprocessor.cpp:16-66`); a command enumeration (`src/fortin.h`). **Reverse-engineered, not Fortin documentation.** | as cited |
| 5 | Hardware | Particle Photon (Wi-Fi) or Electron (**3G Americas**), a 5 V↔3.3 V level shifter, diode(s) on TX, a 5 V regulator, optional Asset Tracker | `README.md:14-39` |
| 6 | Verified connection diagrams? | A labelled photo and a hobby schematic (`images/`). **Not manufacturer-verified.** Not used here, per your instruction not to infer pinouts. | `README.md:43-47` |
| 7 | Documented start/stop interface? | **No.** It emulates an RF antenna or remote on an undocumented bus. | — |
| 8 | Licence and reuse | BSD 3-Clause (`LICENSE`). The optional AssetTrackerRK dependency has its own licence (`README.md:50-55`, `project.properties`). Reuse is legally permitted with attribution. | as cited |

## Engineering assessment

| Aspect | Observation | Evidence |
|---|---|---|
| Maturity | A 2019 hobby/research project. Its last commit mentions "firmware corruption with long uptimes". No tests. | git log |
| Protocol knowledge | Several fields are marked unknown ("I have not decoded it", "Don't know what this is yet", "Don't know what unlock 2 does differently") | `src/fortinprocessor.h:34`; `src/openremotestart.ino:153`, `:156`, `:859` |
| Pairing | Pairs as a new remote, or by default **clones an existing remote's address** "due to protocol flaws" | `src/openremotestart.ino:158-168` |
| Dangerous features | `ORS_DANGER_ZONE` is compiled in by default. An alarm-suppression demo (flag `m_block_alarm`, off by default) sends unlock when a door opens while armed. A raw-hex command path sends arbitrary frames. | `:56-58`, `:170-175`, `:581-586`, `:871-` |
| Authentication | Control is a Particle cloud function (`car`, `set`), protected only by the Particle account. No end-to-end command signing, replay protection or rate limit. | `:255-256`, `:838-` |
| Connectivity | The Electron 3G Americas does not support South African bands, and 3G is being retired in SA (SIM_FEASIBILITY.md §4) | `README.md:28` |
| Safety | No interlocks of its own beyond what the remote starter enforces | — |

## Suitability for your EVO-ONE

**Not suitable for production use. Label: EXPERIMENTAL / research reference only.**

1. It relies on an undocumented, unauthenticated bus protocol. This contradicts the Phase 2
   requirement to use a documented interface. It may also behave differently on RS firmware 1.31
   than on 2019 firmware: **UNKNOWN**.
2. Putting an internet-connected device on the antenna data-link adds an unlock-capable path to
   the car. The author's own alarm-suppression demo shows the risk.
3. Its hardware platform (Particle 3G) cannot work in South Africa.
4. Its authentication model is weaker than this repository's signed-command design
   (`poc/secure-command/protocol.js`).

**What is reusable, as ideas only:**
- the observation that Fortin modules broadcast a status frame including remote-start and door
  flags (`src/fortinprocessor.h:28-50`);
- the general need for a level shifter if a Fortin port uses 5 V logic.

Neither replaces Fortin documentation.
