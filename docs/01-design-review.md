# Design Review — Where This Design Breaks (and How to Save It)

> My job is not to agree with you. It is to make sure that in Year 3, when we have
> 2 million accounts and a live economy, these systems are still standing. Below are
> the ten issues most likely to kill the game, ranked by how expensive they are to
> fix *after* launch. Each has a verdict: **KEEP**, **CHANGE**, or **CUT**.

Legend: 🔴 ship-blocker · 🟠 serious · 🟡 watch

---

## 1. 🔴 Death → demotion is a griefing weapon and a new-player repellent — **CHANGE**

**The rule as written:** "After dying more than three times within a world, the player
is demoted to the previous world and returns to the highest cultivation stage available
there."

**Why it fails:**
- **It weaponizes PvP.** A strong player (or a coordinated group) can kill a target
  three times to *delete weeks of that player's progress* and eject them from the world.
  This is not a risk — it is a guaranteed emergent behavior. Any punishment this severe,
  triggered by a hostile third party, becomes the dominant grief strategy on day one.
- **It punishes the exact behavior you want to reward.** You want exploration. Exploration
  means walking into things above your level. Under this rule, curiosity costs you the
  world you live in.
- **It creates suicide/relog exploits.** Players will manufacture "deaths" to move down a
  world deliberately (farm lower-world resources, dodge a stronger enemy, reset an event).
- **Death counters are a synchronization nightmare** (see architecture doc): "3 deaths in
  a world" must be authoritative, resistant to disconnect-abuse, and consistent across shards.

**What to do instead — separate *death type* from *penalty*:**

| Death cause | Penalty |
|---|---|
| PvE (mob, environment) | Cultivation-progress loss within current realm (never a realm drop), item durability loss, temporary "wounded" debuff |
| Heavenly Tribulation failure | Large but *pre-warned, opt-in* stake — this is the intended high-risk moment |
| PvP (open-world, both flagged) | Attacker pays a karma/notoriety cost; victim loses far less; bounty system funds counterplay |
| PvP (in a declared war/territory objective) | Full stakes, but *scoped to that ruleset*, consensual by faction membership |

Demotion, if it exists at all, should be a **rare, telegraphed, consensual-context**
mechanic (e.g., a hardcore "Tribulation Realm" opt-in), never the default open-world rule.
The "returns to highest stage available there" mechanic in particular should be **CUT** —
it's a save-scumming and grief vector with no upside that a simple progress-loss can't
deliver more safely.

---

## 2. 🔴 "Permanent cards, no reroll" + White-Aura-gets-everything = P2W and an RMT account market — **CHANGE**

You state monetization must "never become pay-to-win" and you must "never sell permanent
Aura upgrades." I believe your intent. **The card system violates it anyway**, indirectly:

- Aura is rolled at character creation from duplicate element cards, is **permanent**, and
  White Aura grants *faster cultivation, better Dao comprehension, better crafting, better
  tribulation success, higher ceiling, faster mastery.* Every one of those is **power over
  time**. "Not stronger *today*" is not "not P2W" — in an MMO, a permanent compounding
  growth-rate multiplier **is** the most valuable power in the game.
- Because it's permanent and RNG, and better rolls are strictly better, you have created the
  ideal conditions for a **grey-market account economy**: players buy pre-rolled White-Aura
  accounts. You will be selling permanent Aura upgrades — you just won't be the one getting
  paid. This is the single most predictable RMT outcome of the design.
- It also creates a **reroll-account churn** problem: a bad roll at minute 5 means the
  optimal play is to delete and re-draw, so your funnel bleeds before the tutorial ends.

**The uncomfortable math you must resolve:** you claim "a Red Aura player can still become
one of the strongest." For that to be *true* and not just marketing, the aura multiplier
must **converge** — it can front-load a genius's growth, but a diligent Red player must be
able to close the gap through effort/knowledge/consumables. If White is a flat permanent
+X% forever, it does **not** converge and your claim is false. Pick one:

- **(Recommended) Diminishing, catch-up-friendly aura.** Aura gives an early-game *velocity*
  bonus that tapers at higher realms, plus catch-up systems (rested growth, mentor bonuses,
  consumables that temporarily raise low-aura players) so the endgame ceiling is reachable by
  effort. Aura shapes *the shape of your journey*, not your final altitude.
- **Bounded, non-secret rolls.** Show players the odds; let the draw be *bounded* (guaranteed
  minimum quality floor) so no one is un-fun-to-play. Offer a *small number* of earned,
  in-game rerolls tied to hard PvE achievements (never purchasable) to defuse the account market.

