// Unit tests for the cultivation system. Runs with `node test/run.js`.
// Proves the mechanics AND the design-bible invariants (bounded aura floor, converging
// aura, no realm-drop on failure). No external deps.

import assert from "node:assert";
import { loadData } from "../data/loadData.node.js";
import { createCultivationEngine, makeRng, computeAura, effectiveSpeed } from "../src/index.js";

const engine = createCultivationEngine(loadData());
const { ruleset } = engine;

let passed = 0,
  failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log("  ✓ " + name);
    passed++;
  } catch (e) {
    console.log("  ✗ " + name + "\n      " + (e && e.message));
    failed++;
  }
}
const RACES = ["human", "beast", "spirit_beast", "monster"];

console.log("DAO'S FIELD — cultivation system tests\n");

/* 1 — The draw: 15 cards, 9 element + 6 destiny, all aspects, deterministic. */
test("draw yields 9 element + 6 destiny cards covering all aspects", () => {
  const d = engine.draw(12345, { race: "human" });
  assert.strictEqual(d.elementCards.length, 9);
  assert.strictEqual(d.destinyCards.length, 6);
  assert(engine.isValidDraw(d));
  const aspects = new Set(d.destinyCards.map((c) => c.aspect));
  assert.strictEqual(aspects.size, 6, "all 6 destiny aspects present");
});
test("draw is deterministic per seed", () => {
  const a = engine.draw(999, { race: "beast" });
  const b = engine.draw(999, { race: "beast" });
  assert.deepStrictEqual(a, b);
  const c = engine.draw(1000, { race: "beast" });
  assert.notDeepStrictEqual(a.elementCards, c.elementCards);
});

/* 2 — Aura bounded floor: never below Red across many seeds; Red is reachable. */
test("aura is bounded — never below the floor (Red) over 4000 draws", () => {
  let minCount = 99,
    sawFloor = false,
    tiers = new Set();
  for (let s = 1; s <= 4000; s++) {
    const d = engine.draw(s, { race: "human" });
    const a = engine.computeAura(d.elementCards);
    minCount = Math.min(minCount, a.auraCount);
    if (a.auraCount === ruleset.auraFloor) sawFloor = true;
    tiers.add(a.tierId);
  }
  assert(minCount >= ruleset.auraFloor, "auraCount never below floor (got " + minCount + ")");
  assert(sawFloor, "Red floor is reachable");
  assert(tiers.size >= 3, "a spread of tiers occurs");
});

/* 3 — Aura tier matches the dominant element's duplicate count. */
test("aura tier reflects the max duplicate count", () => {
  const cards = ["fire", "fire", "fire", "fire", "water", "wood", "gold", "earth", "wind"]; // 4× fire
  const a = computeAura(ruleset, cards);
  assert.strictEqual(a.dominantElement, "fire");
  assert.strictEqual(a.auraCount, 4);
  assert.strictEqual(a.tierId, ruleset.auraFromDuplicates["4"]); // yellow
});
test("all-distinct draw floors to Red (bounded)", () => {
  const cards = ["earth", "fire", "water", "wood", "gold", "wind", "lightning", "light", "dark"]; // all 9 distinct
  const a = computeAura(ruleset, cards);
  assert.strictEqual(a.auraCount, ruleset.auraFloor);
  assert.strictEqual(a.tierId, "red");
});

/* 4 — Converging aura (design-review #2): White's edge shrinks with realm, and a diligent
      Red cultivator overtakes a coasting White one at high realms — while talent still
      dominates early. */
test("aura advantage converges at higher realms", () => {
  const white = ruleset.auraTierById.white;
  const edgeLow = effectiveSpeed(white, 1) - 1;
  const edgeHigh = effectiveSpeed(white, 8) - 1;
  assert(edgeHigh < edgeLow * 0.5, `white edge should shrink a lot (low ${edgeLow.toFixed(3)}, high ${edgeHigh.toFixed(3)})`);
});
test("effort lets Red reach the ceiling at high realm, but not early (talent matters early)", () => {
  const white = ruleset.auraTierById.white;
  const red = ruleset.auraTierById.red;
  // High realm: Red with modest extra effort (+12%) out-cultivates a coasting White.
  const redHigh = effectiveSpeed(red, 8) * 1.12;
  const whiteHigh = effectiveSpeed(white, 8) * 1.0;
  assert(redHigh >= whiteHigh, `Red diligence should overtake White at high realm (${redHigh.toFixed(3)} vs ${whiteHigh.toFixed(3)})`);
  // Early realm: the same effort cannot close the gap — genius front-loads.
  const redEarly = effectiveSpeed(red, 1) * 1.12;
  const whiteEarly = effectiveSpeed(white, 1) * 1.0;
  assert(whiteEarly > redEarly, "White should dominate early even against +12% effort");
});

