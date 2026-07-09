// DAO'S FIELD — Cultivation System, public API.
// Engine-agnostic and pure: construct an engine from the parsed /data JSON, then create
// and cultivate characters. Used by the browser prototypes and mirrored by the UE5 GAS
// implementation (docs/engine/03-systems-to-engine-mapping.md).

import { makeRng } from "./rng.js";
import { buildRuleset } from "./ruleset.js";
import { drawHeavenlyCards, isValidDraw } from "./cards.js";
import { computeAura, effectiveSpeed, effectiveComprehension, tribulationBonus } from "./aura.js";
import { deriveStats } from "./stats.js";
import {
  createCultivator,
  cultivate,
  cultivationRate,
  breakthroughChance,
  attemptBreakthrough,
} from "./cultivation.js";

/**
 * Build a cultivation engine from parsed /data JSON.
 * @param data - { elements, auras, realms, races, destiny, draw }
 */
export function createCultivationEngine(data) {
  const ruleset = buildRuleset(data);
  return {
    ruleset,
    // creation
    draw: (seed, opts) => drawHeavenlyCards(ruleset, makeRng(seed >>> 0), opts),
    computeAura: (elementCards) => computeAura(ruleset, elementCards),
    createCultivator: (opts) => createCultivator(ruleset, opts),
    // stats
    deriveStats: (c) => deriveStats(ruleset, c),
    // cultivation
    cultivationRate: (c) => cultivationRate(ruleset, c),
    cultivate: (c, effort) => cultivate(ruleset, c, effort),
    breakthroughChance: (c, opts) => breakthroughChance(ruleset, c, opts),
    attemptBreakthrough: (c, rng, opts) => attemptBreakthrough(ruleset, c, rng, opts),
    // pure helpers
    effectiveSpeed,
    effectiveComprehension,
    tribulationBonus,
    isValidDraw: (d) => isValidDraw(ruleset, d),
  };
}

export {
  makeRng,
  buildRuleset,
  drawHeavenlyCards,
  computeAura,
  deriveStats,
  createCultivator,
  cultivate,
  cultivationRate,
  breakthroughChance,
  attemptBreakthrough,
  effectiveSpeed,
  effectiveComprehension,
  tribulationBonus,
};
