// Scan every Brain module draft for duplicate items.
// Read-only — reports only. Companion script (dedup-) will do the fix.
//
// Definition of "duplicate":
//   - facts: same normalised `statement` text
//   - regulations: same normalised `name` + `authority`
//   - materials: same normalised `name`
//   - defects: same normalised `name`
//   - playbooks: same normalised `title`

import { readFileSync } from "node:fs";

const DIR = "C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase";

function normalise(s) {
  if (typeof s !== "string") return "";
  return s.toLowerCase()
    .replace(/[.,;:!?()"'’‘“”\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const MODULES = [
  { file: "craft.json",        arrayKey: "facts",       textKey: "statement" },
  { file: "regulations.json",  arrayKey: "regulations", textKey: "name" },
  { file: "materials.json",    arrayKey: "materials",   textKey: "name" },
  { file: "defects.json",      arrayKey: "defects",     textKey: "name" },
  { file: "workflow.json",     arrayKey: "playbooks",   textKey: "title" }
];

let totalDupes = 0;
console.log("═".repeat(70));
console.log("NEX STAIRCASE BRAIN — DUPLICATE SCAN");
console.log("═".repeat(70));

for (const m of MODULES) {
  const raw = JSON.parse(readFileSync(`${DIR}\\${m.file}`, "utf-8"));
  const items = raw.payload?.[m.arrayKey] ?? [];
  const groups = new Map();
  for (const item of items) {
    const key = normalise(item[m.textKey]);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const dupes = [...groups.entries()].filter(([_, arr]) => arr.length > 1);
  console.log(`\n[${m.file}] ${items.length} items · ${dupes.length} duplicate groups`);
  if (dupes.length > 0) {
    for (const [key, arr] of dupes.slice(0, 20)) {   // cap at first 20 groups
      console.log(`  · "${arr[0][m.textKey].slice(0, 80)}" × ${arr.length}`);
      for (const item of arr) console.log(`      id: ${item.id}`);
    }
    if (dupes.length > 20) console.log(`  … and ${dupes.length - 20} more duplicate groups`);
  }
  totalDupes += dupes.reduce((sum, [_, arr]) => sum + (arr.length - 1), 0);
}

console.log("\n" + "═".repeat(70));
console.log(`Total duplicate items to remove: ${totalDupes}`);
console.log("═".repeat(70));
