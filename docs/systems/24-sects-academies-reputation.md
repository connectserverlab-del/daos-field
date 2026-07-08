# System: Academies, Sects, Reputation & Dynamic Recruitment

The social/political engine. Academies onboard; Sects are the major player/NPC organizations;
Reputation makes the world react; Recruitment makes talent feel courted. **Read design-review
issue #6 — reputation and recruitment are event-sourced and Sybil-guarded here.**

## 1. Gameplay overview
- **Academies** are neutral starting orgs: learn cultivation/professions/combat, discover
  talents, build early reputation, graduate.
- **Sects** have elders, libraries, territory, spirit veins, rankings, secret techniques,
  economy, politics, recruitment; some specialize (combat, medicine, alchemy, forging, beast
  taming, formations, trade, healing).
- **Reputation** is earned via accomplishments (first white-rank pill, strongest sword cultivator,
  richest merchant, fire discoverer, technique creator…). NPCs/sects/players react dynamically.
- **Recruitment** feels like sports teams competing for elite talent — NPC academies, NPC sects,
  and player sects court standouts.

## 2. System architecture (the key correctness call — issue #6)
- **Reputation is an append-only event ledger**, not a polled scan. Actions emit reputation
  events; a **projection** computes scores/titles. Cost is O(events), not O(players).
- **Recruitment AI reacts to reputation events** (event-driven), evaluating candidates when their
  standing crosses thresholds — it never continuously scans the whole population.
- Reputation dimensions, decay rates, title thresholds, recruitment rules = **data**.

## 3. Database design
- `reputation_event` (append-only, with counterpart + Sybil weighting inputs) →
  `reputation_projection` (scores, titles, decay-adjusted).
- `sect`, `sect_member` (ranks, contribution points), sect treasury (ledger), territory, spirit
  veins. `academy` records for enrollment/graduation.
- Recruitment offers as records with expiry/negotiation state.

## 4. Networking
Social/political systems live in domain services, globally reachable regardless of world cell.
Request/response + notifications (recruitment offers, rank changes) pushed to clients.

## 5. Multiplayer synchronization
- Sect membership, ranks, and territory control are authoritative shared state (strongly
  consistent on change, cached for reads).
- Reputation/titles are eventually-consistent public profile data.
- **Territory/sect wars** run as instances (see combat doc) with authoritative outcomes that emit
  events back to the sect/reputation systems.

## 6. Security (Sybil resistance is the whole ballgame — issue #6)
- **"First/Best/Richest" titles are races → invite collusion.** Audit each: reputation from
  player-to-player transactions has **diminishing returns per counterpart** and is weighted by
  counterpart independence (shared IP/device/funding clusters count for less).
- **Anti-self-dealing:** feeding kills to a main, buying your own pills to inflate merchant rep,
  alt-account recruitment laundering — all detected via the same clustering used for RMT.
- **Reputation decays / is defendable** so titles don't ossify and lock out newcomers.
- Sect treasury/territory changes are transactional and permission-checked (no elder-impersonation
  or unauthorized treasury drains).

## 7. Performance
- Event-sourced + projected reputation scales with *activity*, not headcount.
- Recruitment evaluation is threshold-triggered, batched, and rate-limited.
- Leaderboards are cached projections.

## 8. Edge cases
- Player quits mid-recruitment / sect disbands with members → clean membership + offer teardown.
- Contested "first to X" ties → authoritative event ordering decides; audited.
- Title-holder inactive → decay/challenge mechanics reassign fairly.
- Sect-leader account banned → succession rules.

## 9. Future scalability
- New reputation dimensions, titles, sect specializations, academy tracks, and recruitment
  behaviors are **data**. NPC recruitment "personalities" are config-driven.
- Player-created sects use the same schema as NPC sects — one system, not two.

## 10. Recommended implementation order
1. Reputation event ledger + projection (Sybil weighting from day one).
2. Academy onboarding + graduation.
3. Sect core (membership, ranks, treasury, library, territory data).
4. Event-driven recruitment (NPC + player sects) reacting to reputation.
5. Titles/decay + anti-collusion telemetry.
6. Sect politics/territory tie-in with combat (wars).
