# 10 — In-Engine Build Roadmap

Sequenced so the risky, load-bearing pieces (GAS, server authority, streaming, data pipeline) exist
before content scales on top of them. Mirrors the design bible's "fairness mechanic before the system
it protects" rule.

## Phase 0 — Foundations (engineers)
1. UE5 project + plugins (GAS, World Partition, Enhanced Input, CommonUI, Niagara, PCG, Water).
2. `Source/` module skeleton (`02`), **dedicated-server target**, source control (Perforce/UGS).
3. **Data pipeline** (`08`): `../../data/*.json` → DataTables + import commandlet + CI validation.
4. GAS core: `AS_Vitals`, `AS_Cultivation`, `AS_Identity`, GameplayTag taxonomy.

## Phase 1 — Playable character in a real place
5. **MetaHuman** cultivator + retargeted locomotion (Mixamo/marketplace) — a hero that moves.
6. Third-person camera + Enhanced Input + full remap/sensitivity/invert (QoL from day one).
7. **Human World I** as a World Partition region; Landscape + layered terrain material from
   `art-refs/textures/`; Sky Atmosphere + fog; PCG scatter.

## Phase 2 — The core loop, in-engine
8. `GA_AbsorbQi` growing `AS_Cultivation` at an **aura-scaled** rate (from `DT_Auras`).
9. **Character creation**: race + Heavenly Card draw writing identity tags/attributes (server RNG).
10. `GA_SwordDao` combat + the **element execution calc** (from `DT_Elements`) vs the demon-beast
    enemy (`art-refs/characters/enemy_demon_beast.webp`). Hit-stop, screen shake, Niagara.
11. `GA_Breakthrough` + Niagara `NS_Tribulation` (opt-in stakes).

## Phase 3 — Systems & QoL polish
12. CommonUI: HUD (vitals/qi), pause + **settings** (graphics scalability, audio submixes, controls,
    accessibility — difficulty, colorblind, reduce-motion, text size), minimap, photo mode.
13. Inventory + crafting (fire tax-not-wall) client, calling backend economy stubs.
14. Appearance/customization (MetaHuman modular parts from `DT_AppearanceCatalog`).

## Phase 4 — Online & scale
15. Dedicated-server zones + Replication Graph AOI; GAS server authority verified.
16. **Backend** track in parallel (`09` + `../../docs/architecture/`): gateway, identity, **economy
    ledger**, persistence, reputation.
17. Instanced content: secret realms → raids → sect/territory wars.

## Phase 5 — World & live-ops
18. Additional world layers as Data Layers; downward-pull + layer-merge tooling.
19. Cosmetic monetization + the **anti-P2W build check** (no cosmetic touches an AttributeSet).
20. Content cadence: new elements/realms/fires/techniques as **data + Niagara + anim** — no engine
    rewrites (the whole point).

## Cross-cutting from day one
- Server-authoritative GAS; economy in the backend ledger; data-driven content; scalability settings;
  telemetry (aura ceiling-gap, money supply, population-per-layer). Build the **dedicated server and
  the data pipeline first** — everything else assumes them.
