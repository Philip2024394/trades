#!/usr/bin/env node
// Register the 8 new component ObjectDNA entries + run validateCombination on
// three real proof compositions · shows the 8th library gating designs before
// render/manufacturing.
//
// Doctrine: docs/brains/nex-construction-rules-library-eighth-genome-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const { register, count: objectCount, clear: clearObjects, get } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "object-library", "index.ts")).href);
const { validateCombination, count: ruleCount } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "construction-rules", "index.ts")).href);

clearObjects();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const PHILIP = "Philip O'Farrell";
const NOW = new Date().toISOString();

function evidenceFor(componentFamily) {
  return Object.entries(manifest.images ?? {})
    .filter(([, v]) => v?.component_family === componentFamily)
    .map(([url]) => url);
}

function componentObject(id, family, kind, display, extraSubcomponents = []) {
  return register({
    object_id: id,
    family,
    display_name: display,
    shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "small", style_class: "traditional" },
    material_id: "oak_american_white_satin_lacquer",
    dimensions: {},
    style: "traditional",
    compatible_objects: [],
    construction_rules: [],
    image_example_asset_ids: evidenceFor(id),
    supplier_links: [{ name: "UK Joinery Distributors", region: "UK" }],
    history: [{ version: 1, captured_at: NOW, changes: ["seed"], changed_by: "philip", confidence: 1.0 }],
    aggregate_confidence: 1.0,
    observation_count: 1,
    subcomponents: [
      { slot: "component_kind", value: kind },
      { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
      { slot: "finish", value: "satin_lacquer" },
      ...extraSubcomponents,
    ],
    provenance: { named_expert: PHILIP, authored: "2026-08-04" },
    created_at: NOW,
    updated_at: NOW,
  });
}

componentObject("HANDRAIL_VOLUTE_TRADITIONAL_V1", "STAIR_HANDRAIL", "handrail_fitting", "Handrail Volute · traditional oak starter (V1)", [
  { slot: "fitting_kind", value: "volute" },
  { slot: "handrail_start", value: "volute" },
  { slot: "requires", value: "curtail_step_or_bullnose" },
  { slot: "requires_newel", value: "volute_turned" },
]);
componentObject("NEWEL_CAP_PYRAMID_V1", "STAIR_NEWEL", "newel_cap", "Newel Cap · pyramid (V1)", [
  { slot: "cap_style", value: "pyramid" },
  { slot: "requires_newel", value: "raised_panel_box" },
]);
componentObject("NEWEL_FINIAL_ACORN_V1", "STAIR_NEWEL", "newel_finial", "Newel Finial · turned acorn (V1)", [
  { slot: "finial_style", value: "acorn" },
  { slot: "style_signal", value: "traditional_heritage" },
]);
componentObject("NEWEL_FINIAL_BALL_V1", "STAIR_NEWEL", "newel_finial", "Newel Finial · turned ball (V1)", [
  { slot: "finial_style", value: "ball" },
  { slot: "style_signal", value: "traditional_heritage" },
]);
componentObject("NEWEL_CAP_FLAT_SQUARE_V1", "STAIR_NEWEL", "newel_cap", "Newel Cap · flat square (V1)", [
  { slot: "cap_style", value: "flat_square" },
  { slot: "style_signal", value: "shaker_modern_traditional" },
]);
componentObject("HANDRAIL_FITTING_GOOSENECK_RETURN_V1", "STAIR_HANDRAIL", "handrail_fitting", "Handrail Fitting · gooseneck return (V1)", [
  { slot: "fitting_kind", value: "gooseneck" },
  { slot: "requires", value: "half_landing" },
]);
componentObject("NEWEL_CANONICAL_HERO_V1", "STAIR_NEWEL", "newel_hero", "Newel + handrail joinery · canonical hero (V1)", [
  { slot: "cap_style", value: "pyramid" },
  { slot: "handrail_profile", value: "pigs_ear" },
  { slot: "gold_standard", value: "true" },
]);

// ─── Proof · run validateCombination on 3 test compositions ────────────

const validCombo = [
  { slot: "flight_type", value: "straight" },
  { slot: "structural_system", value: "closed_string" },
  { slot: "entrance_system", value: "single_bullnose" },
  { slot: "starting_step_shape", value: "bullnose_curved_front" },
  { slot: "riser_type", value: "closed" },
  { slot: "balustrade_system", value: "turned_baluster" },
  { slot: "newel_family", value: "raised_panel_box" },
  { slot: "newel_cap", value: "pyramid" },
  { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
  { slot: "balustrade_component", value: "fillets" },
];

const invalidCombo = [
  { slot: "handrail_termination", value: "scroll_volute" },
  { slot: "newel_family", value: "raised_panel_box" },
  { slot: "balustrade_system", value: "glass" },
  { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
];

const externalCombo = [
  { slot: "structural_system", value: "steel_switchback" },
  { slot: "environment", value: "exterior" },
  { slot: "finish", value: "hot_dip_galvanized" },
  { slot: "riser_type", value: "open" },
  { slot: "location", value: "commercial" },
  { slot: "has_guardrail", value: "true" },
  { slot: "guardrail_height_mm", value: "at_least_1100" },
];

const validReport = validateCombination(validCombo, { domain: "staircase" });
const invalidReport = validateCombination(invalidCombo, { domain: "staircase" });
const externalReport = validateCombination(externalCombo, { domain: "staircase" });

console.log("Construction Rules Library · 8th Design Genome library");
console.log("-------------------------------------------------------");
console.log(`Seed rules · ${ruleCount()}`);
console.log(`Object Library components registered · ${objectCount()}`);
console.log("");
console.log("Proof · valid canonical staircase:");
console.log(`  overall = ${validReport.overall} · passes ${validReport.passes} · required_failures ${validReport.required_failures}`);
console.log("");
console.log("Proof · glass balusters + grooved handrail + volute without volute newel:");
console.log(`  overall = ${invalidReport.overall} · required_failures ${invalidReport.required_failures} · warns ${invalidReport.warns}`);
for (const f of invalidReport.firings.filter((x) => x.status === "violated")) {
  console.log(`   ✗ ${f.rule_id} · ${f.severity}`);
  console.log(`       reason: ${f.reason.slice(0, 80)}${f.reason.length > 80 ? "…" : ""}`);
  if (f.suggested_fix) console.log(`       fix: ${f.suggested_fix.slice(0, 80)}${f.suggested_fix.length > 80 ? "…" : ""}`);
}
console.log("");
console.log("Proof · external steel switchback with galvanized finish + commercial guardrail:");
console.log(`  overall = ${externalReport.overall} · passes ${externalReport.passes} · warns ${externalReport.warns}`);

const row = { at: NOW, kind: "construction_rules_seed", seed_rules: ruleCount(), components_registered: objectCount(), valid_combo: validReport.overall, invalid_combo: invalidReport.overall, invalid_failures: invalidReport.required_failures, external_combo: externalReport.overall };
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
