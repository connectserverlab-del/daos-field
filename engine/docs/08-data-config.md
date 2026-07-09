# 08 — Data & Config (drive the engine from `../../data/`)

The repo's `../../data/` JSON is the **engine-agnostic source of truth** for gameplay content. Do not
re-author it inside UE — import it. This is what keeps "add content without rewrites" true.

## The files (already authored)
| File | Becomes | Key fields |
|---|---|---|
| `../../data/elements.json` | `DT_Elements` | id, rarity, category, **interaction matrix**, tags |
| `../../data/auras.json` | `DT_Auras` | tier, duplicate→tier map, speed/comprehension mults, **taper** (converging aura) |
| `../../data/cultivation_realms.json` | `DT_CultivationRealms` | ordered realms, tribulation params, powerBudget |
| `../../data/worlds.json` | `DT_WorldLayers` | layer, unlockRealm, downward-pull, populationFloor |
| `../../data/heavenly_fires.json` | `DT_Fires` | grade→auraTier, tax-not-wall gating, substitution, rental |
| `../../data/schema/element.schema.json` | import/CI validation | JSON Schema, already validated by `../../scripts/validate_data.py` |

## Import pipeline
1. Define a `USTRUCT` per file mirroring the JSON row shape (in module `DaosData`).
2. Import each JSON as a **DataTable** using that row struct (UE imports arrays-of-objects directly;
   for the object-keyed maps like `auraFromDuplicates`, transform to rows in the import step or a
   small commandlet).
3. A **DaosEditor commandlet** re-imports `../../data/*.json` → `Content/Data/*` on demand, so a
   designer edits JSON (or a future in-engine editor writes JSON) and the tables refresh. Keep JSON
   canonical; DataTables are the cooked projection.
4. Wire CI: run `../../scripts/validate_data.py` **and** a UE commandlet that asserts every id
   referenced by content exists in a table (no dangling element/realm refs).

## Using the data at runtime
- **Elements**: the damage `ExecutionCalculation` looks up `DT_Elements` by tag → multiplier. Adding
  Time/Space/Life/Fate/Death/Rule = new rows + Niagara, zero combat-code change.
- **Aura**: `AS_Cultivation` reads the taper curve from `DT_Auras` → growth-rate at the current realm.
  This is the **design-review #2 invariant made data**: monitor the ceiling gap via telemetry and
  tune the curve, never the code.
- **Realms/Worlds/Fires**: streaming, breakthrough, and crafting all resolve by id from their tables.

## Rules (same as `../../data/README.md`)
- Reference by **id**, never display name. Ids are permanent. Bump `version` on change.
- No behavior in code that special-cases an id — add a **field** to the data instead.
- Cosmetic/monetization data may **never** map to an AttributeSet mutation (anti-P2W CI check).
