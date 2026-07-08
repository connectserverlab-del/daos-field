# 06 — Open World, Terrain & Streaming

The prototype faked one small valley. In UE5 the valley becomes the first streamed region of a real
open world.

## World structure
- **World Partition** for each world layer (Human World I…IX, Spirit, Immortal, Divine, Origin). One
  Persistent Level per layer; content auto-partitioned into a grid, streamed by distance.
- **Data Layers** for logical toggles: sect-territory states, dynamic events, day/night set dressing,
  and the **downward-pull** content (mentor nodes visible to high-realm players in low worlds — design
  `systems/21`).
- **Level Instances** for interiors, secret realms, and instanced content (raids, sect/territory
  wars) — the fair, high-fidelity combat spaces.
- **HLODs** for distant silhouettes (the mountain rings the prototype approximated).

## Terrain
- **Landscape** with a **layered material**: blend grass / dirt / rock by slope + altitude + a macro
  noise — the exact model the prototype's splat shader prototyped. Import
  `art-refs/textures/grass_ground|dirt_ground|cliff_rock.webp` as the albedo layers; generate/author
  **normal + ORM (occlusion/roughness/metallic)** maps for each (the prototype derived normals in
  code; do it properly here — see `07`).
- **Nanite** displacement / high-poly rock meshes for cliffs instead of primitives.
- **PCG (Procedural Content Generation)** graphs scatter grass, trees, rocks, spirit-herbs with
  slope/altitude rules — replacing the prototype's InstancedMesh scatter, at open-world scale and
  quality. Foliage uses **Nanite foliage** + wind.
- Water: **Water plugin** (rivers/lakes) for the valley river the prototype faked with a shader.

## Sky & atmosphere
- **Sky Atmosphere + Volumetric Clouds + Sky Light** for a real dynamic dawn (replaces the prototype's
  gradient dome + cloud-band). `art-refs/sky/sky_dawn.webp` is the **look reference** for the grade,
  not a skybox to map.
- **Exponential Height Fog + Volumetric Fog** for the valley mist and god-rays (the prototype's
  bloom-fog approximation done right).
- **Time-of-day**: a Sun/Moon rig on a curve; Lumen updates GI in real time.

## Points of interest & world content
- Spirit Vein / Ancient Stele / Cloud Shrine (prototype POIs) → placed Actors with `GA_Interact`,
  Niagara qi FX, and lore in a `DT_Lore` table. Spirit veins tie to the economy (sect wars over
  veins — `systems/24`).
- **Dynamic events** (world bosses, tribulation storms) via a Data-Layer + a lightweight world-event
  subsystem.

## Performance (open-world budgets)
- Nanite for geometry, Lumen for GI/reflections, Virtual Shadow Maps, World Partition streaming
  budgets per platform. Set **scalability groups** (Low→Epic) and a console-vs-PC target early.
- The prototype's greybox valley (`../../prototype3d/`) is a useful **scale/blockout reference** for
  the first region's layout and camera distances.