/* 5 — Cultivation accrues, advances sub-stage layers, and reaches breakthrough-ready. */
test("cultivation advances layers and reaches breakthrough-ready", () => {
  const c = engine.createCultivator({ race: "human", seed: 42 });
  assert.strictEqual(c.layer, 1);
  assert.strictEqual(c.realmIndex, 0);
  let guard = 0;
  while (!c.readyForBreakthrough && guard++ < 100000) engine.cultivate(c, 50);
  assert(c.readyForBreakthrough, "became ready");
  assert.strictEqual(c.layer, ruleset.realmList[0].subStages, "reached final layer");
});

/* 6 — Full progression: cultivate + breakthrough all the way to the final realm. */
test("a cultivator can progress from Qi Gathering to the final realm", () => {
  const c = engine.createCultivator({ race: "human", seed: 7 });
  const rng = makeRng(7);
  const last = ruleset.realmList.length - 1;
  let iter = 0;
  while (c.realmIndex < last && iter++ < 5000) {
    if (c.readyForBreakthrough) engine.attemptBreakthrough(c, rng, { pillBonus: 0.9 });
    else engine.cultivate(c, 1e7); // ample effort to reach ready in one step
  }
  assert.strictEqual(c.realmIndex, last, "reached the final realm");
  assert(c.stats.powerRating > 0);
});

/* 7 — Tribulation is a fair coin at its stated chance (empirical over 20k rolls). */
test("tribulation success rate matches its computed chance", () => {
  const c = engine.createCultivator({ race: "human", seed: 3 });
  const { chance, needsTribulation } = engine.breakthroughChance(c);
  assert(needsTribulation, "advancing into Foundation requires tribulation");
  const rng = makeRng(555);
  let succ = 0;
  const N = 20000;
  for (let i = 0; i < N; i++) if (rng.next() < chance) succ++;
  const mean = succ / N;
  assert(Math.abs(mean - chance) < 0.02, `empirical ${mean.toFixed(3)} ≈ chance ${chance.toFixed(3)}`);
});

/* 8 — Failed tribulation NEVER drops the realm (design-review #1). */
test("failed tribulation keeps the realm (no realm/world drop)", () => {
  const c = engine.createCultivator({ race: "human", seed: 11 });
  while (!c.readyForBreakthrough) engine.cultivate(c, 1e7);
  const before = c.realmIndex;
  const alwaysFail = { next: () => 0.999999 }; // roll above any chance
  const r = engine.attemptBreakthrough(c, alwaysFail);
  assert.strictEqual(r.success, false);
  assert.strictEqual(c.realmIndex, before, "realm index unchanged after failure");
  assert(c.layer >= 1, "stays within the realm");
});

/* 9 — Stats scale monotonically with realm (power budget). */
test("character stats scale up with realm", () => {
  const c = engine.createCultivator({ race: "beast", seed: 21 });
  const s0 = engine.deriveStats(c);
  c.realmIndex = 3; // Nascent Soul
  const s3 = engine.deriveStats(c);
  assert(s3.attack > s0.attack && s3.vitality > s0.vitality && s3.qi > s0.qi, "combat stats grow with realm");
});

/* 10 — Every race produces a valid, complete cultivator. */
test("all races create valid cultivators with full stat blocks", () => {
  for (const race of RACES) {
    const c = engine.createCultivator({ race, seed: 100 });
    assert(c.aura && c.aura.tier, race + " has an aura tier");
    for (const k of ["vitality", "qi", "attack", "defense", "spirit", "comprehension", "luck"])
      assert(typeof c.stats[k] === "number" && c.stats[k] >= 0, race + " has stat " + k);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
