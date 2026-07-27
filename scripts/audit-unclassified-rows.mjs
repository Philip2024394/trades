#!/usr/bin/env node
// scripts/audit-unclassified-rows.mjs
// Snapshot the state of unclassified rows BEFORE batch reprocessing.

import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const rows = Object.entries(manifest.images).map(([url, row]) => ({ url, ...row }));
const unclassified = rows.filter((r) => !r.primary_brain);

function textLen(r) {
  return (
    (r.description || "").length +
    (r.master_description || "").length +
    (Array.isArray(r.tags) ? r.tags.join(" ").length : 0)
  );
}

const buckets = {
  empty:       unclassified.filter((r) => textLen(r) === 0),
  tiny:        unclassified.filter((r) => textLen(r) > 0 && textLen(r) < 100),
  short:       unclassified.filter((r) => textLen(r) >= 100 && textLen(r) < 500),
  medium:      unclassified.filter((r) => textLen(r) >= 500 && textLen(r) < 2000),
  rich:        unclassified.filter((r) => textLen(r) >= 2000),
};

console.log("=== UNCLASSIFIED ROW AUDIT ===\n");
console.log("Unclassified rows total:", unclassified.length);
console.log("");
console.log("By text richness:");
for (const [b, arr] of Object.entries(buckets)) {
  console.log("  " + b.padEnd(10), arr.length);
}
console.log("");

// Score bucket for those that HAVE been scored but not brain-assigned
const scored = unclassified.filter((r) => typeof r.master_image_score?.master_score === "number");
console.log("Unclassified BUT already scored:", scored.length);

// A few samples from each bucket
console.log("");
console.log("--- Sample: tiny (0 < len < 100) ---");
for (const r of buckets.tiny.slice(0, 3)) {
  console.log("  ", r.url.split("/").pop().slice(0, 45), "· len:", textLen(r));
  if (r.description) console.log("    desc:", r.description.slice(0, 80));
}
console.log("");
console.log("--- Sample: short (100–500) ---");
for (const r of buckets.short.slice(0, 3)) {
  console.log("  ", r.url.split("/").pop().slice(0, 45), "· len:", textLen(r));
  if (r.description) console.log("    desc:", r.description.slice(0, 80));
}
console.log("");
console.log("--- Sample: medium (500–2000) ---");
for (const r of buckets.medium.slice(0, 3)) {
  console.log("  ", r.url.split("/").pop().slice(0, 45), "· len:", textLen(r));
}
console.log("");
console.log("--- Sample: rich (>2000) ---");
for (const r of buckets.rich.slice(0, 3)) {
  console.log("  ", r.url.split("/").pop().slice(0, 45), "· len:", textLen(r));
}

// Sample: URLs of the empty ones
console.log("");
console.log("--- Sample: empty (no text at all) ---");
for (const r of buckets.empty.slice(0, 5)) {
  console.log("  ", r.url.slice(0, 90));
}
