// Node-only loader for the /data JSON (kept out of the pure core so the core runs in the
// browser/engine too). In the browser, fetch the same files and pass them to
// createCultivationEngine(data).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(HERE, "..", "..", "data"); // repo /data

function read(name) {
  return JSON.parse(readFileSync(join(DATA_DIR, name), "utf8"));
}

export function loadData() {
  return {
    elements: read("elements.json"),
    auras: read("auras.json"),
    realms: read("cultivation_realms.json"),
    races: read("races.json"),
    destiny: read("destiny.json"),
    draw: read("draw.json"),
  };
}
