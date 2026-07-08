# DAO'S FIELD — Design & Architecture Bible

An open-world cultivation (Xianxia/Xuanhuan) MMORPG designed to grow for 10–15 years. This
repository is the **design bible + technical architecture + data-driven configuration
foundation** — the place where the hard questions are answered on paper, where changing them is
cheap.

> **Start with [`01-design-review.md`](01-design-review.md).** It's the critical review of the
> original brief — the ten things most likely to kill the game and how we change the design to
> survive two million adversarial players. Nothing else here makes sense without it.

## Reading order
1. [`00-vision-and-scope.md`](00-vision-and-scope.md) — pillars, anti-goals, honest scope.
2. [`01-design-review.md`](01-design-review.md) — **the critique.** KEEP / CHANGE / CUT verdicts.
3. `architecture/` — cross-cutting technical foundation:
   - [`10-system-architecture.md`](architecture/10-system-architecture.md) — services, data-driven rules.
   - [`11-data-model.md`](architecture/11-data-model.md) — event-sourced storage, consistency choices.
   - [`12-netcode-and-sharding.md`](architecture/12-netcode-and-sharding.md) — AOI, channels, instances.
4. `systems/` — one doc per gameplay system, each covering the ten technical dimensions:
   - [`20`](systems/20-identity-race-cards-aura.md) Identity (race, cards, aura, elements)
   - [`21`](systems/21-cultivation-and-worlds.md) Cultivation, worlds & death
   - [`22`](systems/22-heavenly-fire-and-crafting.md) Heavenly Fire & crafting
   - [`23`](systems/23-professions-and-economy.md) Professions & economy
   - [`24`](systems/24-sects-academies-reputation.md) Academies, sects, reputation, recruitment
   - [`25`](systems/25-combat.md) Combat
   - [`26`](systems/26-monetization.md) Monetization (fair-by-design)
5. [`roadmap.md`](roadmap.md) — recommended build order across all systems.
6. [`../data/`](../data) — the data-driven configuration itself (elements, auras, realms, worlds,
   fires) + JSON Schema. Proof that "add content without rewrites" is real.

## The ten technical dimensions (applied to every system)
Gameplay overview · System architecture · Database design · Networking · Multiplayer sync ·
Security · Performance · Edge cases · Future scalability · Recommended implementation order.

## Core principles
- **Horizontal identity, not vertical class** — uniqueness from combination, not tier-of-luck.
- **Server-authoritative + event-sourced** where integrity matters (identity, economy, reputation).
- **Data-driven, not hardcoded** — new content ships as config, validated in CI.
- **Fair monetization enforced by the build**, not by good intentions.
