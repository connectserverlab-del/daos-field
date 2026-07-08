// Character stat derivation. Stats come from the COMBINATION of realm (power budget),
// destiny grades, race, dominant element, and aura — never from a single roll. This is
// the "horizontal identity" pillar as numbers. In UE5 these become AttributeSet values
// (docs/engine/03 + 05); here they're a pure function for testing and the browser.

import { effectiveComprehension } from "./aura.js";

/** Map each destiny aspect id → its rolled grade multiplier. */
function destinyMults(destinyCards) {
  const m = {};
  for (const c of destinyCards) m[c.aspect] = c.mult;
  return m;
}

/** Race stat modifier lookup (missing key → 1.0). */
function rmod(race, key) {
  return (race && race.statMods && race.statMods[key]) || 1.0;
}

/**
 * Derive the character stat block.
 * @param cultivator - { race, elementCards, destinyCards, aura, realmIndex }
 */
export function deriveStats(ruleset, cultivator) {
  const race = ruleset.raceById[cultivator.race];
  const realm = ruleset.realmList[cultivator.realmIndex];
  const pb = realm.powerBudget; // relative combat scale, grows 1,3,9,27,...
  const d = destinyMults(cultivator.destinyCards);

  const physique = d.physique ?? 1;
  const root = d.spiritual_root ?? 1;
  const soul = d.soul ?? 1;
  const compG = d.comprehension ?? 1;
  const luckG = d.luck ?? 1;
  const destinyG = d.destiny ?? 1; // small global fortune

  const domEl = ruleset.elementById[cultivator.aura.dominantElement];
  const offense =
    domEl && domEl.category === "law" ? 1.25 : domEl && domEl.category === "offensive" ? 1.15 : 1.0;

  // Aura raises how well one comprehends the Dao (a growth/quality stat, not raw power).
  const effComp = effectiveComprehension(cultivator.aura.tier, realm.order);
  const globalFortune = 0.95 + 0.05 * destinyG;

  const round = (x) => Math.round(x);
  const stats = {
    vitality: round(100 * pb * physique * rmod(race, "vitality") * globalFortune),
    qi: round(80 * pb * root * Math.sqrt(soul) * rmod(race, "qi") * globalFortune),
    attack: round(30 * pb * physique * offense * rmod(race, "attack") * globalFortune),
    defense: round(24 * pb * physique * rmod(race, "defense") * globalFortune),
    spirit: round(18 * pb * soul * rmod(race, "spirit") * globalFortune),
    comprehension: round(10 * compG * effComp * rmod(race, "comprehension")),
    luck: round(8 * luckG * destinyG),
  };
  stats.powerRating = stats.vitality + stats.attack * 2 + stats.defense + stats.qi;
  return stats;
}
