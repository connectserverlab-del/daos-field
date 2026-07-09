# 01 — Engine Choice

**Decision: Unreal Engine 5.** Below is the honest comparison and why.

## Requirements this game puts on an engine
- **Photoreal characters & world** at *Where Winds Meet* / *Black Myth: Wukong* fidelity.
- **Large streamed open world** across ascending realms (Human World I → … → Origin World).
- **Deep action combat** with abilities, status effects, elemental interactions.
- **MMO scale** — many players, dedicated servers, an authoritative economy.
- **Data-driven content** so designers add elements/realms/fires as data (see `../../data/`).
- **10–15 year lifespan** — mature tooling, hiring pool, marketplace, long-term support.

## The comparison

| Dimension | **Unreal Engine 5** ✅ | Unity | Godot 4 |
|---|---|---|---|
| Out-of-box visual fidelity | **Nanite + Lumen = AAA today** | High with HDRP + work | Good, not AAA-open-world proven |
| Realistic characters | **MetaHuman** (free, film-grade) | Purchased/authored | Authored |
| Open world | **World Partition + Data Layers + PCG** built in | Needs 3rd-party streaming | Manual |
| Combat framework | **Gameplay Ability System (GAS)** — built for this | Author or asset | Author |
| Animation | **Control Rig, Motion Matching, retarget** | Mecanim (capable) | Capable |
| Networking | **Replication + dedicated server** mature; MMO needs backend either way | Netcode for GameObjects/Mirror | Immature for scale |
| VFX (qi, tribulation) | **Niagara** (best-in-class) | VFX Graph | Particles |
| Hiring pool (AAA) | **Largest for this genre** | Large | Small |
| Cost | 5% royalty after $1M | Per-seat/runtime | Free (MIT) |
| Risk for THIS game | **Lowest** | Medium | Highest |

## Why Unreal 5 wins for DAO'S FIELD
1. **MetaHuman** solves the single hardest problem the prototype hit — realistic, riggable, animatable
   humans — for free, immediately. Our `art-refs/characters/` become MetaHuman sculpt/texture targets.
2. **World Partition + Data Layers** map *directly* onto the "ascending worlds" design: each world
   layer is a Data Layer / level instance, streamed by distance; the demoted-world and downward-pull
   mechanics become layer-visibility logic.
3. **GAS** is purpose-built for exactly our cultivation/combat: cultivation realms, Dao techniques,
   elemental effects, Heavenly Tribulation are all `GameplayAbility` + `GameplayEffect` +
   `GameplayTag` + `AttributeSet` — the fairness math from design-review #2 lives in AttributeSets.
4. **Nanite/Lumen** deliver the cinematic bar the user keeps asking for, natively.

## When Unity would be the pick instead
If the team is Unity-native, or targeting lower-end mobile-first, Unity + DOTS/ECS scales entities
well and is cheaper to staff broadly. The design and data (`../../data/`) are engine-agnostic —
everything in this package ports; only the "engine construct" column of
`03-systems-to-engine-mapping.md` changes. **Godot** is not recommended for a AAA open-world MMO at
this scale/lifespan (tooling and networking maturity), though it's excellent for tooling/prototypes.

## Hard truth about "MMO"
No engine — UE5 included — *is* an MMO. UE5 gives you the client + a dedicated **game server**;
massive concurrency, the economy ledger, persistence, matchmaking, and social systems are a
**separate backend** (see `09-networking-mmo.md` and `../../docs/architecture/`). Budget for that as
its own track from day one.
