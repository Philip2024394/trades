#!/usr/bin/env node
// Seed the Loft Ladder Marketing Collection into the Object Library + VLP.
//
// Reads the 4 loft ladder banners from data/nex-image-manifest.json · fabricates
// a synthetic VisionAnalysis per banner using the authored metadata · feeds
// each analysis into learn() · records the resulting LearningReport counts.
//
// Doctrine: docs/brains/nex-loft-ladder-marketing-collection-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

// Lazy-import ES modules from the compiled TypeScript runtime via vite-node
// (we run via `npx vite-node`).
const { learn } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "visual-learning", "index.ts")).href);
const { register, count: objectCount, clear: clearObjects } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "object-library", "index.ts")).href);
const { clear: clearPatterns } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "pattern-learning", "index.ts")).href);

// Fresh library for the demo run (safe · in-memory only).
clearObjects();
clearPatterns();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const banners = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v && v.subject_domain === "marketing_banner" && v.campaign_family === "loft_ladder_collection")
  .map(([url, meta]) => ({ url, ...meta }));

console.log(`Found ${banners.length} loft ladder banners in the manifest.`);
for (const b of banners) console.log(`  - ${b.banner_id} · ${b.theme_pack} · ${b.hero_product_type}`);

// Fabricate LearningInput objects derived from the authored banner metadata.
// In the future the Vision Intelligence Platform will produce these directly.
function candidatesFor(banner) {
  const shape_ladder = { primary_shape: "prism", edge_treatment: "sharp", proportions: "large", style_class: banner.brand_personality === "premium" ? "traditional" : banner.brand_personality === "industrial_professional" ? "industrial" : banner.brand_personality === "family" ? "family" : "modern" };
  const shape_hatch = { primary_shape: "rectangle", edge_treatment: "sharp", proportions: "medium", style_class: "modern" };
  const shape_handrail = { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "small", style_class: shape_ladder.style_class };
  const material_ladder = banner.hero_product_type === "timber_folding_loft_ladder" ? "oak_american_white_satin_lacquer"
    : banner.hero_product_type === "heavy_duty_steel_loft_ladder" ? "steel_black_powder_coated"
    : banner.hero_product_type === "aluminium_loft_ladder" ? "aluminium_anodised"
    : undefined;
  return [
    { candidate_family: "OTHER", shape: shape_ladder, material_id: material_ladder, dimensions: { length_mm: 2600, width_mm: 500, thickness_mm: 20 }, style: banner.brand_personality, observed_confidence: 0.9, evidence_asset_id: banner.url, suggested_display_name: `Loft Ladder · ${banner.theme_pack} · ${banner.hero_product_type}` },
    { candidate_family: "OTHER", shape: shape_hatch, material_id: "paint_matt_emulsion_white", dimensions: { length_mm: 700, width_mm: 700, thickness_mm: 40 }, style: "modern", observed_confidence: 0.85, evidence_asset_id: banner.url, suggested_display_name: `Loft Hatch · white insulated` },
    { candidate_family: "OTHER", shape: shape_handrail, material_id: "steel_black_powder_coated", dimensions: { length_mm: 900, diameter_mm: 25 }, style: banner.brand_personality, observed_confidence: 0.8, evidence_asset_id: banner.url, suggested_display_name: `Ladder Handrail · steel` },
  ];
}

function styleSignals(banner) {
  return [
    { feature: "theme_pack", value: banner.theme_pack },
    { feature: "audience", value: banner.audience ?? "unspecified" },
    { feature: "personality", value: banner.brand_personality },
    { feature: "marketing_tone", value: banner.marketing_tone },
    { feature: "hero_product_type", value: banner.hero_product_type },
    { feature: "layout_family", value: banner.layout_family },
    { feature: "cta_architecture", value: banner.cta_architecture },
  ];
}

const reports = [];
for (const b of banners) {
  const report = learn({
    extraction_id: `vkep_seed_${b.banner_id}`,
    project_id: "loft_ladder_collection",
    candidates: candidatesFor(b),
    style_signals: styleSignals(b),
  });
  reports.push({ banner_id: b.banner_id, ...report });
}

const totalNew = reports.reduce((s, r) => s + r.new_objects_registered.length, 0);
const totalUpdates = reports.reduce((s, r) => s + r.existing_objects_updated.length, 0);
const totalMerges = reports.reduce((s, r) => s + r.duplicates_merged.length, 0);
const totalBumps = reports.reduce((s, r) => s + r.confidence_improvements.length, 0);
const totalSignals = reports.reduce((s, r) => s + r.style_signals_learned.length, 0);

console.log("");
console.log("Visual Learning Platform · seed run summary");
console.log("--------------------------------------------");
console.log(`banners processed         · ${banners.length}`);
console.log(`new objects registered    · ${totalNew}`);
console.log(`existing objects updated  · ${totalUpdates}`);
console.log(`duplicates merged         · ${totalMerges}`);
console.log(`confidence improvements   · ${totalBumps}`);
console.log(`style signals learned     · ${totalSignals}`);
console.log(`Object Library size (in-memory · demo run) · ${objectCount()}`);

// Append summary rows to the learning log so the knowledge dashboard picks them up.
const now = new Date().toISOString();
const lines = reports.flatMap((r) => [
  { at: now, kind: "vlp_seed", banner_id: r.banner_id, new_objects: r.new_objects_registered.length, updates: r.existing_objects_updated.length, style_signals: r.style_signals_learned.length, learner: r.learner_version },
]);
fs.appendFileSync(LEARNING_LOG, lines.map((l) => JSON.stringify(l)).join("\n") + "\n");
console.log(`\nAppended ${lines.length} rows to ${path.relative(ROOT, LEARNING_LOG)}`);
