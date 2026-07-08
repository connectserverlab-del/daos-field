# System Architecture — Service Topology

Goal: support millions of accounts, an authoritative economy, and real-time-ish combat, while
letting designers add content as data. Favor **modular services + data-driven rules** over a
monolith.

## Guiding principles
- **Authoritative server.** The client is never trusted. It's a renderer + input sender.
- **Simulation vs. persistence split.** Fast, in-memory game servers own live simulation;
  durable stores own truth. They reconcile through events, not shared DB access.
- **Event-sourced where integrity matters** (economy, reputation, identity). Append-only logs
  are the source of truth; read models are projections. This gives audit, replay, and safe
  migration — the antidote to the "hardcoded permanence" risk.
- **Data-driven rules.** Elements, realms, worlds, fires, recipes, drop tables, tribulation
  formulas live in versioned config (`data/`), hot-loadable, never in `if`-ladders.

## Service map (logical, not one-box-per-team)

```
                 ┌────────────┐
   clients ───▶  │  Gateway   │  auth, session, rate-limit, encryption, routing
                 └─────┬──────┘
        ┌──────────────┼───────────────────────────────┐
        ▼              ▼                                ▼
  ┌──────────┐   ┌───────────┐                   ┌────────────┐
  │  World   │   │ Instance  │                   │  Realtime  │
  │ Servers  │   │ Servers   │                   │  Combat    │
  │ (AOI/    │   │ (raids,   │                   │  (tick sim │
  │  cells)  │   │ secret    │                   │  in inst.) │
  └────┬─────┘   │ realms,   │                   └─────┬──────┘
       │         │ wars)     │                         │
       │         └────┬──────┘                         │
       ▼              ▼                                ▼
  ┌─────────────────────────────────────────────────────────┐
  │                    Domain Services                        │
  │  Identity  Cultivation  Crafting  Economy/Market  Sect    │
  │  Reputation  Recruitment(AI)  Chat/Social  Matchmaking    │
  └───────────────┬───────────────────────┬──────────────────┘
                  ▼                        ▼
        ┌───────────────────┐    ┌──────────────────────┐
        │  Event Log (bus)  │    │  Persistence layer    │
        │  Kafka/Redpanda   │    │  OLTP + cache + OLAP  │
        └───────────────────┘    └──────────────────────┘
```

## Component responsibilities
- **Gateway:** TLS, authentication, session tokens, connection multiplexing, DDoS/rate limits,
  routing to the correct world/instance server. Stateless, horizontally scaled.
- **World servers:** own a *region* of a world layer via spatial cells; run AOI; handle open-world
  movement, gathering, low-stakes encounters. Cells hand players off to neighbors seamlessly.
- **Instance servers:** spin up bounded, tick-accurate simulations for raids, secret realms,
  sect/territory wars, domain battles. Where "real" combat fidelity lives.
- **Domain services:** stateless-ish business logic behind the sim. Cultivation resolves growth;
  Economy is the authoritative ledger; Crafting validates recipes + fire gating; Reputation is
  an event-sourced projection; Recruitment AI reacts to reputation events (never polls players).
- **Event bus:** the spine. Every meaningful action emits an event; services subscribe. Enables
  reputation, achievements, analytics, anti-cheat, and recruitment without tight coupling.
- **Persistence:** OLTP for hot state, cache for reads, OLAP/warehouse for analytics + economy
  monitoring + design telemetry.

## Data-driven rule loading
Config in `data/` is validated against JSON Schema in CI, versioned, and published to a
**Config service**. Game servers subscribe and hot-reload. A balance change (e.g., Fire element
tribulation modifier) is a config PR + deploy, not an engine build. **Never** branch on element
or realm names in code — resolve behavior by looking up the entity's data.

## Security posture (cross-cutting)
- Server-authoritative everything; validate every action against server-side state.
- Economy actions are transactional and idempotent (dupe-proof); every mutation is an event with
  an idempotency key.
- Rate-limit and anomaly-detect at the gateway and the economy service (gold-flow analysis, RMT
  pattern detection, Sybil clustering for reputation).
- Secrets/keys never on client; anti-tamper on client is a speed bump, not a trust boundary.

## Performance posture
- AOI + interest management cap per-client bandwidth regardless of global population.
- Hot path (movement, combat tick) stays in memory; persistence is async + batched.
- Cache-aside for read-heavy data (profiles, market listings); write-through for money.
- Instance servers are ephemeral and autoscaled to demand.

See `12-netcode-and-sharding.md` for the world/AOI/instance detail and `11-data-model.md` for
storage.
