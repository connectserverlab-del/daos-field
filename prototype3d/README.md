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

## Honest scope
One explorable valley — a *vertical slice*, not a full open world, and a browser
WebGL build cannot match a native AAA engine like *Where Winds Meet*. It proves the
cinematic exploration feel within the deployable medium.

## Run locally
`python3 -m http.server` in this folder, open the URL (ES/global scripts need http,
not file://). Add `?dev=1` for an FPS overlay.
