# System: Combat (PvE, PvP, Wars, Raids, Domains)

Combat should reward strategy, positioning, professions, and elemental interaction — not raw
stats alone. It also intersects the two highest-risk systems: death penalties (issue #1) and
world topology/netcode (issue #7).

## 1. Gameplay overview
Modes: PvE, open-world PvP (flagged + karma), world bosses, sect wars, territory wars, raids,
domain battles. Depth comes from:
- **Elemental interactions** (data-driven advantage/synergy: e.g., Water vs Fire, dual/triple/
  domain techniques) — not a rock-paper-scissors hardcode but a data matrix.
- **Positioning & domains** (area control, formations placed by Formation Masters).
- **Profession contribution** (medics sustain, alchemists' pills fuel, formation masters shape
  the field) so non-combat professions matter *in* combat.

## 2. System architecture
- **Heavy, fair combat runs in instances** (raids, wars, domains, secret realms) on **Instance
  Servers** with authoritative tick simulation.
- **Open-world combat** runs on World Servers at lower fidelity/tick (movement-grade), good enough
  for skirmishes and boss tagging.
- Abilities, element interactions, damage formulas, status effects, cooldowns = **data-driven**
  (techniques as data; new techniques/elements ship as content, not code).

## 3. Database design
- Combat is mostly transient (in-memory sim). Persistent bits: loadouts, learned techniques,
  cooldowns-on-logout policy, war/objective results (events), death events + penalties, bounty/
  karma state.
- Combat/damage logs (high-volume) → document/OLAP store for anti-cheat + balance.

## 4. Networking
- **Server-authoritative** hit resolution; client sends intents, sees predicted previews, server
  confirms. Client-side prediction + reconciliation for the local player; interpolation for
  remote entities.
- AOI-scoped combat updates; importance-prioritized (the boss cast beats a distant idle).

## 5. Multiplayer synchronization
- Instances: high tick, authoritative, bounded participants → affordable precision.
- Open world: snapshot + delta, interest-managed; big zergs handled by relevancy filtering + LOD
  on updates.
- War/domain outcomes emit events to sect/reputation/economy systems.

## 6. Security
- **Never trust the client** for damage, hits, cooldowns, resources, or position (issue #7).
- **Death & tribulation outcomes are server-authoritative and disconnect-safe** (issue #1: no
  fake/dodged deaths, no forced-grief demotions).
- Anti-cheat: server-side speed/teleport/rate checks; damage sanity vs. character data;
  statistical anomaly detection on combat logs.

## 7. Performance
- Instances autoscale; ephemeral.
- Open-world worst cases (crowded hub, world-boss zerg) are the load-test priority — relevancy
  filtering, update coalescing, and AOI radius tuning keep bandwidth bounded.

## 8. Edge cases
- Disconnect mid-fight (combat log-out timer; no safe-logging to dodge death).
- Instance server crash → checkpoint/rejoin policy; no lost raid progress dupes/losses.
- Cross-cell AOE at a boundary → resolved via the authoritative owner + domain service, not
  peer negotiation.
- PvP flag toggling to dodge consequences → flag has commit windows/cooldowns.

## 9. Future scalability
- New elements/techniques/domains/boss mechanics/war formats = **data + new instance rule sets**.
- The element-interaction matrix is data, so adding Time/Space/Life/Fate/Death/Rule elements
  extends the matrix without touching the combat engine.

## 10. Recommended implementation order
1. Core server-authoritative combat resolution + data-driven techniques/element matrix.
2. PvE + open-world fidelity/AOI tuning.
3. Instanced content (dungeons/secret realms) — the fidelity showcase.
4. Flagged PvP + karma/bounty (paired with the redesigned death model — issue #1).
5. Group content: raids, then sect/territory/domain wars (tie into sect/reputation systems).
6. Anti-cheat telemetry throughout.
