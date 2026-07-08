# System: Cultivation, Worlds & Death

Cultivation replaces leveling and drives combat strength; Aura drives growth *speed*. World
layers are the ascending progression spine. **Read design-review issues #1 (death) and #4
(world fragmentation) — both are redesigned here.**

## 1. Gameplay overview
- **Cultivation realms** (Qi Gathering → Foundation → Golden Core → Nascent Soul → Soul
  Formation → …) are ordered stages; advancing between major realms requires a **Heavenly
  Tribulation** (a telegraphed, opt-in high-stakes event).
- **World layers** (Human I–IX → Spirit → Immortal → Divine → Origin) each add monsters,
  materials, fires, techniques, stronger Dao laws, civilizations.
- **Death is redesigned** (see below) — no default open-world realm-drop.

## Death & penalty model (replaces "3 deaths → demotion")
| Cause | Penalty | Notes |
|---|---|---|
| PvE | In-realm progress loss + durability loss + "wounded" debuff | Never a realm/world drop |
| Tribulation failure | Large, pre-warned, opt-in stake | The intended high-risk moment |
| Open-world PvP (both flagged) | Attacker gains notoriety/karma; victim loses little; bounty funds counterplay | Anti-grief |
| War/territory objective | Full stakes, scoped to that consensual ruleset | Opt-in via faction |
Optional **hardcore "Tribulation Realm"** offers the old high-risk demotion fantasy as a
*consensual opt-in mode*, never the default. See issue #1 for full rationale.

## 2. System architecture
- **Cultivation service** resolves growth ticks, realm advancement, and tribulation outcomes from
  **data-driven formulas** (`data/cultivation_realms.json`): each realm defines requirements,
  tribulation difficulty, aura-scaling curve, and rewards. No realm logic is hardcoded.
- **World service** owns layer definitions (`data/worlds.json`): unlock requirements, downward-pull
  incentives, resource exclusivity, and the population metrics that drive merges.
- Death outcomes are computed by the authoritative combat/instance server and emitted as events.

## 3. Database design
`character.cultivation_realm_id`, `character.world_layer_id`, cultivation progress (event-sourced
so it's auditable and rollback-safe), tribulation attempt log. Death events feed penalties and
anti-grief karma. All realm/world *definitions* live in config, referenced by id.

## 4. Networking
- Cultivation growth is mostly **passive/timed** — resolved server-side, synced on read; no hot
  path. Tribulation is an **instanced, tick-accurate event** (it's dramatic and must be fair).
- World-layer travel is a controlled transfer (like an instance/zone hand-off), authoritative.

## 5. Multiplayer synchronization
- A player's realm/aura is public profile data (eventually consistent).
- Tribulation happens in an instance so spectators/interference (if allowed) are synchronized
  tick-accurately.
- **Downward pull** (issue #4): high-realm players entering low worlds is a first-class supported
  flow (mentorship buffs, sect duties), keeping low worlds populated.

## 6. Security
- **Cultivation progress is precious and a prime cheat target** — fully server-authoritative;
  growth rates validated against aura + realm data; anomalous gains flagged.
- Tribulation outcome is server-computed; **disconnect-safe** (you cannot escape or fake a result
  by dropping connection — resolves the exploit surface of the original death rule).
- World-transfer gating validated server-side (no clipping into a layer you haven't unlocked).

## 7. Performance
- Passive cultivation scales trivially (timers + lazy resolution on read, not per-tick per-player).
- Tribulation instances are ephemeral and autoscaled.
- Population-per-layer is a live metric feeding the merge system.

## 8. Edge cases
- Offline growth accrual (bounded/rested to avoid pure-idle dominance).
- Interrupted tribulation (server decides; opt-in stakes are honored).
- Repeated PvE death farming for an exploit → penalties chosen so suicide has no upside.
- A world layer depopulating → merge tooling (issue #4).

## 9. Future scalability
- New realms/sub-stages, new world layers, new tribulation types = **data additions**. The realm
  list is an ordered, open registry; inserting a stage doesn't rewrite the engine.
- Race-specific cultivation/evolution trees are data-driven per race.

## 10. Recommended implementation order
1. `data/cultivation_realms.json` + `data/worlds.json` schema & content.
2. Passive cultivation resolution (aura-scaled, server-authoritative).
3. Tribulation as an instanced, disconnect-safe event.
4. Redesigned death/penalty + PvP karma (ship *before* open-world PvP).
5. World-layer travel + downward-pull incentives.
6. Population telemetry + layer-merge tooling.
