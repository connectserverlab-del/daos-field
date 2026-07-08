# 03 — Systems → Engine Mapping

Every system from the design bible (`../../docs/`) mapped to a concrete UE5 construct. This is the
translation layer: design intent on the left, engine implementation on the right.

| Design system (`../../docs/`) | UE5 construct | Notes |
|---|---|---|
| **Identity: Race/Cards/Aura/Element** (`systems/20`) | `AttributeSet` (AS_Identity) + `GameplayTags` + a `UDaosIdentityComponent`; card draw = server RNG service writing an identity `GameplayEffect` | Aura tier & element are permanent tags; the **converging aura math** (design-review #2) is an AttributeSet curve driven by `DT_Auras` (from `../../data/auras.json`). |
| **Cultivation realms** (`systems/21`) | Realm = `GameplayTag` `Cultivation.Realm.*`; progression = `AS_Cultivation` attributes; advancement = `GA_Breakthrough` | Realms/params come from `DT_CultivationRealms`. Growth rate = base × aura curve (server-authoritative). |
| **Heavenly Tribulation** | `GA_Tribulation` (a scripted, telegraphed encounter) + Niagara `NS_Tribulation` lightning + a Sequencer intro | Disconnect-safe: resolve server-side; opt-in high-stakes per design-review #1. |
| **Ascending worlds** (`systems/21`) | **World Partition + Data Layers**; each world layer = a Data Layer / streamed level; travel = seamless level transition | Downward-pull incentives + layer population = server logic; merge tooling = ops. |
| **Death / anti-grief** (design-review #1) | Death handled in `GA_Death` + `GE_DeathPenalty` keyed by **damage source tag** (PvE/Tribulation/PvP) | No default realm drop; penalties are GameplayEffects, tuned in data. |
| **Elements & interactions** (`systems/20`) | `DT_Elements` (from `../../data/elements.json`) drives a **damage execution calc** (`UGameplayEffectExecutionCalculation`) reading the interaction matrix | New elements = new DataTable rows + Niagara; **no code branch on element**. |
| **Techniques (single/dual/triple/domain)** | `GA_Technique_*` GameplayAbilities composed from element tags; domains = `GA_Domain` spawning a gameplay volume | Data-driven ability params via `DA_Technique` DataAssets. |
| **Heavenly Fire & crafting** (`systems/22`) | Crafting = server ability + `DT_Fires`/`DT_Recipes`; fire = an inventory item with a **tax-not-wall** success calc | Rental/escrow = backend economy service. |
| **Professions & economy** (`systems/23`) | Inventory/market = `DaosEconomy` UI + server RPCs to the **backend ledger** (money is never a client attribute) | See `09-networking-mmo.md`. |
| **Sects/Academies/Reputation** (`systems/24`) | Backend-owned; client shows via CommonUI; reputation is an **event-sourced backend projection** | Recruitment AI is a backend service, not in-engine tick. |
| **Combat (PvE/PvP/wars)** (`systems/25`) | **GAS** abilities + `UAbilitySystemComponent` on characters; instanced wars = separate level instances | See `05-combat-camera.md`. |
| **Monetization (cosmetic-only)** (`systems/26`) | Cosmetics = `DA_Cosmetic` entitlements applied to the MetaHuman; a **build-time check** asserts no cosmetic touches an AttributeSet | Enforces the anti-P2W guardrail in-engine. |
| **Appearance/customization** (`systems/27`) | **MetaHuman + modular parts + Control Rig**; slot catalog = `DT_AppearanceCatalog` | Permanent identity vs mutable look preserved: identity in AttributeSet, look in cosmetic components. |

## The three golden rules carried into the engine
1. **Server-authoritative.** Abilities/attributes run on the server; clients predict. The economy
   ledger lives in the **backend**, never as a replicated client attribute (dupe-proofing).
2. **Data-driven.** `../../data/*.json` → DataTables. Designers add elements/realms/worlds/fires by
   editing data + adding a Niagara/anim; engineers don't touch code for content.
3. **GameplayTags are the vocabulary.** One tag taxonomy spans identity, cultivation, elements,
   status, abilities — so systems compose without hard references.

## Minimum vertical slice to prove the mapping (in-engine)
Character creation (race + card draw writing identity tags/attributes) → a MetaHuman cultivator in
Human World I (World Partition) → `GA_AbsorbQi` growing `AS_Cultivation` at an aura-scaled rate →
`GA_SwordDao` attack vs the demon-beast enemy using the element execution calc → `GA_Breakthrough`
with a Niagara tribulation. That slice exercises GAS, World Partition, DataTables, MetaHuman, and
Niagara — the whole stack.
