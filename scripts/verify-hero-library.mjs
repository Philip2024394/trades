#!/usr/bin/env node
// verify-hero-library.mjs
//
// Confirms every canonical UK trade has at least one hero candidate
// in the library, and reports coverage. Run after the migration to
// prove the AI can pick a hero for any merchant.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const LIB = JSON.parse(fs.readFileSync(path.join(ROOT, "scripts", "hero-library.json"), "utf8"));

// Same scoring as src/lib/heroLibrary/index.ts (kept in sync).
function normalise(k) {
  return k.toLowerCase().replace(/-/g, " ").trim();
}
function score(entry, tradeSlug) {
  const trade = normalise(tradeSlug);
  const excluded = (entry.excluded_trades ?? []).map(normalise);
  if (excluded.some((t) => t === trade || trade.includes(t) || t.includes(trade))) return -1;
  const kws = entry.keywords_strict.map(normalise);
  let s = 0;
  for (const k of kws) {
    if (k === trade) s += 100;
    else if (k.includes(trade) || trade.includes(k)) s += 40;
    else {
      const tradeTokens = new Set(trade.split(/\s+/));
      const kwTokens = k.split(/\s+/);
      const overlap = kwTokens.filter((t) => tradeTokens.has(t)).length;
      if (overlap > 0) s += overlap * 10;
    }
  }
  if (entry.recommended_use === "hero") s += 10;
  if (entry.worker_visible) s += 3;
  return s;
}

const CANONICAL_TRADES = [
  "plumber", "electrician", "gas-engineer", "roofer", "carpenter",
  "joiner", "painter", "tiler", "plasterer", "kitchen-fitter",
  "bathroom-fitter", "landscaper", "general-builder", "bricklayer",
  "stonemason", "groundworker", "scaffolder", "building-merchant",
  "builders-supplies", "tool-hire", "chimney-sweep", "hvac-contractor",
  "drainage-engineer", "solar-installer", "conservatory-installer",
  "heat-pump-installer", "damp-proofer", "asbestos-removal",
  "tree-surgeon", "pest-control"
];

console.log(`Library: ${LIB.entries.length} total entries`);
const migrated = LIB.entries.filter((e) => e.$migration_status);
console.log(`  · human-curated: ${LIB.entries.length - migrated.length}`);
console.log(`  · auto-migrated (needs review): ${migrated.length}\n`);

let noMatch = 0;
for (const trade of CANONICAL_TRADES) {
  const matches = LIB.entries
    .map((e) => ({ entry: e, s: score(e, trade) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s);
  const status = matches.length > 0 ? "✓" : "✗";
  if (matches.length === 0) noMatch += 1;
  console.log(
    `${status} ${trade.padEnd(24)} candidates=${String(matches.length).padStart(3)}  top=${matches[0]?.entry.id?.slice(0, 32) ?? "(none)"}`
  );
}
console.log(`\n═ ${CANONICAL_TRADES.length - noMatch}/${CANONICAL_TRADES.length} trades have at least one hero candidate ═`);
if (noMatch > 0) {
  console.log(`⚠ ${noMatch} trades have zero candidates — needs manual entry.`);
}
