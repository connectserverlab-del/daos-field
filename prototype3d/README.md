# DAO'S FIELD — Human World I (cinematic 3D open-world slice)

A real-time WebGL vertical slice: roam a misty ancient-China cultivation valley in
third person. Built with Three.js (r128, vendored) + generated textures and an
ambient guqin score.

**Live:** https://bright-island-955.higgsfield.gg/

## What's in it
- Procedural valley heightfield (rolling hills, raised rim, carved river channel).
- Photoreal generated ground/rock textures; instanced wind-swaying grass; pines; rocks.
- Ring of misty mountains, animated water, gradient dawn sky + sun.
- Atmosphere: volumetric fog, drifting spirit motes, falling petals, ground mist,
  UnrealBloom god-rays, letterbox + vignette + film grain.
- Cinematic third-person camera (smooth follow, breathing, FOV kick, orbit).
- Three lore points of interest (Spirit Vein, Ancient Stele, Cloud Shrine) tied to
  the design bible.
- Robed cultivator with race-tinted aura; pick an origin at the title.
- Full input: keyboard + mouse, touch (virtual stick + look), gamepad. Ambient score.

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
not file://). Add `?dev=1` for an FPS overlay.
