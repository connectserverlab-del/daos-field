# 02 — UE5 Project Structure

A clean, scalable layout for a multi-year team. Favors **C++ for systems, Blueprint for content**,
and keeps everything **data-driven** so designers ship content without engineers.

## C++ module layout (`Source/`)
Split into Gameplay Modules so build times and ownership stay sane:

```
Source/
  DaosField/            # primary game module (game mode, player state, save)
  DaosCultivation/      # GAS attribute sets, cultivation realms, tribulation, aura math
  DaosCombat/           # abilities, damage, elemental interaction resolver
  DaosWorld/            # world-layer streaming, POIs, spirit veins, dynamic events
  DaosEconomy/          # client-side market/inventory UI + server RPC stubs
  DaosData/             # DataAsset/DataTable definitions mirroring ../../data/ schemas
  DaosUI/               # CommonUI widgets, HUD, menus
  DaosNet/              # replication helpers, backend service client
  DaosEditor/           # editor-only tooling (data validators, content checks)
```

Rationale: `DaosData` + `DaosCultivation` are the load-bearing modules — they encode the design-bible
math. Keep them engine-light and unit-testable.

## Content layout (`Content/`)
```
Content/
  Characters/
    Player/{Meshes,Anim,ControlRig,Materials}      # MetaHuman-derived cultivator
    Enemies/DemonBeast/{...}                        # from art-refs/characters/enemy_demon_beast
    Shared/Anim/                                    # locomotion, combat, cultivation montages
  Abilities/                                        # GA_* GameplayAbility BPs, GE_* effects, GameplayTags
  Data/
    Elements/  Auras/  Realms/  Worlds/  Fires/     # DataTables imported from ../../data/*.json
    Techniques/ Recipes/ DropTables/               # added later, same pattern
  World/
    HumanWorld_01/  (…)  ImmortalWorld/            # one folder per world layer (Data Layers inside)
    PCG/                                            # PCG graphs for terrain scatter
    Landscape/Materials/                            # layered terrain material (see 06)
  VFX/Niagara/{Qi,Tribulation,Elements}
  UI/{HUD,Menus,Market,CharacterCreate}
  Audio/{Music,SFX,Ambience}
  Cinematics/                                       # Sequencer assets
```

## Naming conventions (enforce in CI via DaosEditor validators)
- Prefixes: `BP_` Blueprint, `GA_` GameplayAbility, `GE_` GameplayEffect, `AS_` AttributeSet,
  `DT_` DataTable, `DA_` DataAsset, `NS_` Niagara System, `M_`/`MI_` Material/Instance,
  `SK_`/`SM_` Skeletal/Static Mesh, `T_` Texture, `WBP_` Widget Blueprint.
- One Gameplay concept = one `GameplayTag` namespace: `Cultivation.Realm.GoldenCore`,
  `Element.Fire`, `Ability.Technique.SwordDao`, `Status.Tribulation`.

## Source control & build
- **Perforce** (UE5 standard for binary assets at team scale) or Git LFS for smaller teams.
- **Unreal Game Sync (UGS)** for binary+build distribution.
- Nightly cook + a **dedicated-server** target from day one (don't retrofit — see `09`).
- Keep `../../data/*.json` as the **source of truth**; a commitlet or editor utility re-imports them
  into `Content/Data/` DataTables so design edits flow in without hand-editing UE assets.

## Config
- `Config/DefaultGame.ini` / `DefaultEngine.ini`: enable World Partition, Lumen, Nanite, Enhanced
  Input, CommonUI, GAS plugin (`GameplayAbilities`), Niagara, PCG.
- Feature flags for expansions live in a `DA_FeatureFlags` DataAsset, not `#ifdef`.
