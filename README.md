# DAO'S FIELD

An open-world cultivation (Xianxia / Xuanhuan) MMORPG designed to grow for 10–15 years — where
every player begins mortal and may ascend toward Immortal, Demon Lord, Divine Beast, Celestial,
or God. Identity is not a class you pick; it's the **combination** of Race, Heavenly Cards, Aura,
Element, Dao, Profession, Sect, and Choices. No two journeys are identical.

This repository is the **design bible + technical architecture + data-driven configuration
foundation**. It answers the hard design and scaling questions on paper — where they're cheap to
change — before a line of engine code is committed.

## Start here
- **[`docs/01-design-review.md`](docs/01-design-review.md)** — the critical review of the design:
  the ten things most likely to kill the game at scale, with KEEP / CHANGE / CUT verdicts. Read
  this first.
- [`docs/README.md`](docs/README.md) — full reading order and index.
- [`docs/roadmap.md`](docs/roadmap.md) — recommended build order.
- [`data/`](data/) — the data-driven configuration (elements, auras, realms, worlds, fires) +
  JSON Schema. Proof that new content ships as data, not rewrites.

## Design principles
- **Horizontal identity, not vertical class** — uniqueness from combination, not tier-of-luck.
- **Server-authoritative + event-sourced** where integrity matters (identity, economy, reputation).
- **Data-driven, not hardcoded** — new elements/realms/worlds/fires/professions are config,
  validated in CI.
- **Fair monetization enforced by the build** — cosmetic/convenience only, never rate/outcome/
  permanence for cash.

## Building the game
- [`tutorial/`](tutorial/) — **playable integrated tutorial region.** The full first-hour loop:
  Dao Tree awakening (15 cards + aura, via `sim/`) → Village Elder → gather herbs → fight a spirit
  beast → Alchemist pill → cultivate/breakthrough → first elemental technique. Reuses the 3D world,
  combat sprites, and the tested cultivation engine; data-driven quests/NPCs; saves to localStorage.
  Verified end-to-end in headless WebGL. See [`tutorial/README.md`](tutorial/README.md).
- [`sim/`](sim/) — **the cultivation system, implemented.** A pure, data-driven, unit-tested
  reference library (15 Heavenly Cards, Aura calculation, character stats, cultivation experience,
  realm advancement). Reads `data/`, zero dependencies, 13 passing tests proving the design
  invariants. Runs in the browser and is the spec for the UE5 GAS build. `cd sim && node test/run.js`.
- [`engine/`](engine/) — **AAA native-engine handoff package (Unreal Engine 5).** Engine choice,
  project scaffold, system-by-system mappings to engine constructs, character/combat/world pipelines,
  data import, MMO networking, and all AI-generated art organized for import (`engine/art-refs/`).
  This is the path to true AAA fidelity.
- [`prototype/`](prototype/) — playable browser proof-of-concept of the **identity ceremony**
  (race → 15 Heavenly Cards → aura reveal → Human World I), with photoreal portraits.
- [`prototype3d/`](prototype3d/) — playable browser **3D open-world vertical slice** (WebGL/Three.js):
  explorable valley, realistic sprite hero (run/attack), PBR terrain. A greybox reference for scale,
  camera, and feel — not the foundation for the engine build.

## Repository layout
```
docs/                             design bible: vision, critique, architecture, systems, roadmap
  01-design-review.md             the critique — exploits, risks, fixes (read first)
data/                             engine-agnostic gameplay config + CI-validated JSON Schemas
engine/                           Unreal Engine 5 handoff: docs/ + art-refs/ (start: engine/README.md)
prototype/                        browser proof-of-concept — identity ceremony
prototype3d/                      browser 3D open-world vertical slice (WebGL)
```
