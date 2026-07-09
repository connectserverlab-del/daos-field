# 05 — Combat, Camera & Game Feel

Combat is GAS-driven and server-authoritative. Camera and "juice" are what make it read AAA.

## Gameplay Ability System (GAS) shape
- **AttributeSets**: `AS_Vitals` (Health, Qi, Stamina, Poise), `AS_Cultivation` (realm progress,
  growth rate), `AS_Offense/Defense` (attack, defense, elemental affinities), `AS_Identity`
  (aura tier, element tags). The **converging aura curve** (design-review #2) is a `FRealCurve` on
  `AS_Cultivation` sourced from `DT_Auras`.
- **Abilities** (`GA_*`): `GA_SwordDao_Light/Heavy`, `GA_Dodge`, `GA_Block`, `GA_Parry`,
  `GA_Technique_<element>`, `GA_Domain`, `GA_AbsorbQi`, `GA_Breakthrough`, `GA_Tribulation`.
- **Effects** (`GE_*`): damage, DoTs (Dark/poison), buffs, stagger, tribulation stakes — all data
  tunable.
- **Elemental interaction**: a `UGameplayEffectExecutionCalculation` reads attacker/defender element
  tags and the matrix in `DT_Elements` (`../../data/elements.json`) to compute the multiplier. New
  elements never touch combat code.
- **Costs/cooldowns**: techniques cost Qi (a real resource, regenerates); this makes the prototype's
  "attack costs qi" idea a first-class GAS cost.

## Damage & hit detection
- Melee: **AnimNotifyState** windows enable weapon trace (or GAS `GameplayCue` + hit sphere);
  server validates. No client-authored damage.
- Poise/stagger system for weighty melee (Souls-like weight, matching the cinematic ask).
- Lock-on/soft-target with a camera assist; optional for accessibility.

## Third-person camera (the cinematic layer)
- `USpringArmComponent` + `UCameraComponent`; **Camera Modifiers** for combat vs exploration.
- Dynamic FOV kick on sprint/heavy attack, subtle handheld noise, hit-directional framing.
- **Post-process**: Lumen GI, exposure, a **color-grade LUT** matching our key art
  (`art-refs/keyart/`), depth of field for cinematics, motion blur (toggleable — accessibility).
- Cinematic tribulation/breakthrough moments use **Sequencer** with a temporary camera cut.

## Game feel ("juice") — parity with, and beyond, the prototype
- **Hit-stop** (brief global or per-actor time dilation on impact) — tune 40–90ms.
- **Screen shake** (`UCameraShakeBase`) scaled by hit weight; respect an accessibility toggle.
- **Camera-relative knockback**, directional hit reactions, ragdoll on death (Chaos).
- **Niagara** qi trails on the blade, element bursts, tribulation lightning, footstep dust on the
  valley ground.
- **Rumble/haptics** via Enhanced Input force feedback.
- **Damage numbers / status readouts** in CommonUI (optional, accessibility-friendly styling).

## Quality-of-life the design mandates
- Full **key/controller remap** (Enhanced Input Mapping Contexts), invert-Y, sensitivity, aim assist.
- Difficulty presets tuning `GE_` incoming-damage scalars (Story/Normal/Hard).
- Assist options: lock-on, slow-time-on-parry, larger hit windows — all data scalars, not new code.
