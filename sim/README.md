# DAO'S FIELD — Cultivation System (`sim/`)

Phase 3: the game's identity, implemented as a **pure, engine-agnostic, data-driven,
unit-tested** reference library. It implements the five subsystems:

1. **15 Heavenly Cards** — 9 Element + 6 Destiny, seeded/deterministic, bounded.
2. **Aura calculation** — tier from duplicate element cards, with the converging taper.
3. **Character stats** — derived from the *combination* of race + element + aura + destiny + realm.
4. **Cultivation experience** — aura-scaled progress through sub-stage layers.
5. **Realm advancement** — Heavenly Tribulation, no realm-drop on failure.

It reads the repo's `../data/*.json` and has **zero dependencies**. The browser prototypes can
use it directly; the UE5 build mirrors it in GAS (see `../engine/docs/03` & `05`).

## Run it
```bash
cd sim
node test/run.js            # 13 tests — mechanics + design invariants
node examples/demo.js 88 spirit_beast   # a readable cultivator journey
```

## API
```js
import { createCultivationEngine, makeRng } from "./src/index.js";
const engine = createCultivationEngine(data);          // data = parsed ../data/*.json

const c = engine.createCultivator({ race: "human", seed: 42 });
//  → { race, elementCards[9], destinyCards[6], aura, realmIndex, layer, progress, stats }

engine.cultivate(c, effort);                           // accrue aura-scaled progress
if (c.readyForBreakthrough)
  engine.attemptBreakthrough(c, makeRng(seed));        // Heavenly Tribulation
engine.deriveStats(c);                                 // recompute stat block
```
In the browser, `fetch` the six JSON files and pass them to `createCultivationEngine(data)` — the
core never touches the filesystem (`data/loadData.node.js` is the Node-only loader).

## The five subsystems (files)
| File | Subsystem |
|---|---|
| `src/cards.js` | 15 Heavenly Card draw (bounded, seeded) |
| `src/aura.js` | Aura tier + **converging** effective multipliers |
| `src/stats.js` | Character stat derivation |
| `src/cultivation.js` | Cultivation experience + realm advancement + tribulation |
| `src/ruleset.js` | Adapts raw `../data/*.json` into indexed rules |
| `src/rng.js` | Seeded deterministic PRNG |

## Data-driven (new `../data/` files added in Phase 3)
| File | Drives |
|---|---|
| `../data/draw.json` | Card counts, drawable rarities, rarity weights |
| `../data/destiny.json` | The 6 destiny aspects + grade table |
| `../data/races.json` | Race stat mods, traits, draw bias, tribulation mod |
(plus the existing `elements.json`, `auras.json`, `cultivation_realms.json`.)

## Invariants the tests prove (from `../docs/01-design-review.md`)
- **Bounded aura floor (#2):** over 4000 draws, Aura is never below Red; Red is reachable.
- **Converging aura (#2):** White's speed edge shrinks from +75% (realm 1) to ~+9% (realm 8); a
  Red cultivator with +12% effort *overtakes* a coasting White one at high realms — but **not**
  early, so talent still front-loads. Aura shapes the *shape* of the journey, not the ceiling.
- **No realm drop on failure (#1):** a failed tribulation costs sub-stage layers, never a realm.
- Determinism (same seed → same character), stats scale with realm, all races valid.

## Mapping to Unreal Engine 5 (GAS)
| This library | UE5 |
|---|---|
| `deriveStats` outputs | `AS_Vitals` / `AS_Offense` **AttributeSet** values |
| aura tier + `effectiveSpeed` taper | `AS_Cultivation` growth curve (a `FRealCurve` from `DT_Auras`) |
| `cultivate` | `GA_AbsorbQi` server ability adding progress |
| `attemptBreakthrough` | `GA_Breakthrough` + `GA_Tribulation` (server-authoritative) |
| card draw | server RNG service writing identity `GameplayEffect` |
| element `category`/tags | element execution calc (`DT_Elements`) |
This library is the **spec**: the numbers and rules are validated here, then reproduced in GAS.

## Not yet (future phases, same pattern)
Techniques/abilities, elemental damage resolution, Dao comprehension trees, Heavenly Fire crafting,
pills that modify cultivation/tribulation — each plugs in as more data + a handler.
