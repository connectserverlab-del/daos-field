#!/usr/bin/env python3
"""Validate DAO'S FIELD data-driven config.

This is the guardrail that makes "add content without rewrites" safe: no malformed
config ever reaches a game server. Run locally with `python3 scripts/validate_data.py`
or in CI. Exits non-zero on any problem.

Checks:
  * every data/*.json parses
  * elements.json validates against schema/element.schema.json
  * element ids are unique and rarities are within the declared registry
  * cross-file id integrity (auras <-> fires <-> realms <-> worlds)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
errors = []


def load(name):
    try:
        return json.loads((DATA / name).read_text())
    except Exception as e:  # noqa: BLE001
        errors.append(f"{name}: failed to parse ({e})")
        return None


def main():
    elements = load("elements.json")
    auras = load("auras.json")
    realms = load("cultivation_realms.json")
    worlds = load("worlds.json")
    fires = load("heavenly_fires.json")

    # Schema validation (optional dep; CI installs jsonschema)
    if elements is not None:
        try:
            import jsonschema

            schema = json.loads((DATA / "schema" / "element.schema.json").read_text())
            jsonschema.validate(elements, schema)
        except ImportError:
            print("note: jsonschema not installed; schema check skipped")
        except Exception as e:  # noqa: BLE001
            errors.append(f"elements.json: schema validation failed ({e})")

        ids = [e["id"] for e in elements["elements"]]
        if len(ids) != len(set(ids)):
            errors.append("elements.json: duplicate element ids")
        tiers = set(elements.get("rarityTiers", []))
        for e in elements["elements"]:
            if e["rarity"] not in tiers:
                errors.append(f"elements.json: {e['id']} rarity '{e['rarity']}' not in rarityTiers")
        # interaction targets must reference real elements
        idset = set(ids)
        for e in elements["elements"]:
            for other in (e.get("interactions") or {}):
                if other not in idset:
                    errors.append(f"elements.json: {e['id']} interacts with unknown element '{other}'")

    # Cross-file integrity: fire.auraTier must be a real aura tier
    if fires is not None and auras is not None:
        aura_tiers = {t["id"] for t in auras["tiers"]}
        for g in fires["grades"]:
            if g["auraTier"] not in aura_tiers:
                errors.append(f"heavenly_fires.json: grade {g['id']} references unknown auraTier '{g['auraTier']}'")

    # worlds.unlockRealm must be a real realm id
    if worlds is not None and realms is not None:
        realm_ids = {r["id"] for r in realms["realms"]}
        for layer in worlds["layers"]:
            ur = layer.get("unlockRealm")
            if ur and ur not in realm_ids:
                errors.append(f"worlds.json: layer {layer['id']} unlockRealm '{ur}' is not a defined realm")

    # Cultivation-system config (Phase 3): draw / destiny / races
    draw = load("draw.json")
    destiny = load("destiny.json")
    races = load("races.json")
    if draw is not None and elements is not None:
        rarity_tiers = set(elements.get("rarityTiers", []))
        for r in draw.get("drawableRarities", []):
            if r not in rarity_tiers:
                errors.append(f"draw.json: drawableRarity '{r}' not in elements.rarityTiers")
        for r in draw.get("rarityWeights", {}):
            if r not in rarity_tiers:
                errors.append(f"draw.json: rarityWeight key '{r}' not in elements.rarityTiers")
        # at least one drawable element must have positive weight (else Aura can't be computed)
        weights = draw.get("rarityWeights", {})
        drawable = [e for e in (elements["elements"] if elements else [])
                    if e["rarity"] in set(draw.get("drawableRarities", [])) and weights.get(e["rarity"], 0) > 0]
        if len(drawable) < 2:
            errors.append("draw.json: fewer than 2 drawable elements with positive weight (Aura draw impossible)")
    if destiny is not None:
        gids = [g["g"] for g in destiny.get("grades", [])]
        if len(gids) != len(set(gids)):
            errors.append("destiny.json: duplicate grade 'g' values")
        floor = destiny.get("floorGrade", 1)
        if floor not in gids:
            errors.append(f"destiny.json: floorGrade {floor} is not a defined grade")
        if len(destiny.get("aspects", [])) != 6:
            errors.append("destiny.json: expected exactly 6 destiny aspects")
    if races is not None:
        rids = [r["id"] for r in races.get("races", [])]
        if len(rids) != len(set(rids)):
            errors.append("races.json: duplicate race ids")

    if errors:
        print("DATA VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print("data validation passed")


if __name__ == "__main__":
    main()
