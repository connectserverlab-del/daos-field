# 04 — Character & Animation Pipeline

The prototype's hardest limit was a realistic, animatable human. In UE5 this is a **solved
pipeline**. Here's how, using our generated references.

## Character creation (art → riggable mesh)
1. **MetaHuman** is the spine. Use MetaHuman Creator to author the base cultivator, matching the
   look in `art-refs/characters/race_human.png` (and beast/spirit/monster variants for the races).
   - For faces closer to our refs, use **MetaHuman from Mesh / Mesh-to-MetaHuman** on a sculpt, or
     drive likeness from the reference portraits.
   - Non-human races (Beast/Spirit-Beast/Monster): MetaHuman base + modular attachments (horns,
     scales, antlers) as skeletal/static mesh parts on the same skeleton. Refs:
     `art-refs/characters/race_beast.png`, `race_spirit_beast.png`, `race_monster.png`,
     `enemy_demon_beast.webp`.
2. **Robes/cloth**: author as skeletal mesh with **Chaos Cloth** for the flowing hanfu (the sprite's
   defining silhouette). Bronze trim / lacquer via layered materials (see `07`).

## Animation set (replaces the sprite frames)
Our `art-refs/anim-refs/hero_run.webp` (run cycle), `hero_attack.webp` (sword slash),
`hero_idle.webp` are **animation reference** — pose/timing guides for the animators or motion
matching, not final assets. Build the real anim set as:
- **Locomotion**: idle, walk, run, sprint, turn-in-place, jump, land, dodge — driven by **Motion
  Matching** (UE5.4+) or a locomotion state machine + strafe set.
- **Combat montages**: `AM_SwordDao_Light` (combo 1-3), `AM_SwordDao_Heavy`, block, parry, hit
  reactions (by direction), knockdown, death. Anim Notifies fire GAS events (see `05`).
- **Cultivation**: `AM_AbsorbQi` (meditation loop), `AM_Breakthrough`, `AM_Tribulation` (staggered
  by lightning strikes).
- **Control Rig** for procedural aim/look-at, foot IK on the valley terrain, and cloth wind response.

## Sourcing animation fast
- **Mixamo / marketplace** locomotion + sword sets retargeted onto the MetaHuman skeleton via **IK
  Retargeter** — fastest path to a playable slice.
- **Mocap** (or Move.ai / video-to-mocap) for hero moments (signature techniques, tribulation) to
  hit the *Where Winds Meet* bar.
- Our reference strips give animators the intended *feel* (back-view run cadence, the qi-blade slash
  arc) to match.

## Races on one skeleton
Keep all playable races on the **MetaHuman skeleton** so animation, retargeting, and gear are shared.
Racial identity = modular parts + materials + a body-scale morph, driven by `DT_AppearanceCatalog`
(design doc `systems/27`). This is what makes "customize however you want" tractable in-engine.

## Enemies
`enemy_demon_beast.webp` is the design ref for the first hostile — a MetaHuman/creature variant with
scaled-skin materials, crimson-eye emissive, horns, and a `GA_EnemyMelee` ability. Reuse the same
combat/GAS plumbing as the player.