Keep "no two journeys identical" — that's a great pillar. Get it from **element combination
and choices**, which are horizontal, not from **aura tier**, which is vertical and permanent.

---

## 3. 🟠 Heavenly Fire as a hard gate = a monopoly, an RMT chokepoint, and a brittle economy — **CHANGE**

"Without the correct Heavenly Fire, players cannot refine higher-tier pills or forge
higher-tier equipment" + "high-grade Heavenly Fires should be among the rarest treasures."

Combine "hard gate" with "extremely rare" and you get an **economic single point of failure**:
whoever controls the handful of high-grade fires controls *all* top-tier crafting on the
server. That cartel will (a) price-gouge, (b) become the RMT target, and (c) if a few of them
quit, top-tier crafting **stops server-wide**.

**Fixes:**
- **Fires are a *multiplier/enabler*, not a binary key.** A missing top fire should mean lower
  success rate / higher material cost / longer time — a *tax*, not a *wall*. Substitute paths
  (formation-assisted refinement, group co-forging, consumable "false flames") keep the market
  competitive.
- **Make fires a *service*, not just an *asset*.** A fire-holder can rent access (escrowed,
  time-boxed) rather than hoard — this turns a monopoly asset into a liquidity-providing
  profession and spreads supply.
- **Fires should be losable/consumable at the margin** (fuel upkeep, containment failures on
  botched high-tier refines) so supply isn't strictly increasing forever.

---

## 4. 🟠 Ascending worlds fragment your population and make new players spawn in a graveyard — **CHANGE the topology, keep the fantasy**

Human World I → … → IX → Spirit → Immortal → Divine → Origin is a fantastic *narrative*
spine. As a **server topology** it's dangerous: if each world is a separate gated zone/shard,
your player base spreads across 12+ layers. The consequences:

- **Lower worlds depopulate over time** — so the *new-player* worlds (I–III), the ones that
  must feel alive to convert players, become the emptiest.
- **Endgame density collapses** — the social/economic engine of an MMO needs crowding; thin
  populations kill auctions, sects, and world bosses.

**Fixes:**
- Treat worlds as **progression layers, not isolated servers.** Use a megaserver + dynamic
  channel/AOI model *within* each layer, and design explicit **downward pull**: mentorship
  rewards, sect duties, resource nodes that only lower worlds produce, tribulation ingredients
  gathered "below." High players should have *reasons* to be in low worlds, keeping them alive.
- **Instrument population per layer as a first-class metric** and be willing to *merge layers*
  the way live MMOs merge servers. Design the merge tooling before you need it.

---

## 5. 🟠 "Non-combat professions are just as valuable" is a promise every MMO makes and almost none keeps — **make it mechanical, not aspirational**

Saying it doesn't make it so. It's true only if the *combat* loop is forced to route through
the *crafting* loop. Enforcement mechanisms:

- **Consumable power.** Pills are consumed; the best gear degrades/breaks; tribulation demands
  crafted goods. Combat players are *permanent customers*, not one-time buyers.
- **Non-trivial crafting.** If crafting is "click and wait," it has no skill ceiling and its
  economic value collapses to the material cost. Crafting needs its own skill expression
  (formation layouts, fire control minigame depth, recipe discovery) so a *master* alchemist's
  output is meaningfully better and commands a premium.
- **Bind rules that protect labor.** If everything is freely tradeable and infinitely
  stockpilable, crafters get undercut to the floor. Use consumption + soulbound-on-use +
  quality tiers to keep demand alive.

---

## 6. 🟠 Dynamic NPC recruitment + reputation = a large sim cost and a Sybil/exploit surface — **make reputation an event-sourced ledger, not a poll**

"Sports teams competing for talent" is a great *feel*. Naively implemented it's a scaling and
integrity problem:

- **Don't poll.** NPC sects must not scan all players continuously. Reputation changes should
  emit **events** ("First White-Rank Pill refined") to an append-only ledger; recruitment
  logic *reacts* to events. This is O(events), not O(players).
- **Sybil resistance.** "First to X" and fame metrics are farmable via alt accounts and
  self-dealing (buy your own pills to inflate a merchant rep, feed kills to a main). Reputation
  gains from player-to-player transactions must be **diminishing per counterpart** and weighted
  by counterpart independence. Every "First/Best/Richest" title is a race — races invite
  collusion and exploits; audit each one before it ships.
- **Reputation must decay or be defendable.** A static "Best Healer" title granted once and
  held forever ossifies the social world and demotivates newcomers.

