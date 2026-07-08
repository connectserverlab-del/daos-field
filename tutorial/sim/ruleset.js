// Adapts the raw /data JSON into a normalized, ready-to-use ruleset. Pure: give it
// the parsed JSON objects, get back indexed structures. No I/O here (so it runs in
// the browser or in the engine's data layer just as well as in Node).

/**
 * @param {object} data - { elements, auras, realms, races, destiny, draw } (parsed /data JSON)
 * @returns normalized ruleset
 */
export function buildRuleset(data) {
  const { elements, auras, realms, races, destiny, draw } = data;

  // Elements drawable at the mortal start, with a base weight by rarity.
  const drawableElements = elements.elements
    .filter((e) => draw.drawableRarities.includes(e.rarity))
    .map((e) => ({ ...e, baseWeight: draw.rarityWeights[e.rarity] ?? 0 }))
    .filter((e) => e.baseWeight > 0);
  const elementById = Object.fromEntries(elements.elements.map((e) => [e.id, e]));

  // Aura tiers indexed by id + the duplicate-count → tier map.
  const auraTierById = Object.fromEntries(auras.tiers.map((t) => [t.id, t]));
  const auraFromDuplicates = auras.auraFromDuplicates; // { "2":"red", ... "9":"white" }
  const auraCountRange = Object.keys(auraFromDuplicates)
    .map(Number)
    .sort((a, b) => a - b);
  const auraFloor = auraCountRange[0]; // 2
  const auraCap = auraCountRange[auraCountRange.length - 1]; // 9

  // Realms in advancement order.
  const realmList = [...realms.realms].sort((a, b) => a.order - b.order);

  // Races indexed.
  const raceById = Object.fromEntries(races.races.map((r) => [r.id, r]));

  // Destiny aspects + grades.
  const destinyAspects = destiny.aspects;
  const destinyGrades = destiny.grades;
  const destinyFloorGrade = destiny.floorGrade ?? 1;

  return {
    raw: data,
    draw,
    drawableElements,
    elementById,
    auraTierById,
    auraFromDuplicates,
    auraFloor,
    auraCap,
    realmList,
    raceById,
    destinyAspects,
    destinyGrades,
    destinyFloorGrade,
  };
}
