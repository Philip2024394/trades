#!/usr/bin/env node
// Seed the Staircase Object Library + Premium Trade Banner Pattern.
//
// - Registers 7 staircase construction archetypes as ObjectDNA (via learn()).
// - Registers PREMIUM_TRADE_BANNER_V1 · reinforces it with the 4 loft ladder
//   banners as evidence · shows how patterns compound over repeated exposure.
//
// Doctrine: docs/brains/nex-visual-pattern-library-and-design-genome-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const { learn } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "visual-learning", "index.ts")).href);
const { count: objectCount, clear: clearObjects, all: allObjects } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "object-library", "index.ts")).href);
const { seedPremiumTradeBanner, reinforce: reinforcePattern, get: getPattern, count: patternCount, clear: clearPatterns } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "pattern-library", "index.ts")).href);
const { clear: clearPatternLearning } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "pattern-learning", "index.ts")).href);

clearObjects();
clearPatterns();
clearPatternLearning();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const staircaseSpecimens = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.subject_domain === "staircase" && ["training_specimen", "canonical_reference", "joint_detail_reference"].includes(v?.staircase_context))
  .map(([url, meta]) => ({ url, ...meta }));
const loftLadderBanners = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.campaign_family === "loft_ladder_collection")
  .map(([url, meta]) => ({ url, ...meta }));

console.log(`Staircase training specimens: ${staircaseSpecimens.length}`);
console.log(`Loft ladder banner evidence: ${loftLadderBanners.length}`);

// ─── Register the 7 staircase archetypes into Object Library ───────────

function candidatesForStaircase(sp) {
  const styleClass = (sp.style_class ?? "unknown").split("_")[0]; // "victorian_heritage" → "victorian"
  const shapes = {
    "closed_string": { primary_shape: "rectangle", edge_treatment: "sharp", proportions: "large", style_class: styleClass },
    "double_housed_string": { primary_shape: "rectangle", edge_treatment: "sharp", proportions: "large", style_class: styleClass },
    "mono_string": { primary_shape: "prism", edge_treatment: "sharp", proportions: "large", style_class: styleClass },
    "closed_box_fascia_string": { primary_shape: "rectangle", edge_treatment: "sharp", proportions: "large", style_class: styleClass },
  };
  const shape = shapes[sp.construction_type] ?? shapes["closed_string"];
  const material_map = { "walnut": "european_walnut_matt_lacquer", "walnut_tread_white_baluster": "european_walnut_matt_lacquer", "hardwood_dark_stained": "european_walnut_matt_lacquer", "steel_spine_walnut_tread": "steel_black_powder_coated" };
  const material_id = material_map[sp.primary_material] ?? undefined;
  return [{
    candidate_family: "OTHER",
    shape,
    material_id,
    dimensions: { length_mm: 3600, width_mm: 900, height_mm: 2600, thickness_mm: 45 },
    style: styleClass,
    observed_confidence: sp.confidence ?? 0.95,
    evidence_asset_id: sp.url,
    suggested_display_name: `Staircase Archetype · ${sp.construction_type} · ${sp.riser_type} riser · ${sp.style_class}`,
  }];
}

function styleSignals(sp) {
  return [
    { feature: "construction_type", value: sp.construction_type },
    { feature: "riser_type", value: sp.riser_type },
    { feature: "style_class", value: sp.style_class },
    { feature: "primary_material", value: sp.primary_material },
  ];
}

const stairReports = [];
for (const sp of staircaseSpecimens) {
  const report = learn({
    extraction_id: `vkep_staircase_${sp.construction_type}_${sp.riser_type}`,
    project_id: "staircase_object_library",
    candidates: candidatesForStaircase(sp),
    style_signals: styleSignals(sp),
  });
  stairReports.push({ construction_type: sp.construction_type, ...report });
}

// ─── Register PREMIUM_TRADE_BANNER_V1 + reinforce with 4 loft ladder banners ─

const trade = seedPremiumTradeBanner();
for (const b of loftLadderBanners) {
  reinforcePattern(trade.pattern_id, 0.005, "vlp_seed", b.url);
}
const patternAfter = getPattern(trade.pattern_id);

// ─── Summary ───────────────────────────────────────────────────────────

const newObjs = stairReports.reduce((s, r) => s + r.new_objects_registered.length, 0);
const updates = stairReports.reduce((s, r) => s + r.existing_objects_updated.length, 0);
const styleSigs = stairReports.reduce((s, r) => s + r.style_signals_learned.length, 0);

console.log("");
console.log("Visual Learning · Object Library seed summary");
console.log("---------------------------------------------");
console.log(`staircase specimens processed  · ${staircaseSpecimens.length}`);
console.log(`new objects registered         · ${newObjs}`);
console.log(`existing objects updated       · ${updates}`);
console.log(`style signals learned          · ${styleSigs}`);
console.log(`Object Library size (in-memory · demo run) · ${objectCount()}`);
console.log("");
console.log("Pattern Library seed summary");
console.log("-----------------------------");
console.log(`patterns registered            · ${patternCount()}`);
console.log(`PREMIUM_TRADE_BANNER_V1 confidence after ${loftLadderBanners.length} reinforcements · ${patternAfter?.aggregate_confidence.toFixed(3)}`);
console.log(`PREMIUM_TRADE_BANNER_V1 observation_count · ${patternAfter?.observation_count}`);
console.log(`PREMIUM_TRADE_BANNER_V1 evidence size · ${patternAfter?.banner_example_asset_ids.length}`);

const now = new Date().toISOString();
const rows = [
  ...stairReports.map((r) => ({ at: now, kind: "vlp_staircase_seed", construction_type: r.construction_type, new_objects: r.new_objects_registered.length, updates: r.existing_objects_updated.length, style_signals: r.style_signals_learned.length, learner: r.learner_version })),
  { at: now, kind: "pattern_library_seed", pattern_id: patternAfter?.pattern_id, evidence_count: patternAfter?.banner_example_asset_ids.length, observation_count: patternAfter?.observation_count, aggregate_confidence: patternAfter?.aggregate_confidence },
];
fs.appendFileSync(LEARNING_LOG, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nAppended ${rows.length} rows to ${path.relative(ROOT, LEARNING_LOG)}`);
