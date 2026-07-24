// Show full content of each duplicate pair so I can decide merge vs delete.

import { readFileSync } from "node:fs";
const DIR = "C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase";

const targets = [
  { file: "craft.json",     arrayKey: "facts",       ids: ["cand.craft_fact.bcd_c2", "cand.craft_fact.8ss_c5"] },
  { file: "craft.json",     arrayKey: "facts",       ids: ["cand.craft_fact.bcd_c3", "cand.craft_fact.8ss_c4"] },
  { file: "craft.json",     arrayKey: "facts",       ids: ["cand.craft_fact.bcd_c5", "cand.craft_fact.8ss_c6"] },
  { file: "materials.json", arrayKey: "materials",   ids: ["cand.materials_mat.cd_c16", "cand.materials_mat.ss_c14"] },
  { file: "defects.json",   arrayKey: "defects",     ids: ["cand.defects_defect.bcd_c9", "cand.defects_defect.8ss_c0"] }
];

for (const t of targets) {
  const raw = JSON.parse(readFileSync(`${DIR}\\${t.file}`, "utf-8"));
  const items = raw.payload[t.arrayKey];
  console.log("═".repeat(70));
  console.log(`${t.file} · ${t.ids.join(" vs ")}`);
  console.log("═".repeat(70));
  for (const id of t.ids) {
    const item = items.find(i => i.id === id);
    if (!item) { console.log(`  (not found: ${id})`); continue; }
    console.log(`\n[${id}]`);
    console.log(JSON.stringify(item, null, 2));
  }
  console.log();
}
