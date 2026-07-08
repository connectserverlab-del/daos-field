# System: Professions & Player-Driven Economy

Combat is one path among many. Professions define how a player contributes; the economy must
*depend* on them. **Read design-review issues #5 (make non-combat mechanically valuable) and #9
(inflation/sinks).**

## 1. Gameplay overview
Professions: Fighter, Medic, Alchemist, Blacksmith/Artifact Smith, Farmer, Builder, Formation
Master, Merchant, Scholar, Explorer, Ordinary Human, … Each has a **mastery tree + endgame
progression**. Non-combat professions are load-bearing because **combat power routes through
crafted, consumable goods** (pills consumed, best gear degrades, tribulation needs supplies).

## Making non-combat valuable (mechanical enforcement — issue #5)
- **Consumption:** pills/talismans are used up; top gear degrades or breaks → crafters have
  *repeat* customers, not one-time buyers.
- **Skill ceiling:** crafting/gathering/formations have depth so a *master's* output is
  meaningfully better and premium-priced.
- **Bind & quality rules:** soulbound-on-use + quality tiers protect crafter labor from being
  undercut to raw-material cost.
- **Interlock:** combat unlocks recipes/materials; crafting powers combat — neither self-sufficient.

## Economy: faucets & sinks as one system (issue #9)
- **Faucets (money/goods in):** mob drops, gathering, quest rewards, boss loot — all governed by
  respawn caps, per-account throttles, diminishing returns, lockouts.
- **Sinks (money/goods out):** durability repair, pill consumption, tribulation costs,
  teleport/travel fees, **auction listing + sale tax** (also funds sects/territory), soulbinding
  fees, formation upkeep, spirit-vein rent, fire fuel.
- **Goal:** remove currency about as fast as it's granted; the money supply is a live dashboard
  from day one.

## 2. System architecture
- **Economy service** = the authoritative **ledger** (append-only, idempotent) + **market**
  (listings, auctions, trades) + tax/fee engine.
- **Crafting/gathering services** produce goods; **contract system** lets players post
  crafting/gathering orders (a profession jobs board).
- Profession definitions, mastery trees, recipes, drop/gather tables, tax rates = **data**.

## 3. Database design
- Money as a **ledger** (`ledger_entry`, balance = SUM(delta), idempotency-keyed) — never a
  mutable balance column (dupe-proof).
- `market_listing`, `market_trade` with taxes; `profession_contract` for orders.
- `character_profession` mastery. All *rates/tables* in config.

## 4. Networking
Market/economy are request/response over domain services (globally reachable, not tied to your
world cell). Heavy read path → cached market snapshots; writes are transactional.

## 5. Multiplayer synchronization
- Trades are two-party transactional (both-consent, atomic, idempotent; disconnect-safe — no
  half-trades, no dupes).
- Cross-shard trades use a saga through the strongly-consistent economy service.
- Auction state is eventually-consistent for browsing, strongly-consistent at bid/buy commit.

## 6. Security
- **The economy is the #1 exploit target.** Every mutation is a transactional, idempotent event.
- **RMT/gold-flow analysis** on the ledger; **Sybil/collusion detection** (self-dealing to farm
  reputation or launder gold — ties to issue #6).
- Market manipulation guards (wash-trading detection, listing/fee friction, price sanity).
- No client-side price/quantity trust; server validates every trade.

## 7. Performance
- Market read-heavy → cache-aside + snapshots; writes batched where safe.
- Ledger append is cheap; balance reads use maintained projections.
- Contract matching is event-driven, not polled.

## 8. Edge cases
- Disconnect mid-trade/auction → atomic rollback or resumption; never a dupe or a lost item.
- Seller deletes/character-bans with active listings → escrow return flow.
- Tax/fee edge rounding → defined, tested, non-exploitable.
- Deflation risk (over-tuned sinks) is as real as inflation — monitor both directions.

## 9. Future scalability
- New professions, mastery nodes, recipes, contract types, currencies, and regional markets are
  **data + new domain handlers**, not rewrites.
- Regional/cross-region markets reconcile asynchronously while keeping intra-region money strong.

## 10. Recommended implementation order
1. Ledger + basic currency (dupe-proof foundation — everything economic depends on it).
2. Inventory + bind/quality rules.
3. Market/auction with taxes (first real sink).
4. Profession mastery + at least one full non-combat loop (e.g., Alchemist) proving issue #5.
5. Contracts/jobs board.
6. Economy telemetry (money supply, gold-flow, RMT/Sybil detection) — **before** open trading at
   scale.
