// A readable demo of the cultivation system. Run: `node examples/demo.js [seed] [race]`
import { loadData } from "../data/loadData.node.js";
import { createCultivationEngine, makeRng } from "../src/index.js";

const seed = Number(process.argv[2] || 88);
const race = process.argv[3] || "human";
const engine = createCultivationEngine(loadData());
const { ruleset } = engine;

const c = engine.createCultivator({ race, seed });
const line = (s = "") => console.log(s);

line(`━━━ A new cultivator awakens (seed ${seed}) ━━━`);
line(`Race:            ${ruleset.raceById[race].name}  — ${ruleset.raceById[race].trait}`);
line(`Element cards:   ${c.elementCards.join(", ")}`);
line(`Aura:            ${c.aura.tier.id.toUpperCase()} (${c.aura.auraCount}× ${c.aura.dominantElement})  ` +
     `speed×${c.aura.tier.cultivationSpeedMult}, comprehension×${c.aura.tier.daoComprehensionMult}`);
line(`Affinities:      ${c.aura.affinities.map((a) => `${a.element}×${a.count}`).join("  ")}`);
line(`Destiny:         ${c.destinyCards.map((d) => `${d.aspectName}:${d.name}`).join("  ·  ")}`);
line(`Stats:           HP ${c.stats.vitality} · Qi ${c.stats.qi} · ATK ${c.stats.attack} · ` +
     `DEF ${c.stats.defense} · Spirit ${c.stats.spirit} · Comp ${c.stats.comprehension} · Luck ${c.stats.luck}`);
line();

line(`━━━ The road of cultivation ━━━`);
const rng = makeRng(seed ^ 0x9e37);
const last = ruleset.realmList.length - 1;
let attempts = 0;
line(`Start: ${ruleset.realmList[0].name}, Layer 1  (rate ${engine.cultivationRate(c).toFixed(1)}/effort)`);
let iter = 0;
while (c.realmIndex < last && iter++ < 4000) {
  if (c.readyForBreakthrough) {
    const bc = engine.breakthroughChance(c);
    const before = ruleset.realmList[c.realmIndex].name;
    const r = engine.attemptBreakthrough(c, rng);
    attempts++;
    if (r.success) {
      line(`  ⚡ Tribulation (${(bc.chance * 100).toFixed(0)}% chance) — ASCEND: ${before} → ` +
           `${ruleset.realmList[c.realmIndex].name}   [ATK ${c.stats.attack}, HP ${c.stats.vitality}]`);
    } else {
      line(`  ✗ Tribulation (${(bc.chance * 100).toFixed(0)}% chance) failed — stays in ${before} (Layer ${c.layer}). The Dao is patient.`);
    }
  } else {
    engine.cultivate(c, 5000); // a season of diligent practice
  }
}
line();
line(`Final realm:     ${ruleset.realmList[c.realmIndex].name}  after ${attempts} tribulation attempt(s)`);
line(`Final stats:     HP ${c.stats.vitality} · Qi ${c.stats.qi} · ATK ${c.stats.attack} · Power ${c.stats.powerRating}`);
