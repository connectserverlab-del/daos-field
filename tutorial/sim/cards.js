// The Heavenly Card Draw: 15 cards — 9 Element Cards + 6 Destiny Cards.
// Bounded by construction: element cards come from a limited pool, so among 9 draws
// the dominant element's count sets the Aura tier (never below the floor). See aura.js.

import { clamp } from "./rng.js";

/**
 * Draw the 15 Heavenly Cards for a new cultivator.
 * @param ruleset - from buildRuleset()
 * @param rng - from makeRng(seed)
 * @param {object} opts - { race } (race can bias rare/epic element odds)
 * @returns { elementCards: string[9], destinyCards: {aspect,gradeId,g,mult,name}[6] }
 */
export function drawHeavenlyCards(ruleset, rng, opts = {}) {
  const race = opts.race && ruleset.raceById[opts.race];
  const rareBias = (race && race.rareElementBias) || 1;

  // 9 Element Cards — weighted by rarity, with optional racial rare-affinity bias.
  const weightFn = (e) =>
    e.rarity === "common" ? e.baseWeight : e.baseWeight * rareBias;
  const elementCards = [];
  for (let i = 0; i < ruleset.draw.elementCardCount; i++) {
    elementCards.push(rng.pick(ruleset.drawableElements, weightFn).id);
  }

  // 6 Destiny Cards — each aspect rolls a bounded grade.
  const floor = ruleset.destinyFloorGrade;
  const destinyCards = ruleset.destinyAspects.map((aspect) => {
    let grade = rng.pick(ruleset.destinyGrades, (g) => g.weight);
    if (grade.g < floor) grade = ruleset.destinyGrades.find((g) => g.g === floor) || grade;
    return {
      aspect: aspect.id,
      aspectName: aspect.name,
      gradeId: grade.id,
      name: grade.name,
      g: grade.g,
      mult: grade.mult,
    };
  });

  return { elementCards, destinyCards };
}

/** Guard used by tests/tools: a valid draw is exactly 9 element + 6 destiny. */
export function isValidDraw(ruleset, draw) {
  return (
    Array.isArray(draw.elementCards) &&
    draw.elementCards.length === ruleset.draw.elementCardCount &&
    Array.isArray(draw.destinyCards) &&
    draw.destinyCards.length === ruleset.draw.destinyCardCount
  );
}

export { clamp };
