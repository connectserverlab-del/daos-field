<!--
DAO'S FIELD — Pull Request Template
Fill in what applies; delete sections that don't. Keep it honest — an empty
"Risks" section reads as "I didn't look," not "there are none."
See docs/01-design-review.md for the design principles this template enforces.
-->

## Summary
<!-- What does this PR do, in 1–3 sentences? Lead with the player-facing or system outcome, not the file list. -->


## Type of change
<!-- Check all that apply. -->
- [ ] 🎮 Gameplay / design (new or changed system, mechanic, or content)
- [ ] 🏛️ Architecture (topology, data model, netcode, service boundaries)
- [ ] 🧩 Data-driven config (`data/**` — elements, auras, realms, worlds, fires, recipes…)
- [ ] ⚙️ Engine / server code
- [ ] 📖 Documentation / design bible
- [ ] 🧪 Tooling / CI / tests
- [ ] 🎨 Cosmetic / monetization asset (power-inert)

## Design intent
<!-- WHY this change. Which pillar does it serve (horizontal identity / effort-respecting
     progression / player-driven economy / reactive social world / modular data-driven /
     fair monetization)? Link the relevant docs/ or a design decision. -->


## The 10 technical dimensions
<!-- Required for any new/changed SYSTEM or ARCHITECTURE change. For small data/doc/
     cosmetic PRs, delete this block. Answer only the dimensions this PR actually touches;
     write "n/a — <reason>" for the rest rather than deleting a line. -->
1. **Gameplay overview** —
2. **System architecture** —
3. **Database design** —
4. **Networking** —
5. **Multiplayer synchronization** —
6. **Security** —
7. **Performance** —
8. **Edge cases** —
9. **Future scalability** —
10. **Implementation order / what's next** —

## Adversarial review — how would a player break this?
<!-- Mandatory thinking, not optional. "Never blindly agree" applies to our own PRs too. -->
- **Exploit / griefing surface:** <!-- Can a hostile third party weaponize this against another player? (See design-review issue #1.) -->
- **Sybil / alt-account abuse:** <!-- Farmable via alts, self-dealing, collusion? (issue #6) -->
- **Economy impact:** <!-- New faucet or sink? Inflation/deflation pressure? Dupe surface? (issue #9) -->
- **Balance / power creep:** <!-- Does this widen the aura/effort ceiling gap? (issue #2) -->
- **Monopoly / chokepoint:** <!-- Does it hand a scarce resource single-point control? (issue #3) -->

## Non-negotiable guardrails
<!-- Check the ones that apply; a violated guardrail blocks merge. -->
- [ ] **Server-authoritative** — no client trust for damage, position, cooldowns, resources, RNG, or death outcomes.
- [ ] **Dupe-proof** — economy/inventory mutations are transactional + idempotent; disconnect-safe.
- [ ] **Data-driven** — no `if (id === "fire")`-style hardcoding; behavior resolves from `data/` config.
- [ ] **Not pay-to-win** — this change does **not** sell/grant rate, outcome, or permanent power. (issue #8)
- [ ] **Permanence is policy, not concrete** — identity/progress stays event-sourced and migratable. (issue #10)
- [ ] **Fairness-before-system sequencing** — if this enables a system, its protecting mechanic already exists or ships here (ledger before economy, karma before open PvP, fire-rental before top-tier crafting, Sybil-guard before recruitment, P2W-guardrail before cash shop).

## Data-driven config changes
<!-- Only if this PR touches data/**. Delete otherwise. -->
- [ ] `version` bumped on every changed config file.
- [ ] Ids are **new + permanent** (no reuse/repurpose of an existing id).
- [ ] References use ids, not display names.
- [ ] `python3 scripts/validate_data.py` passes (schema + cross-file integrity).

## Telemetry & balance
<!-- You cannot balance what you don't measure. -->
- **Metrics this change should be watched by:** <!-- e.g. money-supply, aura-convergence gap, population-per-layer, fire-holder concentration, reputation Sybil clusters -->
- **What "healthy" looks like / kill-switch if it isn't:**

## Validation
<!-- How did you verify this actually works? Tests, manual repro, validator output, load test. -->
- [ ] Tests added/updated (or n/a — why:            )
- [ ] Verified end-to-end (describe how, or n/a — why:            )
- Evidence / output:

## Rollout & reversibility
- **Migration/backfill needed?** <!-- Because identity/economy are event-sourced, prefer append-over-mutate. -->
- **Feature-flagged / config-gated?**
- **Rollback plan:**

## Docs
- [ ] Design bible / system doc updated (or n/a).
- [ ] `docs/roadmap.md` updated if this changes build order.

## Related
<!-- Link design-review issues (#1–#10), other PRs, discussions. -->
Closes / relates to:
