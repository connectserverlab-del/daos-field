# DAO'S FIELD — Phase 2 Test Map (300 × 300 m)

A small explorable area assembled from **real 3D models generated with Higgsfield** (`image_to_3d`,
textured GLB). Contains the five Phase-2 features:

- **One village** — a cluster of ancient-sect houses south of the river
- **One forest** — scattered pine trees
- **One mountain** — a rocky crag (with two smaller crags for a range) in the NW corner
- **One cave** — a cave-entrance formation at the mountain's base
- **One river** — a meandering waterway with an arched footbridge

**Live:** _(deployed via Higgsfield — see the URL in chat / PR)_

## How it's built
- WebGL / Three.js (r128, vendored) + **GLTFLoader** to load the generated GLB meshes.
- Each GLB is auto-normalized on load (centered, based at ground, scaled to a target height), then
  cloned and placed across the 300×300 m terrain.
- Terrain is a procedural heightfield with a carved river channel; grass/dirt slope splat; a shader
  water plane; gradient sky + 4K cloud band; sun + soft shadows + bloom.
- Walk on the terrain (WASD + drag-look, Shift to run) or press **F** to fly (Space/C up-down) to
  inspect models from any angle. Feature name-labels float over each area.

## Models (`models/*.glb`)
Generated from Nano-Banana prop images (three-quarter view on white → `image_to_3d`, textured):
`house.glb`, `tree.glb`, `mountain.glb`, `cave.glb`, `bridge.glb`. These are **also copied to
`../engine/art-refs/models/`** for direct Unreal Engine 5 import (see that folder's manifest).

## Honest notes
- `image_to_3d` meshes are **game-ready-ish props, not hero assets** — expect some soft geometry and
  baked-in lighting on the textures. Great for greyboxing/set-dressing and as a modeling reference;
  a hero pass would retopo/re-texture them.
- This is a **test map**, not a game level — no gameplay, just the five features in 3D so you can
  walk/fly through them and confirm the pipeline (Higgsfield → GLB → engine) works end to end.
