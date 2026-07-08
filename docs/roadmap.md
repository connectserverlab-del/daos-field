# Recommended Implementation Roadmap

Build order across systems. Sequenced so that (a) the dupe-proof/authoritative foundations exist
before anything economic or PvP, and (b) the redesigned safety mechanics (death model, fair-aura,
anti-monopoly, Sybil guards) ship *before* the systems they protect. Think in *slices that prove a
loop end-to-end*, not in fully-finished systems.

## Phase 0 — Foundations (no gameplay yet)
1. **Data-driven config pipeline**: JSON Schemas + validation in CI; config service with
   hot-reload. (`data/`)
2. **Event bus + event-sourcing scaffolding** (identity, economy, reputation streams).
3. **Gateway + auth + session** (server-authoritative, one session per character).
4. **Persistence baseline**: OLTP + cache + event log; the **money ledger** (dupe-proof) first.

## Phase 1 — A single player can exist and grow
5. Character creation: race + **audited server-side card draw** + aura derivation (issue #2 rules:
   bounded rolls, converging aura, no purchasable identity).
6. Passive, aura-scaled **cultivation** (server-authoritative).
7. World layer 1 (Human World I) with AOI world server + basic movement/gathering.

## Phase 2 — A living single-player-in-a-world loop
8. Core **combat** (server-authoritative, data-driven techniques + element matrix), PvE only.
9. First full **non-combat profession** loop (Alchemist) proving professions are load-bearing
   (issue #5) — needs crafting + **Heavenly Fire as tax-not-wall** (issue #3).
10. **Inventory + bind/quality rules**.

## Phase 3 — Multiplayer economy & society
11. **Market/auction with taxes** (first real sink) on the ledger; economy telemetry
    (money-supply dashboard, RMT/Sybil detection) — issue #9.
12. **Reputation event ledger + projection** with Sybil weighting (issue #6).
13. **Academy** onboarding → **Sect** core (membership, ranks, treasury, territory).
14. **Fire rental/escrow** (breaks monopoly before top-tier crafting — issue #3).

## Phase 4 — Competition & endgame scaffolding
15. **Redesigned death/penalty + flagged PvP + karma/bounty** (issue #1) — ships *before* open
    PvP is enabled.
16. **Instanced content**: secret realms / dungeons / raids (fidelity showcase).
17. **Event-driven recruitment** (NPC + player sects reacting to reputation) — issue #6.
18. **Heavenly Tribulation** as a disconnect-safe instanced event; realm advancement.

## Phase 5 — Scale, worlds, and the long tail
19. Additional **world layers** + **downward-pull** incentives + **layer-merge tooling** (issue #4).
20. **Sect/territory/domain wars** (instanced, authoritative) tied to sect + reputation systems.
21. **Cosmetic monetization** + the **CI P2W-guardrail test** (issue #8).
22. Content expansion cadence — new elements/realms/fires/professions **as data**, proving the
    10–15 year expandability thesis.

## Cross-cutting, every phase
- Anti-cheat + server-authoritative validation from day one (retrofitting is a rewrite).
- Telemetry first: economy money-supply, aura-convergence gap, population-per-layer,
  fire-holder concentration, reputation Sybil clusters. **You cannot balance what you don't
  measure.**
- Load-test the worst cases early: crowded hub, world-boss zerg, market thundering herd.

## Sequencing rule of thumb
Never ship a system before the mechanic that keeps it fair:
- economy ⟶ after the dupe-proof ledger + sinks + RMT detection
- open PvP ⟶ after the redesigned death model + karma
- top-tier crafting ⟶ after fire-rental (anti-monopoly)
- reputation/recruitment ⟶ after Sybil weighting
- any cash shop ⟶ after the P2W-guardrail CI test
