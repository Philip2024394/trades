#!/usr/bin/env node
// Register hierarchical ObjectDNA entries for the 4 handrail/baserail families
// + the external fire escape · seeds subcomponent trees.
//
// Doctrine: docs/brains/nex-object-dna-subcomponent-hierarchy-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const { register, count: objectCount, get, hasSubcomponent, flattenSubcomponents, clear: clearObjects } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "object-library", "index.ts")).href);

clearObjects();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const PHILIP = "Philip O'Farrell";
const NOW = new Date().toISOString();

function evidenceFor(componentFamily) {
  return Object.entries(manifest.images ?? {})
    .filter(([, v]) => v?.component_family === componentFamily)
    .map(([url]) => url);
}

function stairSpecimensEvidence(filter) {
  return Object.entries(manifest.images ?? {})
    .filter(([, v]) => v?.subject_domain === "staircase" && filter(v))
    .map(([url]) => url);
}

register({
  object_id: "HANDRAIL_TRADITIONAL_PLOUGHED_V1",
  family: "STAIR_HANDRAIL",
  display_name: "Handrail · traditional moulded with ploughed groove (V1)",
  shape: { primary_shape: "rectangle", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" },
  material_id: "oak_american_white_satin_lacquer",
  dimensions: { length_mm: 3600, width_mm: 58, thickness_mm: 58 },
  style: "traditional_moulded",
  compatible_objects: ["BASERAIL_TRADITIONAL_MOULDED_V1"],
  construction_rules: [{ rule: "Handrail top 900-1000mm above pitch line", citation: "Building Regs Part K", severity: "required" }],
  image_example_asset_ids: evidenceFor("HANDRAIL_TRADITIONAL_PLOUGHED_V1"),
  supplier_links: [{ name: "UK Joinery Distributors", region: "UK" }],
  history: [{ version: 1, captured_at: NOW, changes: ["seed · Philip authored"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  variants: [
    { variant_id: "v_54", label: "54mm × 54mm domestic", cost_gbp: 32 },
    { variant_id: "v_58", label: "58mm × 58mm premium", cost_gbp: 42 },
    { variant_id: "v_63", label: "63mm × 63mm feature", cost_gbp: 55 },
    { variant_id: "v_70", label: "70mm+ commercial/bespoke", cost_gbp: 80 },
  ],
  subcomponents: [
    { slot: "component_kind", value: "handrail" },
    { slot: "profile", value: "traditional_moulded" },
    { slot: "underside", value: "ploughed_groove" },
    { slot: "accepts", value: "balusters_and_fillets" },
    { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
    { slot: "finish", value: "satin_lacquer" },
  ],
  tags: ["handrail", "traditional", "ploughed", "oak"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

register({
  object_id: "HANDRAIL_TRADITIONAL_SOLID_V1",
  family: "STAIR_HANDRAIL",
  display_name: "Handrail · solid traditional blank (V1) · wall-mount / CNC-machinable",
  shape: { primary_shape: "rectangle", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" },
  material_id: "oak_american_white_satin_lacquer",
  dimensions: { length_mm: 3600, width_mm: 58, thickness_mm: 58 },
  style: "traditional_solid",
  compatible_objects: [],
  construction_rules: [{ rule: "Handrail top 900-1000mm above pitch line when installed on a staircase", citation: "Building Regs Part K", severity: "required" }],
  image_example_asset_ids: evidenceFor("HANDRAIL_TRADITIONAL_SOLID_V1"),
  supplier_links: [{ name: "UK Joinery Distributors", region: "UK" }],
  history: [{ version: 1, captured_at: NOW, changes: ["seed · distinct from ploughed"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  variants: [
    { variant_id: "v_54", label: "54mm × 54mm wall rail", cost_gbp: 24 },
    { variant_id: "v_58", label: "58mm × 58mm premium blank", cost_gbp: 32 },
    { variant_id: "v_63", label: "63mm × 63mm feature blank", cost_gbp: 44 },
    { variant_id: "v_70", label: "70mm+ commercial blank", cost_gbp: 60 },
  ],
  subcomponents: [
    { slot: "component_kind", value: "handrail" },
    { slot: "profile", value: "traditional_moulded" },
    { slot: "underside", value: "solid_ungrooved" },
    { slot: "manufacturing_state", value: "blank" },
    { slot: "primary_use", value: "wall_mounted_or_cnc_machining" },
    { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
    { slot: "finish", value: "satin_lacquer" },
  ],
  tags: ["handrail", "traditional", "solid", "blank", "wall_mounted", "cnc_ready", "oak"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

register({
  object_id: "BASERAIL_TRADITIONAL_MOULDED_V1",
  family: "STAIR_HANDRAIL",
  display_name: "Base Rail · traditional moulded (V1)",
  shape: { primary_shape: "rectangle", edge_treatment: "moulded", proportions: "small", style_class: "traditional" },
  material_id: "oak_american_white_satin_lacquer",
  dimensions: { length_mm: 3600, width_mm: 58, thickness_mm: 32 },
  style: "traditional_moulded",
  compatible_objects: ["HANDRAIL_TRADITIONAL_PLOUGHED_V1"],
  construction_rules: [],
  image_example_asset_ids: evidenceFor("BASERAIL_TRADITIONAL_MOULDED_V1"),
  supplier_links: [{ name: "UK Joinery Distributors", region: "UK" }],
  history: [{ version: 1, captured_at: NOW, changes: ["seed · distinct component family"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  variants: [
    { variant_id: "v_41", label: "41mm × 32mm base rail", cost_gbp: 18 },
    { variant_id: "v_58", label: "58mm × 32mm base rail", cost_gbp: 22 },
    { variant_id: "v_63", label: "63mm × 32mm base rail", cost_gbp: 26 },
  ],
  subcomponents: [
    { slot: "component_kind", value: "base_rail" },
    { slot: "profile", value: "traditional_moulded" },
    { slot: "purpose", value: "holds_balusters_at_bottom" },
    { slot: "sits_on", value: "closed_string_or_landing_floor" },
    { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
    { slot: "finish", value: "satin_lacquer" },
  ],
  tags: ["base_rail", "bottom_rail", "traditional", "moulded", "oak"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

register({
  object_id: "STAIRCASE_STRAIGHT_BULLNOSE_CLOSED_STRING_CANONICAL_V1",
  family: "OTHER",
  display_name: "Canonical Straight Bullnose Closed-String Double-Newel Staircase (V1)",
  shape: { primary_shape: "rectangle", edge_treatment: "rounded", proportions: "large", style_class: "traditional" },
  material_id: "oak_american_white_satin_lacquer",
  dimensions: { length_mm: 3600, width_mm: 900, height_mm: 2600, thickness_mm: 45 },
  style: "premium_uk_residential",
  compatible_objects: ["HANDRAIL_TRADITIONAL_PLOUGHED_V1", "BASERAIL_TRADITIONAL_MOULDED_V1"],
  construction_rules: [
    { rule: "Riser 190mm typical · Part K max 220mm", citation: "Building Regs Part K", severity: "required" },
    { rule: "Going 250mm typical · Part K min 220mm", citation: "Building Regs Part K", severity: "required" },
    { rule: "Handrail 900-1000mm above pitch line", citation: "Building Regs Part K", severity: "required" },
  ],
  image_example_asset_ids: stairSpecimensEvidence((v) => v.entrance_system?.includes("bullnose") && v.construction_type === "closed_string" && v.staircase_context === "canonical_reference"),
  history: [{ version: 1, captured_at: NOW, changes: ["seed · canonical"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  subcomponents: [
    { slot: "flight_type", value: "straight" },
    { slot: "structural_system", value: "closed_string" },
    { slot: "entrance_system", value: "single_bullnose", children: [
      { slot: "starting_step_shape", value: "bullnose_curved_front" },
      { slot: "return", value: "bullnose_return_fascia" },
    ]},
    { slot: "balustrade_system", value: "turned_baluster" },
    { slot: "newel_family", value: "raised_panel_box", children: [
      { slot: "newel_count", value: "double_bottom_double_top" },
    ]},
    { slot: "riser_type", value: "closed" },
    { slot: "joinery", value: "housed_treads", children: [
      { slot: "joinery_technique", value: "mortise_and_tenon" },
      { slot: "joinery_technique", value: "wedged_treads" },
    ]},
    { slot: "handrail_profile", value: "traditional_moulded_ploughed", object_ref: "HANDRAIL_TRADITIONAL_PLOUGHED_V1" },
    { slot: "base_rail_profile", value: "traditional_moulded", object_ref: "BASERAIL_TRADITIONAL_MOULDED_V1" },
    { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
    { slot: "finish", value: "satin_lacquer" },
  ],
  tags: ["staircase", "straight", "bullnose", "closed_string", "double_newel", "premium_uk_residential", "canonical"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

register({
  object_id: "STAIRCASE_EXTERNAL_FIRE_ESCAPE_SWITCHBACK_V1",
  family: "OTHER",
  display_name: "External Fire Escape Stair Tower · switchback · galvanized steel (V1)",
  shape: { primary_shape: "prism", edge_treatment: "sharp", proportions: "large", style_class: "industrial" },
  material_id: "steel_black_powder_coated",
  dimensions: { length_mm: 3000, width_mm: 1200, height_mm: 9000, thickness_mm: 8 },
  style: "industrial_commercial",
  compatible_objects: [],
  construction_rules: [
    { rule: "Guardrail 1100mm on exterior commercial", citation: "Building Regs Approved Doc K commercial", severity: "required" },
    { rule: "Baluster sphere rule 100mm", citation: "Building Regs Approved Doc K", severity: "required" },
    { rule: "Slip-resistant treads on external stairs", citation: "BS 5395", severity: "required" },
  ],
  image_example_asset_ids: stairSpecimensEvidence((v) => v.construction_type === "steel_switchback"),
  history: [{ version: 1, captured_at: NOW, changes: ["seed · external steel switchback"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  subcomponents: [
    { slot: "flight_type", value: "switchback_three_flight" },
    { slot: "landings", value: "four" },
    { slot: "structural_system", value: "steel_switchback_columns" },
    { slot: "columns", value: "bolted_base_plates" },
    { slot: "stringers", value: "structural_steel" },
    { slot: "treads", value: "open_riser_steel_grating" },
    { slot: "risers", value: "open" },
    { slot: "landings_type", value: "steel_deck_grating" },
    { slot: "guardrails", value: "full_height_steel_tube" },
    { slot: "handrails", value: "continuous_steel_tube" },
    { slot: "balusters", value: "vertical_steel_infill_bars" },
    { slot: "bracing", value: "diagonal_cross_bracing" },
    { slot: "material", value: "hot_dip_galvanized_steel", object_ref: "steel_black_powder_coated" },
    { slot: "finish", value: "hot_dip_galvanized" },
    { slot: "environment", value: "exterior" },
    { slot: "use", value: "emergency_egress_industrial_commercial" },
  ],
  tags: ["staircase", "external", "fire_escape", "steel", "switchback", "industrial", "commercial", "galvanized"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

register({
  object_id: "STAIRCASE_GRAND_DOUBLE_RETURN_VOLUTE_V1",
  family: "OTHER",
  display_name: "Grand Traditional Double-Return Staircase with Volute Handrail (V1)",
  shape: { primary_shape: "rectangle", edge_treatment: "rounded", proportions: "large", style_class: "victorian" },
  material_id: "european_walnut_matt_lacquer",
  dimensions: { length_mm: 4200, width_mm: 1500, height_mm: 2800, thickness_mm: 50 },
  style: "victorian_grand",
  compatible_objects: [],
  construction_rules: [],
  image_example_asset_ids: stairSpecimensEvidence((v) => v.style_class?.includes("grand") || v.style_class?.includes("victorian_grand")),
  history: [{ version: 1, captured_at: NOW, changes: ["seed · grand double-return"], changed_by: "philip", confidence: 1.0 }],
  aggregate_confidence: 1.0,
  observation_count: 1,
  subcomponents: [
    { slot: "flight_type", value: "straight_centre_flight_double_return" },
    { slot: "structural_system", value: "closed_string" },
    { slot: "entrance_system", value: "wide_bullnose_starting_step" },
    { slot: "newel_family", value: "turned_victorian", children: [
      { slot: "starting_newels", value: "large_decorative_turned" },
      { slot: "intermediate_newels", value: "smaller_turned" },
    ]},
    { slot: "balustrade_system", value: "turned_baluster" },
    { slot: "handrail_termination", value: "scroll_volute" },
    { slot: "riser_type", value: "closed" },
    { slot: "joinery", value: "closed_housed_strings", children: [
      { slot: "joinery_technique", value: "wedged_treads" },
      { slot: "joinery_technique", value: "glue_blocks" },
      { slot: "joinery_technique", value: "mortise_and_tenon_newels" },
      { slot: "joinery_technique", value: "handrail_scarf_joints" },
      { slot: "joinery_technique", value: "laminated_or_steam_bent_curved_handrail" },
    ]},
    { slot: "material", value: "walnut", object_ref: "european_walnut_matt_lacquer" },
    { slot: "finish", value: "satin_lacquer" },
  ],
  tags: ["staircase", "grand", "double_return", "volute", "victorian", "heritage", "hardwood"],
  provenance: { named_expert: PHILIP, authored: "2026-08-04" },
  created_at: NOW,
  updated_at: NOW,
});

console.log("Object Library subcomponent seed");
console.log("--------------------------------");
console.log(`Objects registered · ${objectCount()}`);
console.log("");
console.log("Canonical staircase subcomponents:");
const canonical = get("STAIRCASE_STRAIGHT_BULLNOSE_CLOSED_STRING_CANONICAL_V1");
if (canonical) {
  const flat = flattenSubcomponents(canonical);
  Object.entries(flat).forEach(([slot, value]) => console.log(`  ${slot} = ${value}`));
  console.log(`  hasSubcomponent(flight_type, straight) · ${hasSubcomponent(canonical, "flight_type", "straight")}`);
  console.log(`  hasSubcomponent(entrance_system, single_bullnose) · ${hasSubcomponent(canonical, "entrance_system", "single_bullnose")}`);
}
console.log("");
console.log("Handrail families are DISTINCT:");
console.log(`  HANDRAIL_TRADITIONAL_PLOUGHED_V1 · underside = ${flattenSubcomponents(get("HANDRAIL_TRADITIONAL_PLOUGHED_V1"))["underside"]}`);
console.log(`  HANDRAIL_TRADITIONAL_SOLID_V1    · underside = ${flattenSubcomponents(get("HANDRAIL_TRADITIONAL_SOLID_V1"))["underside"]}`);
console.log("");
console.log("Fire escape stair tower:");
const fire = get("STAIRCASE_EXTERNAL_FIRE_ESCAPE_SWITCHBACK_V1");
console.log(`  flight_type = ${flattenSubcomponents(fire)["flight_type"]}`);
console.log(`  environment = ${flattenSubcomponents(fire)["environment"]}`);

const row = { at: NOW, kind: "subcomponent_seed", objects_registered: objectCount(), canonical: !!canonical, handrail_families: 2, baserail_families: 1, external_fire_escape: !!fire, grand_double_return: !!get("STAIRCASE_GRAND_DOUBLE_RETURN_VOLUTE_V1") };
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
