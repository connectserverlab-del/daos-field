# DAO'S FIELD — Native Engine Handoff Package

This directory is the **AAA engine handoff** for DAO'S FIELD: everything a team needs to build
the game in a real 3D engine (recommended: **Unreal Engine 5**), rather than the browser WebGL
prototype in `../prototype3d/`.

> **Honest scope.** This package is **design + architecture + reference assets**, not a runnable
> engine project. Unreal/Unity can't be built or deployed from the environment this was authored
> in, so there is no live link here. What you get is production-ready: the engine decision, a
> project scaffold, system-by-system mappings to engine constructs, an asset pipeline, and all the
> AI-generated art/audio organized for import. A gameplay/engine team takes it from here.

## Read in this order
1. [`docs/01-engine-choice.md`](docs/01-engine-choice.md) — **Unreal 5 vs Unity vs Godot** for this game, with the decision.
2. [`docs/02-project-structure.md`](docs/02-project-structure.md) — UE5 project layout, modules, naming.
3. [`docs/03-systems-to-engine-mapping.md`](docs/03-systems-to-engine-mapping.md) — every design-bible system → engine construct.
4. [`docs/04-character-animation.md`](docs/04-character-animation.md) — realistic character + run/attack/cultivation animation pipeline.
5. [`docs/05-combat-camera.md`](docs/05-combat-camera.md) — GAS combat, third-person camera, lock-on, game feel.
6. [`docs/06-world-terrain.md`](docs/06-world-terrain.md) — open world: World Partition, PCG terrain, foliage, streaming.
7. [`docs/07-asset-import.md`](docs/07-asset-import.md) — importing the `art-refs/`, PBR materials, what's reference vs usable.
8. [`docs/08-data-config.md`](docs/08-data-config.md) — driving gameplay from the repo's `../data/` JSON via DataTables/DataAssets.
9. [`docs/09-networking-mmo.md`](docs/09-networking-mmo.md) — dedicated servers, replication, and the MMO backend (ties to `../docs/architecture/`).
10. [`docs/10-roadmap.md`](docs/10-roadmap.md) — recommended build order inside the engine.
- [`art-refs/MANIFEST.md`](art-refs/MANIFEST.md) — every generated asset, what it is, and how to use it in-engine.

## How this connects to the rest of the repo
- **`../docs/`** — the design bible (systems, economy, monetization, the critical design review). The
  *what* and *why*. This engine package is the *how*, in-engine.
- **`../data/`** — engine-agnostic gameplay config (elements, auras, realms, worlds, fires). Import
  these directly as DataTables (see `docs/08-data-config.md`). Do **not** re-author them.
- **`../prototype3d/`** — the browser WebGL proof-of-concept (playable). Use it as a **greybox
  reference** for scale, camera feel, and the valley layout — not as the engine's foundation.
- **`art-refs/`** — all AI-generated art/audio (key art, character refs, PBR textures, sky, animation
  reference strips, ambient score), organized for engine import.

## The one-line brief for the engine team
Build a third-person, open-world cultivation action-MMORPG: realistic MetaHuman-grade characters,
GAS-driven cultivation/combat, a World-Partition streamed world of ascending realms, data-driven
from `../data/`, on a dedicated-server backend. Target the fidelity of *Where Winds Meet* / *Black
Myth: Wukong*, with the fairness and systems designed in `../docs/`.
