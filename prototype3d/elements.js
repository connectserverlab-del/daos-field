// Canonical element roster (mirrors /data/elements.json) plus display colours,
// bundled with the build so the dev panel is fully self-contained on deploy.
window.ELEMENTS = [
  { id:"earth",     name:"Earth",            rarity:"common",    category:"defensive", color:0x9a7746, desc:"Stability, endurance, terrain control." },
  { id:"fire",      name:"Fire",             rarity:"common",    category:"offensive", color:0xff5a2a, desc:"Burst damage; core of alchemy and forging." },
  { id:"water",     name:"Water",            rarity:"common",    category:"support",   color:0x3aa0e8, desc:"Flow, adaptation, sustain." },
  { id:"wood",      name:"Wood",             rarity:"common",    category:"support",   color:0x4fae52, desc:"Growth, healing-over-time, life force." },
  { id:"gold",      name:"Gold",             rarity:"common",    category:"offensive", color:0xe8c65a, desc:"Sharpness, penetration; core of weapon forging." },
  { id:"wind",      name:"Wind",             rarity:"rare",      category:"utility",   color:0xa8f0d0, desc:"Speed, mobility, evasion." },
  { id:"lightning", name:"Lightning / Storm",rarity:"rare",      category:"offensive", color:0xb48cff, desc:"High burst, tribulation affinity." },
  { id:"light",     name:"Light",            rarity:"epic",      category:"support",   color:0xfff2b0, desc:"Healing and purification." },
  { id:"dark",      name:"Dark",             rarity:"epic",      category:"offensive", color:0x8a3ea8, desc:"Poison, corrosion, damage-over-time." },
  { id:"spirit",    name:"Spirit",           rarity:"legendary", category:"support",   color:0x6fe0d6, desc:"Soul manipulation, taming, mental arts." },
  { id:"time",      name:"Time",             rarity:"legendary", category:"utility",   color:0x9ad0ff, desc:"Acceleration, delay, rewind (bounded)." },
  { id:"space",     name:"Space",            rarity:"legendary", category:"utility",   color:0x7a68e0, desc:"Teleportation, storage, domain warping." },
  { id:"life",      name:"Life",             rarity:"mythic",    category:"law",       color:0x7cf59e, desc:"Creation and true healing; a governing law." },
  { id:"fate",      name:"Fate",             rarity:"mythic",    category:"law",       color:0xff9ad5, desc:"Luck, causality, destiny manipulation." },
  { id:"death",     name:"Death",            rarity:"mythic",    category:"law",       color:0x5a5a68, desc:"Decay, ending, necromantic law." },
  { id:"rule",      name:"Rule",             rarity:"mythic",    category:"law",       color:0xffd700, desc:"Authority over laws themselves; the apex element." }
];
window.RARITY_ORDER = ["common","rare","epic","legendary","mythic"];
