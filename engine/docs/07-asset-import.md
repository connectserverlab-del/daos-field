# 07 — Asset Import Guide

What's in `art-refs/`, how to import it, and — importantly — **what is final vs reference**.

## Reference vs production
All `art-refs/` are **AI-generated (Higgsfield/Nano Banana)**. Treat them as:
- **Concept / look targets** (key art, character portraits, enemy) — *not* final in-game assets.
- **Directly usable-with-work** (PBR ground textures, ambient audio) — usable as albedo/audio after
  the steps below.
- **Animation reference** (the hero/enemy sprite strips) — pose/timing guides, *not* animations.

## By folder
### `art-refs/keyart/` — `bg_dawn_mountains.png`, `bg_world1.png`
Use for: **color-grade LUT** authoring, marketing, loading screens, and lighting/mood target for the
first region. Not a skybox. Build the real sky with Sky Atmosphere (`06`).

### `art-refs/characters/` — race portraits + `enemy_demon_beast.webp`
Use for: **MetaHuman likeness targets** and modular-part design (horns/scales/antlers), material
callouts (ivory/bronze/lacquer robes). Feed into MetaHuman Creator / Mesh-to-MetaHuman (`04`).

### `art-refs/textures/` — `grass_ground`, `dirt_ground`, `cliff_rock` (2K, seamless)
Use as **Landscape layer albedos**. To make them production PBR:
1. Confirm tiling (they were generated seamless); fix seams in Substance/Photoshop if needed.
2. Generate **Normal, Roughness, AO, (Height)** maps — Substance Sampler (image-to-material),
   Materialize, or ADOBE/marketplace tools. (The prototype derived normals in code as a stopgap; do
   it properly here.)
3. Pack **ORM** (Occlusion/Roughness/Metallic) into one texture; import as the layer's material
   instance params. Set correct sRGB (albedo sRGB on; normal/ORM sRGB off).

### `art-refs/sky/` — `sky_dawn.webp` (4K panorama)
Look reference for the dawn grade. Optionally a far cloud card, but prefer Volumetric Clouds.

### `art-refs/anim-refs/` — `hero_run/attack/idle.webp` (green-screen sprite strips)
**Animation reference only.** Frames read left→right. Give to animators / use for motion-matching
target poses. The green (`#00FF00`) is a chroma key from the prototype; ignore it here.

### `art-refs/ui/` — `card_back.png`, `aura_glow.png`
UI/UMG art: Heavenly Card back (character creation), aura glow (Niagara/UI). Usable with cleanup.

### `art-refs/audio/` — `ambient_score.m4a`
Loopable guqin/dizi ambient bed. Import to `Content/Audio/Music`, drive via MetaSounds with a volume
submix wired to the settings menu.

## Import checklist (UE5)
- Textures: correct compression (Default for albedo, Normalmap for normals, Masks for ORM), sRGB
  flags, virtual textures for large landscape sets.
- Audio: import to a **Sound Submix** hierarchy (Master → Music/SFX/Ambience) so the QoL volume
  sliders map to submix sends.
- Keep source art in `Content/__Source/` (not cooked) or an external art depot; import derived
  assets into `Content/`.

## What you still need to make (not in this package)
Final character meshes/rigs, animations, VFX, most environment meshes, and production PBR map sets.
This package gives you the **look, the data, the systems, and the reference art** to make them fast.
