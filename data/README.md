# Data-Driven Configuration

This directory is the **proof** that DAO'S FIELD's "add content without rewrites" principle is
real, not a slogan. Elements, aura tiers, cultivation realms, world layers, and Heavenly Fires
are defined here as **versioned data**. The game engine resolves behavior by *looking up* these
definitions — it never branches on an element/realm/world name in code.

## Files
| File | What it defines | Add new content by… |
|---|---|---|
| `schema/element.schema.json` | JSON Schema for the element registry | — (validated in CI) |
| `elements.json` | All elements + the interaction matrix | appending an element object |
| `auras.json` | Aura tiers, duplicate→tier map, **convergence rule** | editing tier curves |
| `cultivation_realms.json` | Ordered realms + tribulation params | inserting a realm object |
| `worlds.json` | World layers + downward-pull + merge floors | appending a layer object |
| `heavenly_fires.json` | Fire grades + tax/substitution/rental model | appending a grade object |

## Rules of the road
1. **Reference by `id`, never by name.** Names are display strings; ids are the contract.
2. **Ids are permanent.** Never reuse or repurpose an id — downstream events reference it forever.
3. **Bump `version` on every change** for audit + hot-reload + event replay.
4. **Validate in CI** against the schemas before merge. A malformed config must never reach a
   game server.
5. **No behavior in data that the engine must special-case.** If you find yourself wanting a
   `if (element.id === "fire")` in code, add a *field* to the element instead (see how `fire`
   carries `crafting:heavenly_fire` and `tribulation:affinity` tags).

## How this backs the design review
- **Issue #2 (fair aura):** `auras.json` encodes the *converging* taper and catch-up faucets as
  data, so "Red can reach the ceiling" is a tunable, monitored invariant — not a hope.
- **Issue #3 (no fire monopoly):** `heavenly_fires.json` encodes tax-not-wall gating, substitution
  paths, and rental as data.
- **Issue #4 (no dead worlds):** `worlds.json` carries downward-pull incentives and merge floors.
- **Issue #1 (death):** `worlds.json._deathPolicy` records that open-world realm-drop is removed.
- **Issue #10 (permanence as policy):** because identity is event-sourced and these are versioned
  configs, a future rebalance/reroll is a data + event operation, not an emergency migration.

## Not yet here (added later as data, by design)
Human Worlds III–VIII, Divine/Origin realms, races, professions + mastery trees, recipes, drop/
gather tables, techniques, constitutions, spiritual roots, destiny outcomes. Each plugs into the
same pattern: a schema + a data file + engine lookups.
