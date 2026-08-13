#!/usr/bin/env node
// Reclassify individual images in manifest.images_v3 + observations.json when a
// visual audit reveals a mislabelled species. Also refresh category attachments
// so materials[] tags stay accurate.
//
// Configure the CORRECTIONS list below with one entry per image to fix.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const CORRECTIONS = [
  {
    file: "intake-003-1b74df3818ae9e42.png",
    seq: 3,
    // Original: walnut treads, walnut newel+handrail, brushed-stainless risers, chrome balustrade
    // Reality:  reddish-brown mahogany treads (not chocolate-brown walnut)
    tread:    { material: "wood", sub: "mahogany" },
    newel:    { style: "square-minimal-capped", material: "wood", sub: "mahogany" },
    handrail: { material: "wood", sub: "mahogany" },
    string_R: { material: "wood", sub: "mahogany" },
    reason: "Visual audit: tread + newel + handrail tone is distinctly reddish (mahogany), not chocolate (walnut).",
  },
  {
    file: "intake-011-fd85b1526a180b12.png",
    seq: 11,
    // Original: full walnut treads+risers with white turned balusters
    // Reality:  dark reddish-brown mahogany throughout
    tread:    { material: "wood", sub: "mahogany" },
    riser:    { material: "wood", sub: "mahogany" },
    newel:    { style: "square-capped", material: "wood", sub: "mahogany" },
    handrail: { material: "wood", sub: "mahogany" },
    reason: "Visual audit: full-flight tone is dark reddish-brown (mahogany), not chocolate (walnut).",
  },
];

const MAN = join(process.cwd(), "data", "staircase-renovations", "manifest.json");
const OBS = join(process.cwd(), "data", "staircase-renovations", "intake", "observations.json");

const man = JSON.parse(await readFile(MAN, "utf8"));
const obs = JSON.parse(await readFile(OBS, "utf8"));

const NOW = new Date().toISOString();

// Species-based category resolution — mirrors ingest logic.
function targetCategoriesForTread(sub) {
  const t = String(sub || "").toLowerCase();
  const out = new Set();
  if (t.includes("oak"))      out.add("oak");
  if (t.includes("walnut"))   out.add("walnut");
  if (t.includes("mahogany")) out.add("walnut"); // no dedicated mahogany cat
  if (t.includes("maple"))    out.add("oak");    // no dedicated maple cat
  return [...out];
}

function materialsTagsForTread(sub) {
  const t = String(sub || "").toLowerCase();
  const tags = new Set();
  if (t === "oak" || t.includes("oak")) tags.add("oak");
  if (t === "walnut")   tags.add("walnut");
  if (t === "mahogany") { tags.add("mahogany"); tags.add("walnut"); }
  if (t === "maple")    tags.add("maple");
  return [...tags];
}

let touched = 0;
const catIndex = new Map(man.categories.map(c => [c.slug, c]));

for (const fix of CORRECTIONS) {
  // ---- update images_v3 entry ----
  const entry = man.images_v3.find(e => e.src.endsWith(fix.file));
  if (!entry) {
    console.warn(`skipped ${fix.file} — not found in manifest.images_v3`);
    continue;
  }
  const oldSub = entry.sub_material;

  // Header sub_material (representative tread species).
  entry.sub_material = fix.tread?.sub ?? entry.sub_material;
  entry.material     = fix.tread?.material ?? entry.material;

  // material_composition[] per-role overrides.
  const roleMap = {
    tread: fix.tread, riser: fix.riser,
    newel: fix.newel, handrail: fix.handrail,
    string_left: fix.string_L, string_right: fix.string_R,
  };
  for (const [role, patch] of Object.entries(roleMap)) {
    if (!patch) continue;
    let row = entry.material_composition?.find(c => c.component_role === role);
    if (!row) {
      row = { component_role: role, confidence: "observed" };
      entry.material_composition = entry.material_composition || [];
      entry.material_composition.push(row);
    }
    if (patch.material !== undefined) row.material = patch.material;
    if (patch.sub !== undefined)      row.sub_material = patch.sub;
    if (patch.style !== undefined)    row.style = patch.style;
  }

  // Alt text — regenerate to reflect new species.
  const treadDesc = `${entry.material_composition.find(c=>c.component_role==="tread")?.sub_material ?? ""} ${entry.material_composition.find(c=>c.component_role==="tread")?.material ?? ""} tread`.trim();
  const balDesc = (() => {
    const b = entry.material_composition.find(c=>c.component_role==="baluster");
    if (!b) return "balustrade";
    return `${b.style ?? ""} ${b.sub_material ?? ""} balustrade`.trim();
  })();
  entry.alt = `NEX Trade Center whole-staircase — ${treadDesc}, ${balDesc}, ${entry.distinctive ?? "reclassified per visual audit"}`;

  // Governance: record the correction.
  entry.governance = entry.governance || {};
  entry.governance.updated_at = NOW;
  entry.governance.corrections = entry.governance.corrections || [];
  entry.governance.corrections.push({
    at: NOW,
    from: { sub_material: oldSub },
    to:   { sub_material: entry.sub_material },
    reason: fix.reason,
  });

  // ---- update observations.json entry (source of truth) ----
  const obsEntry = obs.observations.find(o => o.seq === fix.seq);
  if (obsEntry) {
    if (fix.tread)    obsEntry.tread    = { ...obsEntry.tread,    ...fix.tread };
    if (fix.riser)    obsEntry.riser    = { ...obsEntry.riser,    ...fix.riser };
    if (fix.newel)    obsEntry.newel    = { ...obsEntry.newel,    ...fix.newel };
    if (fix.handrail) obsEntry.handrail = { ...obsEntry.handrail, ...fix.handrail };
    if (fix.string_L) obsEntry.string_L = { ...obsEntry.string_L, ...fix.string_L };
    if (fix.string_R) obsEntry.string_R = { ...obsEntry.string_R, ...fix.string_R };
    obsEntry.corrected_at = NOW;
    obsEntry.correction_reason = fix.reason;
  }

  // ---- refresh category attachments ----
  const newCats = new Set(targetCategoriesForTread(entry.sub_material));
  const newTags = materialsTagsForTread(entry.sub_material);

  for (const cat of man.categories) {
    const existingIdx = (cat.images || []).findIndex(i => i.src === entry.src);
    const shouldExist = newCats.has(cat.slug);
    if (shouldExist) {
      if (existingIdx >= 0) {
        cat.images[existingIdx].alt       = entry.alt;
        cat.images[existingIdx].materials = newTags.length ? newTags : undefined;
      } else {
        cat.images = cat.images || [];
        cat.images.push({
          src: entry.src,
          alt: entry.alt,
          sort: (cat.images.at(-1)?.sort ?? 0) + 1,
          materials: newTags.length ? newTags : undefined,
        });
      }
    } else if (existingIdx >= 0) {
      cat.images.splice(existingIdx, 1);
    }
  }

  touched++;
  console.log(`✓ ${fix.file}: ${oldSub} → ${entry.sub_material}`);
}

man.updated_at = NOW.slice(0, 10);
await writeFile(MAN, JSON.stringify(man, null, 2) + "\n", "utf8");
await writeFile(OBS, JSON.stringify(obs, null, 2) + "\n", "utf8");

console.log(`\n${touched}/${CORRECTIONS.length} corrections applied.`);
