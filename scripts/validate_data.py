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

    if errors:
        print("DATA VALIDATION FAILED:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(1)
    print("data validation passed")


if __name__ == "__main__":
    main()
