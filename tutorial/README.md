# DAO'S FIELD — Tutorial Region (integrated vertical slice)

A **playable, end-to-end tutorial** that integrates the project's previously-separate prototypes into
one loop: spawn → **Dao Tree awakening** (15 Heavenly Cards + Aura, via the tested `../sim` engine) →
**Village Elder** → forest → **gather herbs** → **fight a spirit beast** → **Alchemist pill** →
**cultivate** (breakthrough) → **unlock a first elemental technique**. Saves to `localStorage`; cards
never reroll.

**Live:** https://fearless-rose-151.higgsfield.gg/ · Run locally: `python3 -m http.server` in this folder.

**Controls:** WASD move · Shift run · E interact · click/Space attack · **Q or 1** basic Qi · **2** charged · **3** area · **4** defensive · **5** movement · **6** toggle the hidden **Limitless** kit · I bag.

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

## New systems (data-driven, in `game.js` + `qi.js` + `./data/`)
Player controller + interaction system · **Dao Tree awakening** cinematic · **quest state machine**
(`data/quests.json`) · **NPC dialogue** with aura/element-conditional Elder lines (`data/npcs.json`) ·
**inventory + gathering** · **combat** (attack/damage/hit-stop/screen-shake/death, reusing sprites) ·
**cultivation + breakthrough** (drives the sim) · **the modular elemental Qi attack system**
(`data/qi.json` + `qi.js`, see below) · **save/load** (`localStorage`, cards permanent) · HUD
(objective tracker, vitals, dialogue, awakening overlay, inventory, damage numbers, technique bar).

## Expanded, more playable world
The map grew from 300×300 to **400×400** (mountain walls bound a ~330×330 bowl). Instead of one
patch of trees there are now **five forest clusters** (north woods, eastern deep forest, western
thicket, SE old-growth under a second mountain massif, south copse) placed from a small data list,
plus a second cave, standing-stone landmarks, and rock clusters. A **pack of 10 spirit beasts**
(the tutorial beast + 9 roamers of varied HP/damage) is spread across the forests — they aggro,
are slowed by status effects, and drift home when you leave. Only the tutorial beast gates the
kill quest; the rest are free-roam content.

## Data-driven (add content without touching code)
- `data/quests.json` — reorder/add tutorial steps.
- `data/npcs.json` — NPCs, positions, dialogue, Elder's aura/element branches.
- `data/items.json` — items **and** the legacy per-element techniques.
- `data/qi.json` — **the elemental Qi attack system** (elements, techniques, status effects, VFX/environment profiles). Add an element or attack here and it works with no code change.
- `gamedata/*.json` — the cultivation config (from `../data`).

## Elemental Qi attack system (`data/qi.json` + `qi.js`)
A **modular, data-driven** combat layer. The player's dominant element drives a full **5-technique
kit**; nothing is hardcoded per attack. Adding a new element or technique is a JSON edit.

**Elements (8):** Fire · Water · Earth · Wood · Gold *(common)* · Wind · Lightning *(rare)* ·
**Limitless** *(mythic — a hidden JJK inheritance, press **6**)*. Each element declares a colour
**palette** and an environmental **signature** (how the world reacts), plus a **status effect** and
an **upgrade path**.

**Every element has all 8 requested pieces:** (1) Basic attack, (2) Charged attack, (3) Area attack,
(4) Defensive technique, (5) Movement/utility technique, (6) **Environmental interaction**,
(7) **Status effect**, (8) **Upgrade path** (3 ranks; breakthroughs raise your rank 0→2, so
cultivation deepens every technique).

**Qi attacks are never bare glowing projectiles — they change the world.** The engine (`qi.js`) is a
generic interpreter with no per-element code; it turns data tags into grounded VFX:
| Element | The world reacts with… |
|---|---|
| **Fire** | heat-shimmer, rising embers, drifting smoke, blackened **scorch decals**, dynamic firelight |
| **Water** | splash droplets, **wet/slick decals**, mist, expanding **ripples**, heavy knockback |
| **Earth** | dust clouds, radial **crack decals**, flung debris shards, **lifted stones**, ground-shake |
| **Wood** | fluttering leaves, **roots that grow** from the soil, spores, life-drain |
| **Gold** | sparks, ringing metallic **fragments**, reflective shards, armour-splitting sunder |
| **Wind** | ground gust rings, scattered leaves & dust, big knockback |
| **Lightning** | branching **arcs**, sparks, a blinding **flash**, **delayed thunder** |
| **Limitless** | **Lapse: Blue** (implosion — drags foes inward), **Reversal: Red** (repulsion blast), **Hollow Purple** (imaginary-mass sphere that scours the ground), **Infinity** (near-total guard), **Blue Step** (fold-space blink) |

