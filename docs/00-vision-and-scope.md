# DAO'S FIELD — Vision, Pillars & Scope

An open-world cultivation MMORPG (Xianxia / Xuanhuan) where every player begins mortal and
may ascend toward Immortal, Demon Lord, Divine Beast, Celestial, or God. Designed as a
*living universe* meant to grow for 10–15 years.

## The one-sentence pitch
Your identity is not a class you pick — it is the **combination** of what you are (Race),
what heaven gave you (Cards / Aura / Element), what you comprehend (Dao), what you do
(Profession), where you belong (Sect), and what you choose. No two journeys are identical.

## Design pillars (in priority order)
1. **Horizontal identity, not vertical class.** Uniqueness comes from *combination*, which is
   cheap to expand and hard to power-creep, not from tier-of-luck.
2. **Long-term progression that respects effort.** Growth *rate* can vary; the *ceiling* must be
   reachable by diligence. (See design-review issue #2 — this is a promise we must keep in math.)
3. **A player-driven economy where non-combat is a career, not a chore.** Combat power routes
   through crafted goods; crafters are load-bearing.
4. **A reactive social world.** Reputation, recruitment, sects, and politics respond to what
   players actually do.
5. **Modular & data-driven.** New elements, realms, worlds, fires, professions, and events ship
   as *data*, not code rewrites.
6. **Fair monetization.** Cosmetic and genuine-convenience only. Never rate, never outcome,
   never permanence-for-cash.

## What we are explicitly NOT building (anti-goals)
- Not a class/spec treadmill with a gear-score leaderboard as the whole endgame.
- Not a gacha where a creation-time roll decides your account's worth.
- Not "one seamless shard for millions" (physically impossible; see netcode doc).
- Not pay-to-win, and not "pay-to-win but we call it convenience."

## Scope honesty (the risk posture)
This brief describes a 5+ year, large-studio undertaking. This repository does **not** pretend
to be that game. It is the **design bible + architecture reference + data-driven configuration
foundation** that keeps the eventual implementation coherent and expandable. Every system here
is documented against the ten technical dimensions (below) so that when engineering starts, the
hard questions are already answered on paper — where they're cheap to change.

## The ten technical dimensions (applied to every system doc)
1. Gameplay overview  2. System architecture  3. Database design  4. Networking
5. Multiplayer synchronization  6. Security  7. Performance  8. Edge cases
9. Future scalability  10. Recommended implementation order

## How to read this repo
- `01-design-review.md` — **read this first.** The critical review of the brief; what we're
  changing and why.
- `architecture/` — cross-cutting technical foundation (topology, data model, netcode).
- `systems/` — one doc per gameplay system, each covering the ten dimensions.
- `data/` — the data-driven configuration itself (elements, auras, realms, worlds, fires) with a
  JSON Schema. This is the *proof* that "add content without rewrites" is real, not a slogan.
- `roadmap.md` — recommended build order across all systems.
