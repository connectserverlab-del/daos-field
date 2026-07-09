// Cultivation experience + realm advancement. Progress accrues at an AURA-SCALED rate
// (aura sets speed, not the ceiling — design-review #2); each realm has sub-stage layers;
// advancing to the next realm may require a Heavenly Tribulation. No default realm/world
// drop on failure (design-review #1) — penalties stay within the current realm.

import { makeRng, clamp } from "./rng.js";
import { drawHeavenlyCards } from "./cards.js";
import { computeAura, effectiveSpeed, tribulationBonus } from "./aura.js";
import { deriveStats } from "./stats.js";

const BASE_RATE = 10; // cultivation progress per unit effort at aura×1, comprehension×1

/** Create a fresh cultivator: draw cards, compute aura, set to realm 0 / layer 1. */
export function createCultivator(ruleset, { race, seed }) {
  const rng = makeRng(seed >>> 0);
  const { elementCards, destinyCards } = drawHeavenlyCards(ruleset, rng, { race });
  const aura = computeAura(ruleset, elementCards);
  const c = {
    race,
    seed: seed >>> 0,
    elementCards,
    destinyCards,
    aura,
    realmIndex: 0,
    layer: 1,
    progress: 0,
    readyForBreakthrough: false,
    history: [],
  };
  c.stats = deriveStats(ruleset, c);
  return c;
}

function realmOf(ruleset, c) {
  return ruleset.realmList[c.realmIndex];
}
function progressPerLayer(realm) {
  return realm.baseProgressToAdvance / realm.subStages;
}

/**
 * Instantaneous cultivation rate (progress per unit effort) for a cultivator.
 * rate = BASE × auraSpeed(realm) × comprehension × spiritualRoot × raceSpeed.
 */
export function cultivationRate(ruleset, c) {
  const realm = realmOf(ruleset, c);
  const race = ruleset.raceById[c.race];
  const raceSpeed = (race && race.statMods && race.statMods.cultivationSpeed) || 1;
  const rootCard = c.destinyCards.find((d) => d.aspect === "spiritual_root");
  const root = rootCard ? rootCard.mult : 1;
  const compCard = c.destinyCards.find((d) => d.aspect === "comprehension");
  const comp = compCard ? compCard.mult : 1;
  return (
    BASE_RATE *
    effectiveSpeed(c.aura.tier, realm.order) *
    raceSpeed *
    root *
    comp
  );
}

/**
 * Cultivate for `effort` units. Returns the events that occurred.
 * effort = "time × focus" — the player's diligence. This is where a Red-aura cultivator
 * closes the gap by putting in more.
 */
export function cultivate(ruleset, c, effort) {
  const realm = realmOf(ruleset, c);
  const perLayer = progressPerLayer(realm);
  const events = [];
  if (c.readyForBreakthrough) return events; // must breakthrough before more progress

  let gained = cultivationRate(ruleset, c) * effort;
  c.progress += gained;

  while (c.progress >= perLayer && c.layer < realm.subStages) {
    c.progress -= perLayer;
    c.layer += 1;
    events.push({ type: "layer", realm: realm.id, layer: c.layer });
  }
  if (c.layer >= realm.subStages && c.progress >= perLayer) {
    c.progress = perLayer; // cap; awaiting breakthrough
    c.readyForBreakthrough = true;
    events.push({ type: "ready", realm: realm.id, nextIndex: c.realmIndex + 1 });
  }
  return events;
}

/** Tribulation success chance for advancing to the next realm. */
export function breakthroughChance(ruleset, c, opts = {}) {
  const next = ruleset.realmList[c.realmIndex + 1];
  if (!next) return { chance: 0, needsTribulation: false, next: null };
  if (!next.requiresTribulation) return { chance: 1, needsTribulation: false, next };

  const t = next.tribulation || {};
  const race = ruleset.raceById[c.race];
  const raceTrib = (race && race.tribulation) || 1;
  const luckCard = c.destinyCards.find((d) => d.aspect === "luck");
  const fateCard = c.destinyCards.find((d) => d.aspect === "destiny");
  const luckBonus = ((luckCard ? luckCard.mult : 1) - 1) * 0.15 + ((fateCard ? fateCard.mult : 1) - 1) * 0.1;

  let chance = (t.baseSuccess ?? 0.5) + tribulationBonus(c.aura.tier) + luckBonus + (opts.pillBonus || 0);
  chance *= raceTrib;
  chance = clamp(chance, 0.02, 0.98);
  return { chance, needsTribulation: true, next };
}

/**
 * Attempt to advance to the next realm. Requires readyForBreakthrough. Uses `rng`.
 * On success → next realm, layer 1. On failure → in-realm penalty (never a realm drop).
 */
export function attemptBreakthrough(ruleset, c, rng, opts = {}) {
  if (!c.readyForBreakthrough) return { ok: false, reason: "not_ready" };
  const { chance, needsTribulation, next } = breakthroughChance(ruleset, c, opts);
  if (!next) return { ok: false, reason: "max_realm" };

  const startRealmIndex = c.realmIndex;
  if (!needsTribulation) {
    advance(c);
    c.stats = deriveStats(ruleset, c);
    return { ok: true, success: true, chance, needsTribulation: false, newRealm: ruleset.realmList[c.realmIndex].id };
  }

  const roll = rng.next();
  const success = roll < chance;
  if (success) {
    advance(c);
    c.stats = deriveStats(ruleset, c);
    c.history.push({ type: "breakthrough", from: startRealmIndex, chance, roll });
    return { ok: true, success: true, chance, roll, needsTribulation: true, newRealm: ruleset.realmList[c.realmIndex].id };
  }

  // Failure penalty — stays in the current realm (design-review #1: no realm drop).
  const penalty = (next.tribulation && next.tribulation.failurePenalty) || "in_realm_progress_loss";
  const dropLayers = penalty === "opt_in_high_stake" ? 4 : 2;
  c.layer = Math.max(1, c.layer - dropLayers);
  c.progress = 0;
  c.readyForBreakthrough = false;
  c.history.push({ type: "tribulation_failed", realmIndex: startRealmIndex, chance, roll, penalty });
  return { ok: true, success: false, chance, roll, needsTribulation: true, penalty, realmUnchanged: c.realmIndex === startRealmIndex };
}

function advance(c) {
  c.realmIndex += 1;
  c.layer = 1;
  c.progress = 0;
  c.readyForBreakthrough = false;
}
