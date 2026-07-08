# 3D Models Manifest (`engine/art-refs/models/`)

Real **GLB meshes generated with Higgsfield `image_to_3d`** (textured) from Nano-Banana prop images
(three-quarter view on white). These are the Phase-2 test-map props, importable directly into UE5.

| File | Source prop | In-engine use | Target real-world size |
|---|---|---|---|
| `house.glb` | Ancient sect wooden house, tiled roof | Village building (Static Mesh); duplicate/rotate for a hamlet | ~5–7 m tall |
| `tree.glb` | Ancient pine, twisted trunk | Foliage instance (or Nanite foliage); scatter via PCG | ~9–14 m tall |
| `mountain.glb` | Rocky crag / peak | Terrain crag / cliff Static Mesh; scale up for a range | 30–50 m |
| `cave.glb` | Cave-entrance boulder formation | Cave portal mesh at a mountain base; add an interior level | ~7–9 m |
| `bridge.glb` | Arched wooden footbridge | River crossing (Static Mesh) | ~10–14 m span |

## Importing into UE5
1. **Import** the `.glb` (Static Mesh). Enable *Combine Meshes* off if you want sub-parts separable.
2. **Scale**: the meshes come at arbitrary scale — set uniform scale to the target size above, or
   author a Blueprint that normalizes on spawn (the test map does this at runtime).
3. **Collision**: generate simple collision (Auto Convex or per-part) — `image_to_3d` meshes ship
   with no collision.
4. **Nanite**: enable Nanite on the mountain/rock/house for high-density silhouettes; keep the tree
   as foliage (Nanite foliage or LOD'd card).
5. **Materials**: textures are baked albedo with some lighting baked in. For a hero pass, **retopo +
   re-bake PBR** (Normal/ORM) and de-light the albedo. For greybox/set-dressing, use as-is.

## Honest quality note
`image_to_3d` produces **good greybox / set-dressing props**, not hero assets: geometry can be soft,
topology is not hand-authored, and lighting is partly baked into the texture. Use them to block out
levels fast and as a **modeling reference**; commission or author hero versions for close-up assets.
The value here: a real, working **Higgsfield → GLB → engine** pipeline you can repeat for hundreds of
props (fences, lanterns, statues, herbs, rocks, market stalls…) by generating an image and converting.

## Regenerating / extending
Generate a prop image (`generate_image`, three-quarter view, pure white background, no shadow) →
`generate_3d` (`image_to_3d`, `should_texture:true`) → GLB. Batch it for a whole prop kit.
