// Aura = POTENTIAL, not raw power. The tier is set by how many duplicates of the
// dominant element land among the 9 element cards, floored at a pair (Red). Aura
// multipliers CONVERGE at higher realms (the taper), so a diligent low-aura cultivator
// can still reach the ceiling — the invariant from docs/01-design-review.md #2.

import { clamp } from "./rng.js";

/**
 * Compute a character's Aura from its 9 element cards.
 * @returns { auraCount, tierId, tier, dominantElement, counts, affinities }
 */
export function computeAura(ruleset, elementCards) {
  const counts = {};
  for (const id of elementCards) counts[id] = (counts[id] || 0) + 1;

  let dominantElement = null;
  let maxCount = 0;
  for (const id of Object.keys(counts)) {
    if (counts[id] > maxCount) {
      maxCount = counts[id];
      dominantElement = id;
    }
  }

  // Bounded floor: even 9 distinct draws (maxCount 1) yield at least Red.
  const auraCount = clamp(maxCount, ruleset.auraFloor, ruleset.auraCap);
  const tierId = ruleset.auraFromDuplicates[String(auraCount)];
  const tier = ruleset.auraTierById[tierId];

  const affinities = Object.entries(counts)
    .map(([id, n]) => ({ element: id, count: n }))
    .sort((a, b) => b.count - a.count);

  return { auraCount, tierId, tier, dominantElement, counts, affinities };
}

/**
 * Effective cultivation-speed multiplier for a tier at a given realm order (1-based).
 * The tier's advantage tapers with realm: 1 + (mult-1) * taper^(order-1).
 * At realm 1 the full aura bonus applies; by the high realms it has largely converged.
 */
export function effectiveSpeed(tier, realmOrder) {
  return 1 + (tier.cultivationSpeedMult - 1) * Math.pow(tier.highRealmTaper, realmOrder - 1);
}

/** Effective Dao-comprehension multiplier for a tier at a given realm order. */
export function effectiveComprehension(tier, realmOrder) {
  return 1 + (tier.daoComprehensionMult - 1) * Math.pow(tier.highRealmTaper, realmOrder - 1);
}

/** Aura's flat tribulation-success bonus (small; does not taper). */
export function tribulationBonus(tier) {
  return tier.tribulationSuccessBonus || 0;
}
