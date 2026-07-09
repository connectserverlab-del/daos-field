# DAO'S FIELD — Human World I (cinematic 3D open-world slice)

A real-time WebGL vertical slice: roam a misty ancient-China cultivation valley in
third person. Built with Three.js (r128, vendored) + generated textures and an
ambient guqin score.

**Live:** https://bright-island-955.higgsfield.gg/

## What's in it
- **Real 3D hero** — a rigged, animated GLB cultivator (Higgsfield → Meshy:
  image → textured mesh → auto-rig → idle / walk / run / Sword-Judgment attack).
  Replaces the old billboard sprite; falls back to the sprite if the GLBs are absent.
- **3D village** — timber houses + a three-tier pagoda (Higgsfield GLBs) around a
  packed-earth plaza with a well, fences and hanging lanterns.
- **Photoreal landmarks & props (Higgsfield GLBs)** — a monumental sacred **Dao
  Tree**, a weathered **red arched bridge** over the river, **stone lanterns**
  lining the path, an **ancient stele**, scattered **boulders**, and lived-in
  village props (**ceramic jars**, **herb-drying rack**). Placed ecologically and
  reachable via the dev-panel teleports.
- **Elemental attacks channelled from the hand** — the attuned element's energy
  fires from the hero's hand bone on attack (never the feet), with a muzzle burst,
  spiralling trailers and a forward bolt.
- Wide valley heightfield (2 km plane) with a flattened village plateau, rolling
  hills, a carved river + lotus pond, and a stone arch bridge.
- **Photoreal ground** — Higgsfield-generated meadow / dirt / granite textures with
  multi-scale anti-tiling; dense tall **grass** (real blade cards) with a near-field
  layer that follows the player for a lush cinematic foreground; a dirt **pathway** network.
- **Foliage** — blue hydrangea clusters and ferns (transparent cutouts) along the
  banks, village and forest edges.
- **C-drama atmosphere** — soft hazy sky, a layered misty-mountain backdrop panorama,
  cool volumetric fog and a cinematic colour-grade post pass (teal shadows / warm highs).
- Unique **forest biomes** built from **five photoreal 3D tree models** (Higgsfield
  image→3D GLBs) — evergreen pine, broadleaf maple, emerald elm, and **two cherry
  blossoms** (pink and white) — GPU-instanced with wind sway and per-tree colour
  variance, plus a procedural bamboo grove and scattered rocks.
- Bright midday sky, atmospheric fog, distant snow-capped mountains, animated
  reflective water, drifting motes, falling sakura petals, ground mist, bloom.
- Cinematic third-person camera; three lore POIs (Spirit Vein, Stele, Cloud Shrine).
- Keyboard + mouse, touch (virtual stick + look), gamepad. Ambient score.

## Developer panel
Click **⚙ DEV** (or press **`** ) to open the dev panel:
- **Grant any element** — every element from `data/elements.json`, grouped by
  rarity. Click to grant (adds an orbiting elemental mote + HUD chip); click a
  granted element again to *attune* it (tints the aura and drives the hand VFX).
  Grant-all / Clear.
- **Teleport** to the village, spawn, and each POI.
- **World toggles** — move-speed, daylight, fly (R/F up-down), flip hero facing, FPS.

### Yunhe Water Town (云河水镇) — new river-city district
Walk north from the starter field and the ground levels into a hyperreal ancient-Chinese
water town built on a stone plaza straddling a carved canal (`rivercity.js`). It is a
fully walkable hub, not a backdrop:
- **Buildings** (modular, weathered PBR): riverside tea house, alchemist, blacksmith with
  a glowing forge, merchant hall, an inn, residences, a riverside pavilion, a paifang
  entrance gate with the town-name plaque, and a distant 7-storey **sect pagoda** on the
  cliff as a long-term landmark.
- **Water & traversal**: a canal with animated ripple + lantern reflections, wooden docks
  with stone steps, a **great arched stone bridge** with a lantern-lit crown pavilion, two
  wooden footbridges, a drifting covered ferry and several docked boats.
- **Detail**: paper-lantern streetlamps, cherry-blossom trees, bamboo, market stalls,
  crates, ceramic jars, banners, canal mist and drifting petals.
- **Gameplay**: flat walkable plaza (terrain-blended at the edges), full building/prop/canal
  **collision** (only bridges cross the water), and five interactable **NPC markers** —
  Village Elder, Alchemist, Blacksmith, Merchant, Sect Recruiter — served by the existing
  observe/lore system. The location-name HUD swaps to *Yunhe Water Town* on entry.
- **Materials**: six Higgsfield-generated 2K seamless textures (aged roof tiles, weathered
  timber, wet canal stone, cobble paving, rice-paper lantern, lime plaster) with normal
  maps derived in-engine. All existing gameplay systems are preserved untouched.

## Honest scope
One explorable valley — a *vertical slice*, not a full open world, and a browser
WebGL build cannot match a native AAA engine like *Where Winds Meet*. It proves the
cinematic exploration feel within the deployable medium.

## Run locally
`python3 -m http.server` in this folder, open the URL (ES/global scripts need http,
not file://). Add `?dev=1` for an FPS overlay. The hero/building GLBs live in
`assets/models/`.
