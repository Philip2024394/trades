#!/usr/bin/env node
// Remove ALL intake-2026-08-13 batch entries + their category attachments from the manifest.
// Used to reset state before re-running ingest-intake-observations.mjs with an updated fingerprint.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MAN = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
const man = JSON.parse(await readFile(MAN, "utf8"));

const beforeV3   = (man.images_v3 || []).length;
const batchSrcs  = new Set(
  (man.images_v3 || [])
    .filter(e => e.governance?.source_batch === "intake-2026-08-13")
    .map(e => e.src)
);

man.images_v3 = (man.images_v3 || []).filter(e => e.governance?.source_batch !== "intake-2026-08-13");

let removedFromCats = 0;
for (const cat of man.categories || []) {
  const before = (cat.images || []).length;
  cat.images = (cat.images || []).filter(i => !batchSrcs.has(i.src));
  removedFromCats += before - (cat.images || []).length;
}

// Remove the note we added.
man.notes = (man.notes || []).filter(n => !n.includes("intake-2026-08-13"));

await writeFile(MAN, JSON.stringify(man, null, 2) + "\n", "utf8");
console.log(`removed ${beforeV3 - man.images_v3.length} images_v3 entries + ${removedFromCats} category attachments`);
