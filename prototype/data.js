// DAO'S FIELD — prototype game data (data-driven, mirrors /data config).
// Everything the ceremony reads lives here as data, not hardcoded logic.

export const RACES = [
  { id: "human",       name: "Human",       img: "./assets/race_human.png",
    blurb: "Balanced potential and the fastest comprehension of the Dao. The path of endless possibility.",
    trait: "Versatile — no weakness in any cultivation path." },
  { id: "beast",       name: "Beast",       img: "./assets/race_beast.png",
    blurb: "Born of martial blood. Ferocious bodies that forge a physical Dao mortals cannot match.",
    trait: "Body Refinement — physique-based techniques flow easier." },
  { id: "spirit_beast", name: "Spirit Beast", img: "./assets/race_spirit_beast.png",
    blurb: "Ethereal creatures woven from qi. Deep spiritual roots and rare elemental affinities.",
    trait: "Spirit Affinity — higher chance of rare element cards." },
  { id: "monster",     name: "Monster",     img: "./assets/race_monster.png",
    blurb: "Feared bloodlines of the wild. Immense strength at the cost of a harder heart-tribulation.",
    trait: "Savage Growth — greater raw power, harsher tribulations." },
];

// Elements drawable at the mortal start (Human World I). Weighted toward common
// so duplicates naturally occur — this is the *bounded* draw (design-review #2):
// pigeonhole across 9 draws guarantees at least a pair, so Aura never falls below Red.
export const ELEMENTS = [
  { id: "earth",     name: "Earth",     rarity: "common", weight: 20, color: "#c79a5b" },
  { id: "fire",      name: "Fire",      rarity: "common", weight: 20, color: "#e8623a" },
  { id: "water",     name: "Water",     rarity: "common", weight: 20, color: "#43a6ef" },
  { id: "wood",      name: "Wood",      rarity: "common", weight: 20, color: "#54c07a" },
  { id: "gold",      name: "Gold",      rarity: "common", weight: 20, color: "#e8c53a" },
  { id: "wind",      name: "Wind",      rarity: "rare",   weight: 8,  color: "#9fe8c0" },
  { id: "lightning", name: "Lightning", rarity: "rare",   weight: 8,  color: "#b56ce8" },
  { id: "light",     name: "Light",     rarity: "epic",   weight: 3,  color: "#f3ecc4" },
  { id: "dark",      name: "Dark",      rarity: "epic",   weight: 3,  color: "#8a6ad0" },
];

// Aura = POTENTIAL, not raw power. Tier is set by how many duplicates of your
// dominant element land among the 9 element cards. Multipliers TAPER at higher
// realms (see /data/auras.json) — a Red cultivator can still reach the ceiling.
export const AURA_TIERS = [
  { id: "red",    dup: 2, name: "Red Aura",    color: "#e0483a", speed: 1.05, ceilingNote: "The common spark. Nothing given — everything earned." },
  { id: "orange", dup: 3, name: "Orange Aura", color: "#e8873a", speed: 1.10, ceilingNote: "A warm root. Steady growth ahead." },
  { id: "yellow", dup: 4, name: "Yellow Aura", color: "#e8c93a", speed: 1.16, ceilingNote: "Bright talent. Sects begin to notice." },
  { id: "green",  dup: 5, name: "Green Aura",  color: "#54c07a", speed: 1.23, ceilingNote: "Verdant fortune. A prized recruit." },
  { id: "teal",   dup: 6, name: "Teal Aura",   color: "#3ac9c0", speed: 1.31, ceilingNote: "Rare clarity of the Dao." },
  { id: "blue",   dup: 7, name: "Blue Aura",   color: "#3a7ae8", speed: 1.40, ceilingNote: "A once-in-a-generation root." },
  { id: "purple", dup: 8, name: "Purple Aura", color: "#9b4ce8", speed: 1.50, ceilingNote: "Purple qi from the east. Legends whisper." },
  { id: "white",  dup: 9, name: "White Aura",  color: "#f2f2ff", speed: 1.75, ceilingNote: "Nine of one. The heavens themselves take note." },
];

// The 6 Destiny Cards — horizontal flavor + minor bonuses. Each rolls a grade
// with a floor (no 'unfun' roll): the roll is bounded, never below Mortal.
export const DESTINY_ASPECTS = [
  { id: "physique",      name: "Physique",      icon: "骸" },
  { id: "spiritual_root", name: "Spiritual Root", icon: "根" },
  { id: "soul",          name: "Soul",          icon: "魂" },
  { id: "comprehension", name: "Comprehension", icon: "悟" },
  { id: "luck",          name: "Luck",          icon: "福" },
  { id: "destiny",       name: "Destiny",       icon: "命" },
];

export const DESTINY_GRADES = [
  { g: 1, name: "Mortal",    color: "#9aa3af", weight: 26 },
  { g: 2, name: "Common",    color: "#c79a5b", weight: 30 },
  { g: 3, name: "Uncommon",  color: "#54c07a", weight: 22 },
  { g: 4, name: "Rare",      color: "#3a7ae8", weight: 14 },
  { g: 5, name: "Epic",      color: "#9b4ce8", weight: 6 },
  { g: 6, name: "Heavenly",  color: "#e8c53a", weight: 2 },
];

// First cultivation realm — the vertical slice demonstrates Qi Gathering,
// where Aura visibly scales growth *speed* (not the ceiling).
export const REALM = {
  id: "qi_gathering", name: "Qi Gathering", layers: 9,
  baseProgressPerLayer: 100,     // arbitrary prototype units
};
