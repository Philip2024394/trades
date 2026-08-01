// Backfill priority="standard" on every existing confirmed staircase record
// (Philip 2026-08-01 · one-time migration for the new editorial ranking system).
//
// After this runs, Philip can reclassify individual records via the confirm
// endpoint by posting { design_id, priority: "flagship"|"recommended"|"specialist" }
// or with a numeric { ranking_weight: 0-100 } override.
//
// Idempotent: skips records that already have priority set.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const LIBRARY_PATH = join(process.cwd(), "data/nex-confirmed-images.json");
const lib = JSON.parse(readFileSync(LIBRARY_PATH, "utf8"));

let updated = 0;
let alreadySet = 0;
for (const rec of lib.confirmed) {
  if (rec.priority !== undefined || typeof rec.ranking_weight === "number") {
    alreadySet += 1;
    continue;
  }
  rec.priority = "standard";
  updated += 1;
}

lib.updated_at = new Date().toISOString();
writeFileSync(LIBRARY_PATH, JSON.stringify(lib, null, 2), "utf8");

console.log(`Backfilled priority='standard' on ${updated} records`);
console.log(`Skipped ${alreadySet} records that already had priority/ranking_weight set`);
console.log(`Total: ${lib.confirmed.length} records`);
