#!/usr/bin/env node
// scripts/report-staircase-brain-state.mjs
// Snapshot of the staircase_brain from the current manifest.

import fs from "node:fs/promises";
import path from "node:path";

const manifestPath = path.join(process.cwd(), "data", "nex-image-manifest.json");
const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));

const rows = Object.entries(manifest.images).map(([url, row]) => ({ url, ...row }));

const stair = rows.filter((r) => r.primary_brain === "staircase_brain");
const noBrain = rows.filter((r) => !r.primary_brain);
const otherBrain = rows.filter((r) => r.primary_brain && r.primary_brain !== "staircase_brain");

const bands = {};
const scoreBuckets = { "90+": 0, "80-89": 0, "70-79": 0, "60-69": 0, "50-59": 0, "<50": 0 };
let totalScore = 0;
let scored = 0;

for (const r of stair) {
  const band = r.knowledge_band_label || "unknown";
  bands[band] = (bands[band] || 0) + 1;
  const s = r.master_image_score?.master_score;
  if (typeof s === "number") {
    totalScore += s;
    scored++;
    if (s >= 90) scoreBuckets["90+"]++;
    else if (s >= 80) scoreBuckets["80-89"]++;
    else if (s >= 70) scoreBuckets["70-79"]++;
    else if (s >= 60) scoreBuckets["60-69"]++;
    else if (s >= 50) scoreBuckets["50-59"]++;
    else scoreBuckets["<50"]++;
  }
}

const brainCounts = {};
for (const r of rows) {
  const b = r.primary_brain || "(unclassified)";
  brainCounts[b] = (brainCounts[b] || 0) + 1;
}

console.log("=== NEX BRAIN STATUS ===\n");
console.log("Manifest total rows:", rows.length);
console.log("");
console.log("Brain distribution across manifest:");
for (const [b, c] of Object.entries(brainCounts).sort((a, b) => b[1] - a[1])) {
  console.log("  " + b.padEnd(22), c);
}

console.log("");
console.log("=== staircase_brain snapshot ===");
console.log("  Rows in brain:      ", stair.length);
console.log("  Avg score:          ", scored ? (totalScore / scored).toFixed(1) : "n/a", "/ 100");
console.log("");
console.log("  Band distribution:");
for (const [b, c] of Object.entries(bands).sort((a, b) => b[1] - a[1])) {
  console.log("    " + b.padEnd(24), c);
}
console.log("");
console.log("  Score buckets:");
for (const [b, c] of Object.entries(scoreBuckets)) {
  console.log("    " + b.padEnd(8), c);
}

// Collections touched
const collectionCounts = {};
for (const r of stair) {
  for (const m of r.collection_memberships || []) {
    collectionCounts[m.collection_id || m] = (collectionCounts[m.collection_id || m] || 0) + 1;
  }
}
console.log("");
console.log("  Distinct collections touched by staircase_brain:", Object.keys(collectionCounts).length);
console.log("");
console.log("  Top 10 collections by row count:");
const topCollections = Object.entries(collectionCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);
for (const [c, n] of topCollections) console.log("    " + String(c).padEnd(36), n);

// Family tree signals
let hasFamily = 0;
let asParent = 0;
let asChild = 0;
let siblingCount = 0;
for (const r of stair) {
  if (r.family_tree) {
    hasFamily++;
    if (r.family_tree.children?.length) asParent++;
    if (r.family_tree.parent_url) asChild++;
    for (const c of r.family_tree.children || []) {
      if (c.type?.startsWith("sibling_")) siblingCount++;
    }
  }
}
console.log("");
console.log("  Family tree signals:");
console.log("    Rows with family_tree:", hasFamily);
console.log("    Rows as parent (have children):", asParent);
console.log("    Rows as child (have parent):", asChild);
console.log("    Sibling relationships (edges):", siblingCount);

console.log("");
console.log("Rows STILL without any brain:", noBrain.length);
console.log("Rows classified to non-staircase brains:", otherBrain.length);
