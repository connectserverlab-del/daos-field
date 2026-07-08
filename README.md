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

## Repository layout
```
docs/
  00-vision-and-scope.md          vision, pillars, anti-goals, scope honesty
  01-design-review.md             the critique — exploits, risks, fixes (read first)
  architecture/                   topology, event-sourced data model, netcode & sharding
  systems/                        one doc per system, each covering the 10 technical dimensions
  roadmap.md                      recommended implementation order
data/
  schema/                         JSON Schemas (CI-validated)
  elements.json auras.json cultivation_realms.json worlds.json heavenly_fires.json
```
