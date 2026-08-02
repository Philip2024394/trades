// Backfill `balcony` component tag on designs with a landing/balcony feature.
// Philip 2026-08-02.
//
// Idempotent · adds "balcony" to components[] where not already present.
// Only touches designs that have a visible landing/balcony per authored notes.

import { readFileSync, writeFileSync } from "node:fs";

const PATH = "data/nex-confirmed-images.json";
const d = JSON.parse(readFileSync(PATH, "utf8"));

// Designs known to have upper landings / balcony balustrade continuations.
// From authored design_notes:
//   Nex025 · Contemporary Straight · Mono-Stringer + Timber Treads + Frameless Glass · continues to upper level
//   Nex026 · Contemporary Straight · Side-Stringer + Walnut Treads + Frameless Glass · continues to upper level
//   Nex027 · Classic Quarter-Turn Oak · Feature Landing (explicitly named)
//   Nex028 · Modern Oak Open-Riser · verbatim "the balustrade continues around the upper landing to create one continuous architectural feature"
const BALCONY_DESIGNS = [
  "NEX-DESIGN-000025",
  "NEX-DESIGN-000026",
  "NEX-DESIGN-000027",
  "NEX-DESIGN-000028",
];

let added = 0;
for (const id of BALCONY_DESIGNS) {
  const rec = d.confirmed.find((r) => r.design_id === id);
  if (!rec) { console.log(`  ${id} · NOT FOUND`); continue; }
  rec.components = Array.isArray(rec.components) ? rec.components : [];
  if (!rec.components.includes("balcony")) {
    rec.components.push("balcony");
    added++;
    console.log(`  ${id} · added "balcony" → components: [${rec.components.join(", ")}]`);
  } else {
    console.log(`  ${id} · already tagged balcony (idempotent skip)`);
  }
}

d.updated_at = new Date().toISOString();
writeFileSync(PATH, JSON.stringify(d, null, 2), "utf8");

console.log(`\nBackfilled balcony tag on ${added} design(s).`);
