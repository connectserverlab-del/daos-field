# System: Heavenly Fire & Crafting

Crafting (pills, weapons, artifacts) is the backbone of the player economy. Heavenly Fires
enable high-tier crafting. **Read design-review issue #3 — the hard-gate/monopoly risk is
redesigned here into a tax + rental model.**

## 1. Gameplay overview
- Alchemists refine **pills**, smiths forge **weapons/artifacts**. Nine **Heavenly Fire grades**
  mirror the aura ladder (Red→White).
- **Fires are a multiplier/enabler, not a binary key** (issue #3). Missing the ideal fire =
  higher material cost, lower success rate, longer time — a *tax*, not a *wall*. Substitute paths
  (formation-assisted refinement, group co-forging, consumable "false flames") keep the market
  competitive and prevent a cartel from freezing all top-tier crafting.
- **Crafting has skill expression** (issue #5): fire-control depth, formation layouts, recipe
  discovery — a master's output beats a novice's and commands a premium.

## 2. System architecture
- **Crafting service** validates recipes, consumes inputs transactionally, rolls outcome
  server-side, and emits craft events (feeding reputation "first/best" achievements).
- **Recipes, fire grades, success curves, substitution rules** are **data** (`data/heavenly_fires.json`,
  recipe configs) — new pills/recipes/fires ship as content.
- **Fire rental**: a fire-holder can list *escrowed, time-boxed access* on the market, turning a
  hoardable asset into a liquidity-providing service.

## 3. Database design
- `heavenly_fire` rows track grade, holder (player or sect), **fuel_remaining**, container state
  (fires are consumable at the margin so supply isn't strictly increasing — issue #3).
- Recipe *definitions* in config; craft attempts are events (inputs, fire used, outcome, quality)
  for audit + achievements + economy telemetry.
- Fire rental = an escrow contract row + ledger entries.

## 4. Networking
Crafting is request/response with a resolve step; not latency-sensitive. Long refines can be
async jobs the player checks on (with disconnect-safe resumption).

## 5. Multiplayer synchronization
- **Co-forging / co-refinement** (a substitute path) is a small synchronized group activity —
  run as a lightweight instance so contributions and outcome are authoritative.
- Fire rental access is enforced by the crafting service checking the escrow contract, not by
  client trust.

## 6. Security
- **Recipe validation + transactional input consumption** → no craft-without-materials, no dupe
  on disconnect (idempotent).
- Outcome RNG is server-side and audited (prevents save-scum by disconnecting on a bad roll).
- **Anti-monopoly telemetry:** watch fire-holder concentration and top-tier craft throughput; if
  a cartel forms, the substitute paths and rental incentives are the release valve — instrument
  them.

## 7. Performance
- Crafting is bursty but not hot-path. Long refines as batched async jobs.
- Market integration (below) is the heavier read path; cache listings.

## 8. Edge cases
- Disconnect mid-refine → job resumes or rolls back atomically.
- Fire runs out of fuel mid-refine → pre-checked; partial failure handled gracefully.
- Botched high-tier refine → possible fire container damage (a designed sink, not a bug).
- Rental contract expiry mid-craft → grace handling defined; no stuck escrow.

## 9. Future scalability
- New fires, recipes, pill/weapon tiers, and substitution paths are **data**. The fire grade
  ladder is an open registry aligned to the aura tiers.
- New professions that consume fires (e.g., formation-forged artifacts) plug into the same
  recipe/validation engine.

## 10. Recommended implementation order
1. `data/heavenly_fires.json` + recipe schema.
2. Core craft resolve (transactional, server-authoritative, audited RNG).
3. Fire as tax-not-wall (substitution + success/cost curves).
4. Fire rental/escrow (breaks the monopoly before top-tier content lands).
5. Crafting skill-expression depth (keeps crafter labor valuable — issue #5).
6. Anti-monopoly + economy telemetry.
