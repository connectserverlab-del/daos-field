# System: Appearance & Character Customization

Players must be able to customize their character "however they want." This system covers how —
**without** it ever becoming pay-to-win, and while staying consistent with the identity model
(permanent *destiny*, mutable *appearance*).

## The core split: destiny is permanent, appearance is free
- **Identity/power** (Race, Cards, Aura, Element, Dao) — permanent, event-sourced, *never* for sale
  (see design-review #2, monetization doc).
- **Appearance** (face, body, hair, skin, eyes, racial features, outfit, aura *visual* flair) —
  **fully mutable, fully cosmetic, decoupled from power.** Changing your look changes *nothing*
  about your strength or growth. This is what makes "customize however you want" safe: it's the
  **expression** pillar with the power lever physically removed.

## 1. Gameplay overview
At creation and any time after (via an in-world "appearance" service — a barber/soul-mirror),
players compose their character from **slots**, each filled by a catalog **item id**. Race gates
some slots (beast horns, spirit-beast antlers/markings, monster scales/eye color); most are
universal (skin tone, hair, face shape, body type, scars, outfit dye). Nothing here touches
cultivation, crafting, or combat numbers.

## 2. System architecture
- **Appearance is a data-driven slot map**, not hardcoded models:
  `appearance = { body, face, skin, eyes, hair, facial_hair, markings[], horns?, ears?, outfit,
  outfit_dye, aura_vfx }` — every value is a **catalog item id**. New options (new hairstyles,
  new racial features, seasonal outfits) ship as **catalog data**, never code.
- **Catalog** entries declare: id, slot, race gate (or universal), rarity, source (default /
  earned / cosmetic-shop), and the asset/material params. Same open-registry pattern as
  `data/elements.json`.
- **Appearance service** validates a requested look against the catalog + the character's race
  gates, then appends an **`AppearanceChanged` event**. Current look is a projection — so a
  future engine/art update can re-skin everyone by reprojecting, and any change is auditable.

## 3. Database design
- `character_appearance(character_id, slot, item_id, params_json)` — the projection.
- `appearance_event(event_id, character_id, slot, item_id, params_json, source, created_at)` —
  append-only history (mirrors identity event-sourcing; §11 data-model doc).
- Catalog lives in versioned config (`data/appearance_catalog.json`), referenced by id.
- Entitlements for *cosmetic-shop* items live on the account (`entitlements_json`) and are
  **power-inert** — the CI guardrail (monetization doc) asserts no appearance SKU maps to a
  power mutation.

## 4. Networking
Customization is a request/response flow (not latency-sensitive). Other players resolve your
look from the **public appearance projection**, streamed via AOI like any visual state
(eventually consistent — a slightly late hair change is invisible in practice).

## 5. Multiplayer synchronization
Appearance is cosmetic visual state: eventually consistent, cached, AOI-scoped. It never affects
authoritative simulation (hitboxes derive from the rig/race, not from cosmetic sliders — a taller
"body slider" must not grant reach; enforce a fixed gameplay capsule per race).

## 6. Security
- **No power via cosmetics** — validated server-side + the build-breaking CI guardrail.
- **Race-gate validation server-side** (no clipping a mythic-race feature onto a human).
- Cosmetic entitlements granted only on verified purchase (idempotent, refund-aware).
- **Fairness in PvP:** cosmetics may not confer a competitive read advantage (e.g. a near-
  invisible skin); enforce minimum silhouette/contrast per the readability rules (L10.1).

## 7. Performance
- Modular parts batch/instance per the performance law (§6.5) — shared meshes + material param
  swaps, not a unique mesh per player.
- Cosmetic detail scales down at distance/crowd density (LOD); the hidden is not drawn.

## 8. Edge cases
- A cosmetic item retired/rebalanced → because it's data + event-sourced, reproject to a fallback
  without corrupting saves.
- Race change (if ever allowed) → re-gate appearance, migrate incompatible slots to defaults.
- Disconnect mid-edit → atomic apply; either the new look commits or the old one stands.

## 9. Future scalability
- **Prototype (today):** the 4 races are photoreal AI-generated portrait stills (reference-guided,
  see `prototype/`). Good enough to prove the *feel*, but a fixed still is **not** customizable.
- **The real answer is a parametric 3D character creator:** modular meshes + **morph targets**
  (face/body sliders) + material parameters (skin, eyes, hair color) + attachment slots (horns,
  antlers, markings, outfits). All slot options are data; the creator UI is generated from the
  catalog. This is the industry-standard path (think a cultivation-themed MetaHuman-style creator)
  and it's what "customize however you want" ultimately requires.
- **Interim upgrade path for the prototype:** move from one still-per-race to **layered portrait
  composition** (base + swappable hair/eyes/markings/outfit layers) or on-demand parametric
  portrait generation — a stepping stone toward the 3D creator, still fully data-driven.

## 10. Recommended implementation order
1. Appearance slot schema + `data/appearance_catalog.json` (universal + race-gated items).
2. Event-sourced appearance service + projection + public profile wiring.
3. Prototype: layered portrait composition (swappable hair/eyes/markings/outfit over the base).
4. In-world appearance changer (barber/soul-mirror) — a *convenience*, never power.
5. Cosmetic shop hooks (extra slots, premium outfits/dyes) behind the P2W-guardrail CI test.
6. Full 3D parametric creator (morph targets + modular meshes) for the client build.

## Why this honors the pillars
Deep, free customization feeds the **expression** engagement source and the fair-monetization
moat (cosmetics are the revenue, power never is). Keeping appearance mutable while destiny stays
permanent lets a player's *look* evolve across a 10-year journey while their *legend* — the cards
they drew, the aura they awakened — stays the story that's theirs.
