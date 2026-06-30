#!/usr/bin/env node
// Build src/lib/ukOutwardCodesData.ts from a UK outcodes CSV.
//
// Usage: node scripts/build-uk-outcodes.mjs <path-to-csv>
//
// CSV header expected (case-sensitive):
//   postcode,eastings,northings,latitude,longitude,...
//
// We only consume the postcode + latitude + longitude columns. Source we
// used initially: github.com/gibbs/uk-postcodes (archived 2018 — outward
// code centroids drift slowly so this is still accurate to within a few
// hundred metres for almost all districts).

import { readFileSync, writeFileSync } from "node:fs";
import { argv } from "node:process";

const csvPath = argv[2];
if (!csvPath) {
  console.error("Usage: node scripts/build-uk-outcodes.mjs <path-to-csv>");
  process.exit(1);
}

const lines = readFileSync(csvPath, "utf8")
  .split(/\r?\n/)
  .filter((l) => l && !l.startsWith("postcode,"));
const map = {};
for (const line of lines) {
  const cols = line.split(",");
  const outcode = cols[0];
  const lat = parseFloat(cols[3]);
  const lng = parseFloat(cols[4]);
  if (!outcode || !Number.isFinite(lat) || !Number.isFinite(lng)) continue;
  map[outcode] = {
    lat: Math.round(lat * 10000) / 10000,
    lng: Math.round(lng * 10000) / 10000
  };
}

const sorted = Object.fromEntries(
  Object.entries(map).sort(([a], [b]) => a.localeCompare(b))
);
const count = Object.keys(sorted).length;

const header = `// Auto-generated — UK outward-code centroids (${count} entries).
// Source: github.com/gibbs/uk-postcodes (CC0-equivalent, archived 2018).
// Regenerate by re-running scripts/build-uk-outcodes.mjs.
//
// Each entry is the geographic centroid of a UK postcode district
// (e.g. "M16" = Old Trafford). Used by the TradeAreaMap to plot a dot
// per in-zone postcode on the merchant's delivery preview, and by
// postcodesWithinRadius() to enumerate every postcode falling inside
// the merchant's zone circles.

export type Latlng = { lat: number; lng: number };

export const UK_OUTWARD_CODES: Record<string, Latlng> = `;

writeFileSync(
  "src/lib/ukOutwardCodesData.ts",
  header + JSON.stringify(sorted) + ";\n"
);
console.log(`Wrote src/lib/ukOutwardCodesData.ts (${count} entries)`);
