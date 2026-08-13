#!/usr/bin/env node
// Targeted reclassification for images Philip identified as arched-wood-inset.
// Also reverts intake-011 from mahogany → walnut (previous mahogany reclassification
// was wrong · Philip confirms it's the walnut arched-wood-inset reference image).
//
// Schema extension: material_composition riser row gains optional `pattern` and
// `inset_species` fields. `pattern: "arched-wood-inset"` means the riser is a
// cream painted frame with an arched wood panel inset. `inset_species` names the
// wood species of the panel.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CORRECTIONS = [
  {
    file: "intake-009-73e7d323121f1e44.png",
    seq: 9,
    tread: { material: "wood", sub: "maple" },
    riser: { material: "painted", sub: "cream", pattern: "arched-wood-inset", inset_species: "maple" },
    reason: "Philip confirmed: this is the MAPLE arched-wood-inset reference (cream painted riser frame with maple arched panel inset).",
  },
  {
    file: "intake-007-6013022096d9419a.png",
    seq: 7,
    tread: { material: "wood", sub: "oak" },
    riser: { material: "painted", sub: "cream", pattern: "arched-wood-inset", inset_species: "oak" },
    reason: "Philip confirmed: this is the OAK arched-wood-inset reference (cream painted riser frame with oak arched panel inset).",
  },
  {
    file: "intake-011-fd85b1526a180b12.png",
    seq: 11,
    tread: { material: "wood", sub: "walnut" },
    riser: { material: "painted", sub: "cream", pattern: "arched-wood-inset", inset_species: "walnut" },
    newel:    { material: "wood", sub: "walnut" },   // revert from mahogany
    handrail: { material: "wood", sub: "walnut" },   // revert from mahogany
    reason: "Philip confirmed: this is the WALNUT arched-wood-inset reference. Previous mahogany reclassification was wrong · reverted to walnut.",
  },
];

const MAN = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
const OBS = join(process.cwd(), "data", "staircase-renovations", "intake", "observations.json");

const man = JSON.parse(await readFile(MAN, "utf8"));
const obs = JSON.parse(await readFile(OBS, "utf8"));
const NOW = new Date().toISOString();

function targetCategoriesForTread(sub) {
  const t = String(sub || "").toLowerCase();
  const out = new Set();
  if (t.includes("oak"))      out.add("oak");
  if (t.includes("walnut"))   out.add("walnut");
  if (t.includes("mahogany")) out.add("walnut");
  if (t.includes("maple"))    out.add("oak");
  return [...out];
}
function materialsTagsForTread(sub) {
  const t = String(sub || "").toLowerCase();
  const tags = new Set();
  if (t.includes("oak"))     tags.add("oak");
  if (t === "walnut")        tags.add("walnut");
  if (t === "mahogany")      { tags.add("mahogany"); tags.add("walnut"); }
  if (t === "maple")         tags.add("maple");
  return [...tags];
}

let touched = 0;
for (const fix of CORRECTIONS) {
  const entry = man.images_v3.find(e => e.src.endsWith(fix.file));
  if (!entry) { console.warn(`skipped ${fix.file} — not in images_v3`); continue; }
  const oldSub = entry.sub_material;
  entry.sub_material = fix.tread.sub;
  entry.material     = fix.tread.material;

  const roleMap = { tread: fix.tread, riser: fix.riser, newel: fix.newel, handrail: fix.handrail };
  for (const [role, patch] of Object.entries(roleMap)) {
    if (!patch) continue;
    let row = entry.material_composition?.find(c => c.component_role === role);
    if (!row) {
      row = { component_role: role, confidence: "observed" };
      entry.material_composition = entry.material_composition || [];
      entry.material_composition.push(row);
    }
    if (patch.material !== undefined)      row.material      = patch.material;
    if (patch.sub !== undefined)           row.sub_material  = patch.sub;
    if (patch.pattern !== undefined)       row.pattern       = patch.pattern;
    if (patch.inset_species !== undefined) row.inset_species = patch.inset_species;
  }

  // Regenerate alt.
  const t = entry.material_composition.find(c => c.component_role === "tread");
  const r = entry.material_composition.find(c => c.component_role === "riser");
  const treadDesc = `${t?.sub_material} ${t?.material} tread`;
  const riserDesc = r?.pattern
    ? `${r?.sub_material} painted riser with ${r?.inset_species} arched wood inset`
    : `${r?.sub_material ?? ""} ${r?.material ?? ""} riser`;
  entry.alt = `NEX Trade Center whole-staircase — ${treadDesc}, ${riserDesc}, arched-wood-inset pattern reference (Philip-confirmed 2026-08-13)`;
  entry.distinctive = `arched-wood-inset pattern · ${fix.tread.sub} arched panel on cream painted riser frame`;

  entry.governance = entry.governance || {};
  entry.governance.updated_at = NOW;
  entry.governance.corrections = entry.governance.corrections || [];
  entry.governance.corrections.push({
    at: NOW, from: { sub_material: oldSub }, to: { sub_material: entry.sub_material,
      pattern: fix.riser?.pattern, inset_species: fix.riser?.inset_species }, reason: fix.reason,
  });

  // Sync observations.json
  const oe = obs.observations.find(o => o.seq === fix.seq);
  if (oe) {
    oe.tread    = { ...oe.tread,    ...fix.tread };
    oe.riser    = { ...oe.riser,    ...fix.riser };
    if (fix.newel)    oe.newel    = { ...oe.newel,    ...fix.newel };
    if (fix.handrail) oe.handrail = { ...oe.handrail, ...fix.handrail };
    oe.corrected_at = NOW;
    oe.correction_reason = fix.reason;
  }

  // Refresh category attachments.
  const newCats = new Set(targetCategoriesForTread(entry.sub_material));
  const newTags = materialsTagsForTread(entry.sub_material);
  for (const cat of man.categories) {
    const idx = (cat.images || []).findIndex(i => i.src === entry.src);
    const shouldExist = newCats.has(cat.slug);
    if (shouldExist) {
      if (idx >= 0) {
        cat.images[idx].alt = entry.alt;
        cat.images[idx].materials = newTags.length ? newTags : undefined;
      } else {
        cat.images = cat.images || [];
        cat.images.push({
          src: entry.src, alt: entry.alt,
          sort: (cat.images.at(-1)?.sort ?? 0) + 1,
          materials: newTags.length ? newTags : undefined,
        });
      }
    } else if (idx >= 0) {
      cat.images.splice(idx, 1);
    }
  }

  touched++;
  console.log(`✓ ${fix.file}: ${oldSub} → ${entry.sub_material} + arched-wood-inset pattern`);
}

man.updated_at = NOW.slice(0, 10);
await writeFile(MAN, JSON.stringify(man, null, 2) + "\n", "utf8");
await writeFile(OBS, JSON.stringify(obs, null, 2) + "\n", "utf8");
console.log(`\n${touched}/${CORRECTIONS.length} corrections applied.`);
