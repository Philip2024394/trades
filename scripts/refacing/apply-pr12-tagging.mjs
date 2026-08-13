#!/usr/bin/env node
// scripts/refacing/apply-pr12-tagging.mjs
//
// Non-destructive PR-12 admin tagging pass on 20 heroes · per approved
// proposal (Philip 2026-08-12).
//
// - Updates only the 20 image_id entries listed below
// - Other 33 images_v3 entries · untouched
// - categories[] and step_units[] byte-preserved
// - Every field carries proper confidence markers (observed / inferred / unknown)
// - Never promotes inferred → observed
//
// Doctrinal authority: proposal approved verbatim · PR-16 truthfulness held.
//
// Usage:
//   node scripts/refacing/apply-pr12-tagging.mjs                (dry-run · reports what would change)
//   node scripts/refacing/apply-pr12-tagging.mjs --write         (actually writes)

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const MANIFEST_PATH = join(
  process.cwd(),
  "data",
  "staircase-renovations",
  "manifest.json"
);
const WRITE = process.argv.includes("--write");

// Compact helper — build a material_composition entry
const mc = (role, material, sub, confidence = "observed") => ({
  component_role: role,
  material,
  sub_material: sub,
  confidence,
});

// The 20 approved updates. Each entry: image_id → patch fields.
// Every canonical_profile_ids · style · mood carries `_confidence: observed`
// (I visually confirmed the compositional character); sub-materials that
// require species-confirmation stay `inferred`.
const UPDATES = {
  // #1
  "img_oak_oak-with-glass-balustrade": {
    canonical_profile_ids: ["modern_airy"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern", "minimal"],
    style_confidence: "observed",
    mood: ["airy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "glass", "clear", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_glass_light"],
  },
  // #2
  "img_white_white-fully-minimal": {
    canonical_profile_ids: ["modern_airy"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern", "minimal"],
    style_confidence: "observed",
    mood: ["airy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "painted", "white", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "painted", "white", "observed"),
      mc("handrail", "painted", "white", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_glass_light", "cg_modern_minimal_square"],
  },
  // #3
  "img_oak_oak-square-minimal-newel-with-runner": {
    canonical_profile_ids: ["modern_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern", "minimal"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_minimal_square"],
  },
  // #4
  "img_walnut_walnut-treads-square-minimal-newel-white-risers": {
    canonical_profile_ids: ["modern_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_modern_minimal_square", "cg_warm_walnut_family"],
  },
  // #5
  "img_walnut_walnut-full-with-square-minimal-balusters": {
    canonical_profile_ids: ["modern_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "wood", "walnut", "inferred"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_modern_minimal_square", "cg_warm_walnut_family"],
  },
  // #6
  "img_oak_oak-with-black-risers-metal-balusters": {
    canonical_profile_ids: ["modern_bold"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern", "industrial"],
    style_confidence: "observed",
    mood: ["bold", "dramatic"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "black", "inferred"),
      mc("baluster", "metal", "black-steel", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_metal_black_slim"],
  },
  // #7
  "img_oak_oak-with-wrought-iron-balusters": {
    canonical_profile_ids: ["modern_bold"],
    canonical_profile_ids_confidence: "observed",
    style: ["modern", "industrial"],
    style_confidence: "observed",
    mood: ["bold"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "metal", "wrought-iron", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_metal_black_slim"],
  },
  // #8
  "img_oak_oak-treads-with-herringbone-runner": {
    canonical_profile_ids: ["warm-natural_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["warm-natural", "traditional"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "wood", "oak", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
      mc("stringer", "wood", "oak", "inferred"),
    ],
    compatibility_group_ids: ["cg_classic_turned_white"],
  },
  // #9
  "img_walnut_walnut-full-with-herringbone-runner": {
    canonical_profile_ids: ["warm-natural_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["warm-natural", "classic"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "wood", "walnut", "inferred"),
      mc("baluster", "wood", "walnut", "inferred"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_warm_walnut_family", "cg_classic_turned_white"],
  },
  // #10
  "img_walnut_walnut-treads-and-risers-white-stairparts-01": {
    canonical_profile_ids: ["classic_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["classic", "warm-natural"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "wood", "walnut", "inferred"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "painted", "white", "observed"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_warm_walnut_family", "cg_classic_turned_white"],
  },
  // #11
  "img_oak_oak-turned-newel-with-herringbone-runner": {
    canonical_profile_ids: ["classic_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["classic", "traditional"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_classic_turned_white"],
  },
  // #12
  "img_oak_oak-treads-and-risers-full-flight": {
    canonical_profile_ids: ["classic_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["warm-natural", "classic"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "painted", "white", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_classic_turned_white"],
  },
  // #13
  "img_oak_oak-newel-and-handrail-on-white-body": {
    canonical_profile_ids: ["classic_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["classic", "minimal"],
    style_confidence: "observed",
    mood: ["airy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "painted", "white", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_glass_light", "cg_classic_turned_white"],
  },
  // #14
  "img_walnut_walnut-with-grey-carpet-runner": {
    canonical_profile_ids: ["classic_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["classic", "luxury"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "wood", "walnut", "inferred"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_warm_walnut_family", "cg_classic_turned_white"],
  },
  // #15
  "img_traditional_full-carpeted-staircase-with-oak-newel": {
    canonical_profile_ids: ["traditional_cosy"],
    canonical_profile_ids_confidence: "observed",
    style: ["traditional", "classic"],
    style_confidence: "observed",
    mood: ["cosy"],
    mood_confidence: "observed",
    material_composition: [
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_classic_turned_white"],
  },
  // #16
  "img_walnut_walnut-full-with-branch-metal-balusters": {
    canonical_profile_ids: ["signature_bold"],
    canonical_profile_ids_confidence: "observed",
    style: ["signature", "industrial"],
    style_confidence: "observed",
    mood: ["bold", "dramatic"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "walnut", "inferred"),
      mc("riser", "wood", "walnut", "inferred"),
      mc("baluster", "metal", "black-steel", "observed"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_modern_metal_black_slim", "cg_warm_walnut_family"],
  },
  // #17
  "img_oak_mahogany-treads-with-oak-newel-and-handrail": {
    canonical_profile_ids: ["signature_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["signature", "warm-natural"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "mahogany", "inferred"),
      mc("riser", "wood", "mahogany", "inferred"),
      mc("baluster", "wood", "oak", "observed"),
      mc("newel", "wood", "oak", "observed"),
      mc("handrail", "wood", "oak", "observed"),
      mc("stringer", "wood", "oak", "observed"),
    ],
    compatibility_group_ids: ["cg_signature_two_tone"],
  },
  // #18
  "img_oak_oak-treads-with-walnut-newel-and-handrail": {
    canonical_profile_ids: ["signature_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["signature", "warm-natural"],
    style_confidence: "observed",
    mood: ["restrained"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "wood", "oak", "observed"),
      mc("riser", "wood", "oak", "observed"),
      mc("baluster", "wood", "walnut", "inferred"),
      mc("newel", "wood", "walnut", "inferred"),
      mc("handrail", "wood", "walnut", "inferred"),
    ],
    compatibility_group_ids: ["cg_signature_two_tone", "cg_warm_walnut_family"],
  },
  // #19
  "img_white_white-with-walnut-newel-caps": {
    canonical_profile_ids: ["classic_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["classic", "minimal"],
    style_confidence: "observed",
    mood: ["airy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "painted", "white", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "painted", "white", "observed"),
      mc("handrail", "painted", "white", "observed"),
    ],
    compatibility_group_ids: ["cg_modern_glass_light", "cg_classic_turned_white"],
  },
  // #20
  "img_white_white-painted-staircase": {
    canonical_profile_ids: ["classic_restrained"],
    canonical_profile_ids_confidence: "observed",
    style: ["traditional", "classic"],
    style_confidence: "observed",
    mood: ["airy"],
    mood_confidence: "observed",
    material_composition: [
      mc("tread", "painted", "white", "observed"),
      mc("riser", "painted", "white", "observed"),
      mc("baluster", "painted", "white", "observed"),
      mc("newel", "painted", "white", "observed"),
      mc("handrail", "painted", "white", "observed"),
    ],
    compatibility_group_ids: ["cg_classic_turned_white"],
  },
};

async function main() {
  const raw = await readFile(MANIFEST_PATH, "utf8");
  const manifest = JSON.parse(raw);
  const entries = manifest.images_v3;
  if (!Array.isArray(entries)) {
    console.error("images_v3[] not found in manifest · did you run migrate-manifest-to-v3.mjs first?");
    process.exit(1);
  }

  let updated = 0;
  let missing = 0;
  for (const [imageId, patch] of Object.entries(UPDATES)) {
    const idx = entries.findIndex((e) => e.image_id === imageId);
    if (idx === -1) {
      console.warn(`  ⚠  ${imageId} · NOT FOUND in images_v3[] · skipping`);
      missing++;
      continue;
    }
    const before = entries[idx];
    entries[idx] = { ...before, ...patch };
    updated++;
  }

  console.log("── PR-12 tagging report ──");
  console.log(`  target entries:      ${Object.keys(UPDATES).length}`);
  console.log(`  updated:             ${updated}`);
  console.log(`  missing (skipped):   ${missing}`);
  console.log(`  other entries:       ${entries.length - Object.keys(UPDATES).length} (untouched)`);

  if (!WRITE) {
    console.log("");
    console.log("Dry-run · no changes written. Run with --write to persist.");
    return;
  }

  manifest.images_v3 = entries;
  manifest.updated_at = new Date().toISOString().slice(0, 10);
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log("");
  console.log("Wrote PR-12 tags. categories[] + step_units[] preserved.");
}

main().catch((err) => {
  console.error("TAGGING FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
