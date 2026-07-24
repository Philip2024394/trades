#!/usr/bin/env node
// Bulk-append materials from a staging JSON file to the Brain's materials draft.
// Usage: node scripts/append-materials-batch.mjs <slug> <staging.json>

import { promises as fs } from "node:fs";
import path from "node:path";

const [, , slug, stagingPath] = process.argv;
if (!slug || !stagingPath) {
  console.error("Usage: node scripts/append-materials-batch.mjs <slug> <staging.json>");
  process.exit(1);
}

const staging = JSON.parse(await fs.readFile(stagingPath, "utf8"));
const draftPath = path.join(process.cwd(), ".author-studio-drafts", slug, "materials.json");
const draft = JSON.parse(await fs.readFile(draftPath, "utf8"));

let added = 0;
for (const m of staging.materials) {
  const id = `direct.mat.${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 6)}`;
  const mat = {
    id,
    family:            m.family,
    name:              m.name,
    grades:            m.grades ?? [],
    pack_sizes:        m.pack_sizes ?? [],
    defect_risk:       m.defect_risk ?? "medium",
    waste_factor_pct:  m.waste_factor_pct ?? 10,
    compatible_with:   m.compatible_with ?? [],
    incompatible_with: m.incompatible_with ?? [],
    evidence:          [{ source: "Nex", note: m.notes ?? "" }],
    confidence:        m.confidence ?? "high"
  };
  draft.payload.materials.push(mat);
  added++;
}

draft.updated_at = new Date().toISOString();
await fs.writeFile(draftPath, JSON.stringify(draft, null, 2), "utf8");
console.log(JSON.stringify({ ok: true, added, total_materials: draft.payload.materials.length }));