---

## 7. 🟠 "Seamless open world for millions" is the hardest netcode problem in the genre — be honest about it now — **scope it**

There is no single shard that holds millions in one seamless space with real-time cultivation
combat. Pretending otherwise leads to a Year-2 rewrite. Commit early to:

- **Interest management / AOI:** a client only receives entities within its area of interest;
  server spatial-partitions the world (grids/cells) with seamless hand-off between cells and
  servers.
- **Instanced heavy combat.** Secret realms, raids, sect wars, domain battles run in
  **instances** with hard participant caps — that's where you can afford tick-accurate
  simulation. The open world uses lower-fidelity, higher-capacity sync.
- **Pick your CAP tradeoffs deliberately** per system: the economy/ledger must be strongly
  consistent (money can't be duplicated); position/aura visuals can be eventually consistent.

Detail in `architecture/12-netcode-and-sharding.md`. The point here: **do not** promise
"one seamless world for everyone at once." Promise a world that *feels* seamless via AOI +
channels + instances.

---

## 8. 🟡 "Temporary Element Resonance Cards" in the cash shop contradict your own anti-P2W rule — **CUT or neuter**

You list "Temporary Element Resonance Cards" and "convenience features" as monetization. A
temporary card that boosts cultivation/element performance is **temporary power for money** —
the definition of the P2W you swore off. Rested-XP-style *convenience* (bank access, extra
loadout slots, cosmetic transmog, faster travel *to places you've already unlocked*) is fine.
Anything that touches the cultivation/crafting/combat *rate or outcome* is not. Draw the line
in policy now, because every quarter someone will propose crossing it for revenue.

---

## 9. 🟡 A player-driven economy inflates without deliberate sinks — **design faucets and sinks as one system**

Infinite mob drops + infinite crafting = infinite supply = inflation, then a mudflation
spiral. You must design **sinks** with the same care as content:

- **Sinks:** durability repair, pill consumption, tribulation material costs, teleport/travel
  fees, auction listing + sale tax (also funds sects/territory), soulbinding fees, formation
  upkeep, spirit-vein rent.
- **Faucet governors:** node respawn caps, per-account gather throttles, diminishing returns on
  farmed content, boss lockouts.
- **A currency the game removes as fast as it grants** is the goal; instrument the money supply
  as a live dashboard from day one.

---

## 10. 🟡 Permanence everywhere is brittle at 10–15 year scale — **build reroll/respec/migration escape hatches into the data model now**

"Permanent and cannot be rerolled" appears for cards, aura, race. Over 10–15 years you *will*
need to: rebalance an element, retire a broken constitution, compensate for a bug that ruined
rolls, or offer a legendary in-game reroll quest. If permanence is hardcoded, every one of
those becomes an emergency migration. Instead: keep permanence a **game rule enforced in a
data-driven policy layer**, not a database constraint. The schema should always be *able* to
express a reroll/respec/migration even if the ruleset forbids it today. (This is why the
`data/` configs are versioned and why identity is stored as *events applied to a character*,
not as immutable columns — see `architecture/11-data-model.md`.)

---

## Summary scorecard

| # | Issue | Verdict | Cost if ignored |
|---|---|---|---|
| 1 | Death→demotion griefing | **CHANGE** (cut the world-drop default) | Churn + grief meta, hard to patch live |
| 2 | Permanent RNG aura = P2W/RMT | **CHANGE** (converging aura + bounded rolls) | RMT market, funnel bleed |
| 3 | Heavenly Fire hard gate | **CHANGE** (tax not wall + rental) | Crafting monopoly, brittle economy |
| 4 | Ascending-world fragmentation | **CHANGE topology** | Dead new-player worlds |
| 5 | "Professions equally valuable" | **Enforce mechanically** | Crafting economy collapses |
| 6 | Recruitment/reputation exploits | **Event-source + Sybil-guard** | Sim cost + gamed leaderboards |
| 7 | "Seamless millions" netcode | **Scope honestly** | Year-2 rewrite |
| 8 | Resonance cards in shop | **CUT/neuter** | Reputation as fair game gone |
| 9 | Economy inflation | **Sinks = content** | Mudflation |
| 10 | Hardcoded permanence | **Data-driven policy layer** | Emergency migrations |

Everything else in the brief I'm broadly bullish on — the identity-through-combination pillar,
profession-driven economy, and the world/lore ambition are strong. The fixes above are what
let those good ideas survive contact with two million real, adversarial players.
