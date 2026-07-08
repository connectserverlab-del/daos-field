# Art-Refs Manifest

All assets AI-generated with **Higgsfield / Nano Banana** (image), **Nano Banana Pro** (4K/photoreal),
and **Sonilo** (music). **These are reference/look targets and starter assets, not final game
content.** See `../docs/07-asset-import.md` for how to use each.

| File | Type | What it is | In-engine use |
|---|---|---|---|
| `keyart/bg_dawn_mountains.png` | Key art (16:9) | Floating jade peaks, pagoda, dawn god-rays | Color-grade LUT, loading screen, lighting/mood target |
| `keyart/bg_world1.png` | Key art (16:9) | Human World I valley village vista | First-region blockout & mood reference |
| `characters/race_human.png` | Character ref | Photoreal human cultivator (Blood-Message-grade) | MetaHuman likeness + robe material target |
| `characters/race_beast.png` | Character ref | Beast-race cultivator (feline traits, horns) | MetaHuman + modular part design |
| `characters/race_spirit_beast.png` | Character ref | Spirit-beast cultivator (fox/deer, antlers, markings) | MetaHuman + modular part design |
| `characters/race_monster.png` | Character ref | Monster-race cultivator (scales, crimson eyes) | MetaHuman + modular part design |
| `characters/enemy_demon_beast.webp` | Enemy ref (4-frame) | Demon-beast enemy: idle / idle / hurt / defeated | First enemy design + hurt/death anim intent |
| `textures/grass_ground.webp` | PBR albedo (2K, seamless) | Mossy grass valley floor | Landscape layer albedo (make normal/ORM — `07`) |
| `textures/dirt_ground.webp` | PBR albedo (2K, seamless) | Damp earth / mud path | Landscape layer albedo |
| `textures/cliff_rock.webp` | PBR albedo (2K, seamless) | Weathered mossy mountain stone | Landscape/cliff layer albedo |
| `sky/sky_dawn.webp` | Sky panorama (4K, 21:9) | Photoreal dawn clouds + god-rays | Sky grade reference (build with Sky Atmosphere) |
| `anim-refs/hero_run.webp` | Anim ref (6-frame strip) | Back-view cultivator run cycle | Locomotion pose/timing reference |
| `anim-refs/hero_attack.webp` | Anim ref (5-frame strip) | Sword-Dao slash sequence, qi blade | Combat montage pose/timing reference |
| `anim-refs/hero_idle.webp` | Anim ref (1 frame) | Cultivator idle, sheathed sword | Idle pose reference |
| `ui/card_back.png` | UI art (1:1) | Ornate Heavenly Card back | Character-creation UMG art |
| `ui/aura_glow.png` | UI/VFX art (1:1) | Radiant qi aura halo | Aura Niagara/UI element |
| `audio/ambient_score.m4a` | Music (45s loop) | Guqin/dizi wuxia valley ambience | Ambient music bed (MetaSounds + submix) |

## Style formula (the look these share)
> Painterly-to-photoreal cinematic realism; misty deep-teal & slate mountains with warm amber
> highlights; robes in aged ivory, bronze and deep lacquer; qi/aura energy as a luminous signal glow
> rising ember-red → radiant white; dramatic volumetric god-rays, atmospheric dawn haze; high
> contrast between glowing elements and muted backgrounds.

Match this in-engine via the color-grade LUT, material palette, and lighting. The photoreal character
refs were reference-guided to a *Blood Message*-style still (gritty weathered skin, hazy backlight,
desaturated film grade) — that's the fidelity bar for the MetaHumans.

## Regenerating / extending
More assets can be generated in the same style (new races, techniques VFX sheets, environment texture
variety, additional enemies, key art). Keep the style formula above byte-consistent across prompts.