**Grounded VFX vocabulary** (all data-selected, no per-attack code): particle bursts (embers/smoke/
dust/splash/leaves/sparks from **Higgsfield-generated, alpha-keyed textures**), ground **decals**
oriented to terrain normal (scorch/crack/wet), expanding **shock rings** & ripples, flung **debris**
& **lifted stones**, **growing roots**, branching **lightning arcs**, **dome barriers**, flickering
**dynamic point-lights**, **camera shake** (only on weighty hits), **status DoT/slow** with tick VFX,
and per-element **sound hooks**. Statuses (burning/soaked/staggered/entangled/sundered/exposed/
shocked/unraveled) apply damage-over-time, slow, and damage-vulnerability that the beast AI reads.

**Higgsfield art:** VFX sprites & decals were generated with Nano Banana (`vfx_smoke/dust/splash/
leaf`, `decal_scorch/crack`, and the `vfx_hollow` Hollow-Purple orb), then luminance/inverse-luminance
keyed to transparent PNGs (`scratchpad` pipeline) and shipped as small WebP (~260 KB total).

### Honest scope
Film-grade **volumetric fog, screen-space refraction, GPU heat-distortion and foliage vertex-sway**
are the **UE5/Niagara** targets, not a browser WebGL build. What ships here is the **grounded,
world-reacting** version **and** the modular data architecture — which is the real deliverable,
because it ports 1:1 to Niagara/GAS (below).

### UE5 / Niagara / GAS mapping (the fidelity path)
| Browser layer (`qi.js` / `qi.json`) | UE5 equivalent |
|---|---|
| `QiEngine.cast(techId, rank, origin, dir)` | **GameplayAbility** (GAS) activated by input; cost/cooldown = `UGameplayEffect` |
| `qi.json` technique = data row | **DataAsset** / `UGameplayAbility` CDO + curve tables (the rank curves) |
| particle bursts (embers/smoke/dust/splash) | **Niagara** systems (GPU sprites, ribbons, mesh emitters, collision) |
| ground decals (scorch/crack/wet) | **Deferred Decal** actors / runtime virtual-texture blending |
| heat-shimmer | post-process **refraction/distortion** material |
| dynamic point-lights + flicker | **Point/Rect lights** + light-function flicker |
| status effects (burning/soaked/…) | stacking **GameplayEffects** with periodic execution + GameplayTags |
| lifted stones / debris / roots | Chaos physics field spawns / spawned skeletal props |
| camera shake | `UCameraShakeBase` |
| enemy handle `{pos,alive,damage,knock,status}` | `AbilitySystemComponent` on the target pawn |
The **JSON and the ability contract are engine-agnostic** — the same `qi.json` feeds a UE5 importer.

## Files
**New:** `index.html`, `game.js`, **`qi.js`** (the generic Qi VFX/attack engine), `logic.js`,
`data/{quests,npcs,items,qi}.json`, `assets/{vfx_smoke,vfx_dust,vfx_splash,vfx_leaf,vfx_hollow,
decal_scorch,decal_crack}.webp` (Higgsfield-generated, keyed), `README.md`, `.gitignore`.
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

**Qi-system regression** (`scratchpad/qitest.py`, `qidbg.py`, `qishow.py`) — all green, no JS errors:
- All **5 slots × 8 elements** (incl. Limitless) cast and spawn grounded VFX (particles/projectiles/
  decals/rings/lights) — verified via `__qiState()` peaks.
- **Damage + status:** a live beast goes 60→38 *(burning)* →15 *(burning)* → dead; **DoT ticks**
  between casts confirm the status manager runs off the update loop.
- **Guard** (defensive techniques) reduces incoming damage & sets the buff; **dash** techniques move
  the player; **Reversal: Red** knocks back, **Lapse: Blue** pulls inward.
- The full **8-quest tutorial loop still completes end-to-end** with the refactor (multi-beast, larger
  map), and **save/reload** still persists cards/aura/quest without rerolling.

## Known limitations
- **Load weight:** the GLBs are ~53 MB (uncompressed `image_to_3d` output) → slow first load. Follow-up:
  Draco/meshopt compression + LODs.
- **Not hyperrealistic** — WebGL + generated props; the AAA-fidelity path is `../engine/` (UE5).
- NPCs are simple robed figures (not MetaHuman); no schedules/lip-sync; blacksmith/merchant/recruiter
  dialogue is informational only.
- No day/night, weather, occlusion culling, or LODs yet.
- **Charged** Qi techniques currently fire instantly (higher cost/cooldown) rather than on a
  hold-to-charge meter; the `charge` field is in the data for when a charge meter is added.
- `window.__*` test hooks ship in the build (harmless; used by the regression harness).

## Recommended next milestone
1. **Optimize assets** (Draco/meshopt + LODs) to cut load to <10 MB.
2. **Character creation** (race + let the draw choose) before the Dao Tree.
3. Flesh out **combat** (multiple beasts, technique damage, dodge) and **crafting** (blacksmith/alchemist).
4. Port this exact loop to **UE5** using `../engine/docs` — the sim, data, and quest structure carry over 1:1.
