# System: Monetization (Fair-by-Design)

The rule is absolute: **never pay-to-win, and never "P2W we call convenience."** This doc draws
the line in policy *and* in a test that fails the build if we cross it. **Read design-review
issue #8 — the "Temporary Element Resonance Cards" idea violates the rule and is cut/neutered.**

## The bright line
A purchase is **allowed** only if it touches *neither* the **rate** nor the **outcome** nor the
**permanence** of cultivation, crafting, combat, or economy power. If it changes how fast you
grow, how well you craft/fight, or grants lasting power — it's P2W. No exceptions, no
"limited-time" loopholes.

| Allowed (cosmetic / genuine convenience) | Forbidden (rate / outcome / permanence) |
|---|---|
| Cosmetic outfits, weapon skins, mount appearances | Permanent Aura or Element upgrades |
| Housing/companion decorations | Permanent Element Cards / rerolls-for-cash |
| Transmog, dyes, emotes, titles-of-flair | Cultivation/crafting **speed** boosts |
| Extra bank/loadout/cosmetic slots | Combat power, better drops, success-rate boosts |
| Fast-travel to *already-unlocked* nodes | **"Temporary Element Resonance Cards"** — cut (issue #8) |
| Account services (name change, appearance) | Anything that gates or accelerates progression |

**"Temporary" is not a loophole.** Temporary cultivation/element power for money is temporary
P2W. If a Resonance-Card-style item ships at all, it must be *purely cosmetic resonance* (visual
element flair) with **zero** mechanical effect — otherwise it's cut.

## 2–9. Technical notes
- **Architecture/DB:** entitlements live on the account (`entitlements_json`) and are **cosmetic
  metadata only** — the identity/cultivation/economy services must have *no code path* where a
  shop entitlement mutates power state.
- **Security:** payment processing is out-of-band (PCI-compliant provider); the game grants
  cosmetic entitlements on verified receipt (idempotent, refund-aware).
- **Performance/sync:** cosmetics are visual state, eventually consistent, AOI-streamed like any
  appearance data.
- **Edge cases:** refunds/chargebacks revoke cosmetics cleanly; regional pricing; gifting abuse
  limits.
- **CI guardrail:** a test asserts **no shop SKU maps to an identity/cultivation/economy
  mutation.** This is how "fair monetization" stays true across 10–15 years of revenue pressure —
  it's enforced by the build, not by good intentions in a meeting.

## 10. Recommended implementation order
1. Cosmetic entitlement system (account-scoped, power-inert).
2. The **CI guardrail test** (before the first SKU exists).
3. Cosmetic content pipeline (skins, dyes, housing) — the actual revenue.
4. Account services (name/appearance changes).
5. Regional pricing / gifting with abuse limits.

## Why this is also good business
Fair monetization is the moat. The genre's audience is burned by P2W cultivation games; a
credibly fair one earns long-term whales who buy *cosmetics and identity expression* for years.
Selling power sells the game's future for one good quarter. We don't.
