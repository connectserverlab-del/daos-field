# Data Model & Storage

Principle: **truth is events; state is a projection.** For anything with integrity or audit
needs (identity, cultivation, economy, reputation) we store an append-only event stream and
derive current state from it. Hot read models are cached projections. This is what makes
"permanence" a *policy* we can revise, not a wall we've cemented into columns.

## Storage engines (by workload, not by brand)
- **OLTP (relational, e.g. Postgres):** accounts, characters, inventory, market listings, sect
  records, the money ledger. Strong consistency, transactions, foreign keys.
- **Cache (Redis):** sessions, AOI hints, hot profiles, market snapshots, leaderboards, rate
  limits, distributed locks.
- **Event log (Kafka/Redpanda):** the durable spine; every domain event.
- **Document/Wide-column (optional):** high-volume telemetry, chat history, combat logs.
- **OLAP/warehouse:** economy monitoring, balance analytics, anti-cheat/RMT detection.
- **Config store:** versioned `data/` content, served to game servers with hot-reload.

## Core relational sketch (illustrative, not final DDL)

```
account(account_id PK, email_hash, created_at, status, entitlements_json)
character(character_id PK, account_id FK, name, race_id, world_layer_id,
          cultivation_realm_id, created_at, last_seen, position_cell,
          state_version)                       -- projection of identity events
character_card(character_id FK, slot, card_type, element_id?, destiny_kind?, value_json)
                                               -- 15 cards: 9 element + 6 destiny
character_aura(character_id FK, element_id, aura_tier_id, derived_from_dupes)
character_dao(character_id FK, dao_id, comprehension_level)
character_profession(character_id FK, profession_id, mastery_level, mastery_xp)

inventory_item(item_id PK, character_id FK, item_def_id, qty, quality, durability,
               bind_state, instance_data_json)
item_def -> lives in data/ config, referenced by id (never duplicated in rows)

-- Economy: money is a ledger, never a mutable balance column
ledger_entry(entry_id PK, account_id, delta, currency, reason_code, ref_event_id,
             idempotency_key UNIQUE, created_at)
-- balance = SUM(delta); enforced append-only; dupes impossible via idempotency_key

market_listing(listing_id PK, seller_id, item_snapshot_json, price, qty, expires_at,
               status, listing_fee_paid)
market_trade(trade_id PK, listing_id, buyer_id, price, tax_paid, ref_event_id)

sect(sect_id PK, name, owner_type, territory_json, treasury_ledger, ...)
sect_member(sect_id, character_id, rank, joined_at, contribution_points)

reputation_event(event_id PK, character_id, kind, magnitude, counterpart_id?,
                 world_layer_id, created_at)   -- append-only; Sybil weight applied on projection
reputation_projection(character_id, dimension, score, titles_json, updated_at)

heavenly_fire(fire_id PK, fire_grade_id, holder_character_id?, holder_sect_id?,
              fuel_remaining, container_state)  -- fires are scarce, trackable, losable
```

## Why event-sourced identity
- **Auditable:** we can prove exactly how a character's aura/cards came to be (dispute & bug
  resolution, RMT investigation).
- **Migratable:** a future "legendary reroll" quest is just *new events appended*, not a
  destructive column rewrite. Permanence stays a rule enforced when *accepting* an event.
- **Replayable:** rebuild any projection after a balance change or bug fix.

## Sharding & locality
- Partition hot data by **character_id / account_id** so a player's writes stay on one shard.
- The **money ledger and market** need cross-player consistency — keep them in a strongly
  consistent store; scale by region + async settlement, not by relaxing consistency.
- Read models (profiles, leaderboards, market snapshots) are cache-first and may lag slightly.

## Consistency choices (deliberate per system)
| System | Consistency | Rationale |
|---|---|---|
| Money / market / trades | Strong, transactional | Never duplicate or lose currency |
| Cultivation progress | Strong on commit, cached reads | Progress is precious; reads can lag |
| Inventory (bind/trade) | Strong on transfer | Dupe prevention |
| Position / AOI visuals | Eventual | Bandwidth; slight lag is invisible |
| Reputation / leaderboards | Eventual (projected) | Fame need not be instant |

## Edge cases the model must handle
- Disconnect mid-trade / mid-craft / mid-tribulation → idempotent, resumable, or cleanly rolled
  back. Never a state that can be exploited by yanking the network cable.
- Two clients acting on one character (multi-boxing / session takeover) → single authoritative
  session per character, fenced by a session token + version.
- Cross-shard actions (trade between players on different shards) → saga/2-phase with
  compensation, funneled through the strongly-consistent economy service.
