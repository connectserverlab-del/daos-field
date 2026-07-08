# DAO'S FIELD — Tutorial Region (integrated vertical slice)

A **playable, end-to-end tutorial** that integrates the project's previously-separate prototypes into
one loop: spawn → **Dao Tree awakening** (15 Heavenly Cards + Aura, via the tested `../sim` engine) →
**Village Elder** → forest → **gather herbs** → **fight a spirit beast** → **Alchemist pill** →
**cultivate** (breakthrough) → **unlock a first elemental technique**. Saves to `localStorage`; cards
never reroll.

**Live:** _(deploy URL in chat / PR)_ · Run locally: `python3 -m http.server` in this folder.

## Audit (what existed, and the honest conflicts)
The master prompt assumed one integrated project with Phase-4 systems and a giant Dao Tree in the
Phase-2 map. In reality the prototypes were **separate**:
- `../testmap/` — 300×300 m map + 5 GLB props + walk/fly camera. **No player, combat, or Dao Tree.**
- `../prototype3d/` — the actual **Phase-4** systems (sprite hero run/attack, demon-beast enemy, damage, death).
- `../sim/` — the **tested cultivation engine** (13 unit tests).

This build **integrates** them (non-destructive — nothing was removed from any prototype). Two honest
caveats stand: (1) true "hyperrealism / looks like real footage" is a **UE5-track** goal (`../engine/`),
not achievable in a browser WebGL build with `image_to_3d` props; (2) this is the **playable spine** of
the full spec — every step works end-to-end, but depth (5 fully-simulated NPC schedules, weapon
crafting, etc.) is staged for later milestones.

## Reused systems (not rebuilt)
| Reused | From | How |
|---|---|---|
| Cultivation logic (15 cards, aura, stats, realms, tribulation) | `../sim/` (copied to `./sim/`) | Runs in-browser via `createCultivationEngine`; **all cultivation is the tested engine** |
| Cultivation data (elements, auras, realms, races, destiny, draw) | `../data/` (copied to `./gamedata/`) | Fetched at runtime; data-driven |
| Character sprite (run/attack/idle) | `../prototype3d/assets/` | Chroma-keyed billboard hero |
| Enemy sprite (demon beast) | `../engine/art-refs/` | Chroma-keyed billboard spirit beast |
| 3D world props (house, tree, mountain, cave, bridge) | `../testmap/models/` | GLB via GLTFLoader; the giant tree becomes the **Dao Tree** |
| Terrain / sky / water / PBR ground / ambient score | `../testmap/`, `../prototype3d/` | Reused shaders + textures |
| WebGL engine + post-processing + GLTFLoader | `../testmap/vendor/` | Three.js r128 (vendored) |

## New systems (data-driven, in `game.js` + `./data/`)
Player controller + interaction system · **Dao Tree awakening** cinematic · **quest state machine**
(`data/quests.json`) · **NPC dialogue** with aura/element-conditional Elder lines (`data/npcs.json`) ·
**inventory + gathering** · **combat** (attack/damage/hit-stop/screen-shake/death, reusing sprites) ·
**cultivation + breakthrough** (drives the sim) · **first elemental technique** by dominant element
(`data/items.json`) + VFX · **save/load** (`localStorage`, cards permanent) · HUD (objective tracker,
vitals, dialogue, awakening overlay, inventory, damage numbers).

## Data-driven (add content without touching code)
- `data/quests.json` — reorder/add tutorial steps.
- `data/npcs.json` — NPCs, positions, dialogue, Elder's aura/element branches.
- `data/items.json` — items **and** the per-element techniques.
- `gamedata/*.json` — the cultivation config (from `../data`).

## Files
**New:** `index.html`, `game.js`, `logic.js`, `data/{quests,npcs,items}.json`, `README.md`, `.gitignore`.
**Copied/reused:** `sim/*` (from `../sim/src`), `gamedata/*` (from `../data`), `assets/*`, `models/*`,
`vendor/*`. No files in other prototypes were modified.

## Test results (headless WebGL regression — `scratchpad/tutfull.py`)
All green, no JS errors:
- Awakening runs the sim → real Aura + dominant element + stats (HP from `vitality`).
- Q1→Q8 all advance in order: awaken → elder → forest → gather ×3 → beast → pill → **cultivate
  (realm 0→1 breakthrough)** → **technique unlocked** (element-matched) → tutorial complete.
- **Save/reload:** aura + quest + awakened state persist; **cards do NOT reroll**.
- Out-of-order beast kill is **banked** so it can't soft-lock Q5.
- Two real bugs found & fixed while testing: camera-space movement sign; pause-on-blur (now
  `visibilitychange`); cultivation moved off `setInterval` onto the update loop (throttle-proof).

## Known limitations
- **Load weight:** the GLBs are ~53 MB (uncompressed `image_to_3d` output) → slow first load. Follow-up:
  Draco/meshopt compression + LODs.
- **Not hyperrealistic** — WebGL + generated props; the AAA-fidelity path is `../engine/` (UE5).
- NPCs are simple robed figures (not MetaHuman); no schedules/lip-sync; blacksmith/merchant/recruiter
  dialogue is informational only.
- No day/night, weather, occlusion culling, or LODs yet; combat is single-enemy.
- `window.__*` test hooks ship in the build (harmless; used by the regression harness).

## Recommended next milestone
1. **Optimize assets** (Draco/meshopt + LODs) to cut load to <10 MB.
2. **Character creation** (race + let the draw choose) before the Dao Tree.
3. Flesh out **combat** (multiple beasts, technique damage, dodge) and **crafting** (blacksmith/alchemist).
4. Port this exact loop to **UE5** using `../engine/docs` — the sim, data, and quest structure carry over 1:1.
