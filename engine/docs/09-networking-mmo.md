# 09 — Networking & the MMO Backend

**The engine is the client + a game server. It is not the MMO.** Massive concurrency, persistence,
the economy, and social systems are a **separate backend** — the architecture already designed in
`../../docs/architecture/`. This doc bridges UE5 to that backend.

## Two layers, drawn deliberately
```
   UE5 client  ─┐
                ├─ UE5 Dedicated Server (per zone/instance): movement, GAS, combat, AOI
   UE5 client  ─┘        │  authoritative simulation, replication
                         ▼
          Backend services (language-agnostic; ../../docs/architecture/)
          Gateway · Identity · Economy(ledger) · Reputation · Sect · Matchmaking · Persistence
                         │  event bus, OLTP + cache, strongly-consistent money
```

## What UE5 owns
- **Replication + dedicated server** for real-time zone simulation: movement, GAS abilities/attributes,
  combat, Area-of-Interest relevancy (UE Replication Graph for large actor counts).
- **Server authority**: abilities and attribute changes run on the dedicated server; clients predict
  and reconcile (GAS supports prediction). Never trust client for damage/position/resources.
- **Instances**: raids, secret realms, sect/territory wars = spun-up Level Instances / server
  processes with participant caps (the fair, high-fidelity combat spaces).

## What the backend owns (NOT UE attributes)
- **Economy/money = the ledger** (append-only, idempotent) in the backend — never a replicated client
  attribute (dupe-proofing, design-review #9). UE calls economy RPCs; the ledger is truth.
- **Persistence** of characters, inventory, cultivation progress (event-sourced — `../../docs/architecture/11-data-model.md`).
- **Reputation/recruitment** (event-sourced projections, Sybil-guarded — `systems/24`).
- **Matchmaking, social, chat, sect politics.**
- **Anti-cheat / RMT detection** on gold-flow and behavior.

## Zone/shard topology (from `../../docs/architecture/12-netcode-and-sharding.md`)
- World layers → server groups; each layer's space partitioned into zones (UE dedicated servers)
  with **seamless handoff** at boundaries and **channels** under load.
- Open-world fidelity is AOI-managed; heavy combat is instanced. Pick CAP tradeoffs per system:
  money strongly consistent, positions eventually consistent.

## Orchestration
- Dedicated servers containerized; a fleet manager (Agones / custom on K8s) scales zones + instances.
- A **connection/gateway** service authenticates and routes clients to the right server (backend).
- Backend is **language-agnostic** — the design in `../../docs/architecture/` doesn't require UE; keep
  it a separate track with its own team from day one.

## Do this early or pay later
1. Build the **dedicated-server target** in week one; never develop listen-server-only.
2. Stand up the **economy ledger** service before any trading feature.
3. Put **GAS on the server** from the first ability; retrofitting authority is a rewrite.
