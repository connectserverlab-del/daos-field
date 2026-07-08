# Netcode, Sharding & the "Seamless Millions" Problem

**Honest premise:** no single server holds millions of players in one seamless space with
real-time combat. "Seamless for millions" is achieved by *illusion* — Area of Interest,
channels/megaserver, and instances — not by one giant simulation. Committing to this now
prevents a Year-2 rewrite (design-review issue #7).

## The three population containers

### 1. Open world (high capacity, medium fidelity) — World Servers
- The world is split into **spatial cells** (a grid/quadtree over each world layer). Each cell is
  owned by a world-server process; neighbors coordinate for seamless **hand-off** as players walk
  across boundaries.
- **Area of Interest (AOI):** a client only receives entity updates within its interest radius.
  Bandwidth per client is bounded by *local* density, not global population. Crowded hubs use
  tighter radii + update coalescing.
- **Channels/layers:** if a cell exceeds capacity, spin up parallel channels of that cell
  (soft-sharding the same coordinates). Social systems let friends/sect pick a shared channel.
- Combat here is lower-tick and forgiving — good enough for open-world skirmishes, gathering,
  world-event tagging.

### 2. Instances (bounded capacity, high fidelity) — Instance Servers
- Secret realms, raids, dungeons, **sect wars, territory wars, domain battles** run as instances
  with hard participant caps. This is where we can afford authoritative tick-accurate simulation,
  precise elemental interactions, and positioning-heavy combat.
- Ephemeral: created on demand, torn down after, autoscaled.

### 3. Social/economic layer (global, async) — Domain Services
- Market, mail, chat, sect politics, reputation, recruitment operate above the spatial layer and
  are globally reachable regardless of which cell/channel you're standing in.

## Synchronization model
- **Server-authoritative** simulation. Clients send *inputs/intents*; server resolves outcomes.
- **Client-side prediction + reconciliation** for the local player's movement/abilities to hide
  latency; server corrections are authoritative.
- **Interpolation** of remote entities from snapshots; **interest-scoped** snapshot streams.
- **Tick rates by container:** instances high (combat-grade); open world lower (movement-grade);
  domain services event-driven (no tick).
- **Delta compression + relevancy filtering:** send only what changed within AOI, prioritized by
  importance (the boss's cast > a distant player's idle animation).

## Cell hand-off & consistency
- A player is authoritative on exactly one server at a time. Hand-off transfers authority with a
  fenced token + state version; the old cell forwards stragglers briefly.
- Actions spanning cells (an AOE across a boundary, a trade across a channel) resolve through the
  relevant domain service, not by two world servers negotiating raw state.

## Anti-cheat / security in netcode
- Never trust client-reported position, damage, hit results, cooldowns, or resource counts —
  the server computes them. Client "sees" a preview; server confirms.
- **Speed/teleport/rate sanity checks** server-side; anomalies flagged to anti-cheat.
- **Death, tribulation, and death-counters must be server-authoritative and disconnect-safe** —
  directly relevant to design-review issue #1: a player must not be able to dodge or fake a death
  outcome by pulling the plug, nor be griefed by a forced one.

## Performance guardrails
- Bandwidth per client is a function of AOI density, not world population → the system scales
  horizontally by adding cells/channels/instances.
- Hot loops in memory; persistence async and batched; back-pressure on the event bus.
- Load-test the *crowded hub* and the *world-boss zerg* early — they are the worst cases, and
  they're where launch-day screenshots (and outages) happen.

## Scalability path
- Add world layers, cells, channels, and instance pools independently.
- Merge under-populated world layers/channels with pre-built tooling (issue #4).
- Regionalize (geographic server groups) for latency; keep the economy strongly consistent
  within a region and reconcile cross-region asynchronously if ever needed.
