# System: Identity — Race, Heavenly Cards, Aura, Elements

Covers the three permanent creation choices (Race, Card Draw) and the derived Aura/Element
identity. **Read design-review issues #2 and #10 first — this system carries the biggest
long-term risk in the whole game.**

## 1. Gameplay overview
At creation a player picks a **Race** and draws **15 Heavenly Cards** (9 Element + 6 Destiny).
From the element cards, **duplicates determine Aura tier** (Red→…→White). Aura is *potential*
(growth rate, comprehension, crafting ceiling, tribulation odds), **not** raw combat power.
Element mix + destiny cards + choices produce a unique build.

**Our binding design constraints (from the review):**
- Aura's advantage **converges** — it front-loads a genius's velocity but tapers at high realms,
  and low-aura players have catch-up systems. A Red player can reach the ceiling through effort.
- Rolls are **bounded** (a quality floor; no un-fun characters) with **published odds**.
- A *small number* of **earned, non-purchasable** rerolls exist (hard achievements) to defuse the
  grey-market-account problem. Nothing about identity is ever for sale.

## 2. System architecture
- **Identity service** owns creation, card draw (server-side RNG with audited seed), aura
  derivation, and the identity **event stream** (`CardsDrawn`, `AuraDerived`, `RerollGranted`,
  `RerollApplied`). Character identity state is a *projection* of these events.
- Elements, aura tiers, constitutions, spiritual roots, and their effects are **data**
  (`data/elements.json`, `data/auras.json`) — never hardcoded. Adding a new element or tuning
  aura curves is a config PR.

## 3. Database design
See `architecture/11-data-model.md`: `character_card`, `character_aura`, `character_dao`, and the
append-only identity events. RNG draws store the seed + odds table version for auditability and
dispute resolution.

## 4. Networking
Creation is a request/response flow (not latency-sensitive). The draw resolves **server-side** —
the client never rolls. Result is streamed back with an animation the client merely *plays*.

## 5. Multiplayer synchronization
Identity is mostly static post-creation. Other players see a *derived public profile* (race,
visible aura effects, titles) via the profile projection — eventually consistent, cached.

## 6. Security
- **Server-authoritative RNG.** Client cannot influence, retry, or observe-then-abort a draw.
- **Audited seeds + versioned odds** → provable fairness, dispute handling, and detection of any
  tampering.
- **Anti-reroll-abuse:** creation draws are rate-limited per account/device to blunt
  delete-and-redraw churn; earned rerolls are gated behind non-trivial achievements.
- Aura/cards are **never** a purchasable entitlement — enforced in policy and validated in CI
  (a test that fails if any shop SKU maps to an identity mutation).

## 7. Performance
Trivial runtime cost — creation is a one-time event. The only scale concern is a launch-day
thundering herd of new characters; the identity service is stateless behind the draw RNG and
scales horizontally.

## 8. Edge cases
- Disconnect mid-draw → draw is atomic; either fully committed (event appended) or not.
- Name collision / reserved names → validated at creation.
- Element odds changed later → old characters keep their audited draw; new odds apply going
  forward (versioned).
- A future balance patch nerfs an element → because effects are data + event-sourced identity,
  we adjust the *element's data*, not every character row.

## 9. Future scalability
- New races, elements (Wind, Storm, Light, Dark, Spirit, Time, Space, Life, Fate, Death, Rule…),
  constitutions, and destiny outcomes are **added as data**. The schema reserves rarity tiers and
  an open element registry so "add elements without a rewrite" is literally true.
- Dual/triple/domain techniques are expressed as **element-combination recipes** in data, so new
  combinations don't require engine changes.

## 10. Recommended implementation order
1. Data schema for elements + auras (`data/schema`, `data/elements.json`, `data/auras.json`).
2. Server-side audited card draw + aura derivation (event-sourced).
3. Character creation flow + profile projection.
4. Earned-reroll achievement hook (defuses account market) — *before* any large marketing push.
5. Aura-convergence tuning pass with telemetry (validate "Red can reach the ceiling").

## The aura-convergence contract (the number that keeps the game fair)
Aura must satisfy: *for two players of equal playtime and skill, the growth-gap from aura shrinks
as realm increases and is closable by effort/consumables.* We model aura as an early **velocity
multiplier with diminishing returns per realm**, plus catch-up faucets (rested growth, mentorship,
low-aura-only consumables). If live telemetry ever shows the gap *widening* with realm, aura is
mis-tuned and we correct the data — this is a monitored, non-negotiable invariant.
