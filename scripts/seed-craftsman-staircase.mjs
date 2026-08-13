#!/usr/bin/env node
// Reinforce Material Genome + Joinery DNA + Construction Rules from the
// Craftsman split-staircase specimen (Philip 2026-08-04).
//
// One specimen · walnut-stained European oak · closed-string · quarter-turn
// half landing · LED tread lighting · raised-panel box newels · square walnut
// balusters · brass wall lights. Every reinforcement carries Rule-c
// attribution (Philip O'Farrell) and evidence pointing back to the manifest
// URL — so future queries can prove WHY the confidence moved.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");
const SPECIMEN_URL = "https://ik.imagekit.io/5vv5pw26q/Untitledasdaccasd.png";

const material = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "material-genome", "index.ts")).href);
const joinery  = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "joinery-dna", "index.ts")).href);
const rules    = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "construction-rules", "index.ts")).href);

material.reset();
joinery.reset();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const spec = manifest.images[SPECIMEN_URL];
if (!spec) { console.error("MISSING · craftsman specimen not found in manifest"); process.exit(1); }
console.log(`Craftsman staircase seed · ${SPECIMEN_URL}`);
console.log(`Style: ${spec.style_class} · Domain: ${spec.subject_domain}`);

// ─── Material Genome reinforcement ─────────────────────────────────────
console.log("\nMaterial Genome reinforcements:");
const materialObservations = [
  ["european_walnut_matt_lacquer", "staircase", 0.02, "walnut-stained oak treads · risers · handrail · newels · balusters on Craftsman split staircase"],
  ["oak_american_white_satin_lacquer", "staircase", 0.015, "solid European oak substrate stained walnut on Craftsman treads"],
  ["oak_american_white_satin_lacquer", "handrail", 0.01, "solid oak handrail with ogee walnut-stained profile"],
  ["brass_polished", "staircase", 0.01, "aged brass wall lights + polished brass handrail brackets"],
];
for (const [id, trade, delta, reason] of materialObservations) {
  material.reinforce(id, trade, delta, reason, SPECIMEN_URL);
  const m = material.get(id);
  console.log(`  ↑ ${id} (${trade}) · obs=${m.observation_count} · conf=${m.aggregate_confidence.toFixed(3)}`);
}

// ─── Joinery DNA reinforcement ─────────────────────────────────────────
console.log("\nJoinery DNA reinforcements:");
const joineryObservations = [
  ["WARM_WALNUT_LUXURY", "walnut-stained oak throughout · warm satin lacquer · luxury register"],
  ["RAISED_PANEL_TRADITIONAL", "raised_panel_box newels with pyramid caps · traditional joinery language"],
  ["OGEE_MOULDING", "ogee/pigs-ear moulded walnut handrail continuous around gallery"],
  ["PIGS_EAR_PROFILE", "pigs-ear comfort handrail profile · solid walnut · continuous curved"],
  ["BULLNOSE_PROFILE", "shallow bullnose tread nosing conceals LED strip"],
  ["NATURAL_OAK_HERITAGE", "solid European oak substrate · traditional closed-string housed construction"],
];
for (const [family_id, reason] of joineryObservations) {
  joinery.reinforce(family_id, 0.02, reason, "staircase", SPECIMEN_URL);
  const f = joinery.get(family_id);
  console.log(`  ↑ ${family_id} · obs=${f.observation_count} · conf=${f.aggregate_confidence.toFixed(3)}`);
}

// ─── Construction Rules validation ─────────────────────────────────────
console.log("\nConstruction Rules validation for Craftsman combination:");
const craftsmanCombo = [
  { slot: "structural_system", value: "closed_string" },
  { slot: "flight_type", value: "half_landing" },
  { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
  { slot: "balustrade_component", value: "fillets" },
  { slot: "newel_family", value: "raised_panel_box" },
  { slot: "newel_cap", value: "pyramid" },
  { slot: "starting_step_shape", value: "bullnose_curved_front" },
  { slot: "entrance_system", value: "single_bullnose" },
  { slot: "riser_type", value: "closed" },
  { slot: "use", value: "primary_domestic" },
  { slot: "handrail_height_mm", value: "900_to_1000" },
];
const report = rules.validateCombination(craftsmanCombo, { domain: "staircase" });
console.log(`  rules fired: ${report.firings.length} · overall: ${report.overall} · passes: ${report.passes} · required failures: ${report.required_failures} · warns: ${report.warns}`);
for (const f of report.firings) {
  const icon = f.status === "satisfied" ? "✓" : (f.severity === "required" ? "✗" : "⚠");
  console.log(`    ${icon} ${f.rule_id} · ${f.status}${f.status === "violated" ? " · " + f.reason : ""}`);
}

// ─── Explanation stage · prove the pipeline ────────────────────────────
console.log("\nExplanation stage · explainRecommendation for walnut on this staircase:");
const explanation = material.explainRecommendation({
  material_id: "european_walnut_matt_lacquer",
  trades: ["staircase", "kitchen"],
  intended_pairings: ["brass_polished", "quartz_worktop_white"],
  budget_conscious: true,
  sustainability_focused: true,
});
console.log(`  ${explanation.prose}`);
console.log(`  bullets: ${explanation.bullets.length} · clashes: ${explanation.clashes.length} · sub_notes: ${explanation.substitution_notes.length}`);

// ─── Learning log row ──────────────────────────────────────────────────
const row = {
  at: new Date().toISOString(),
  kind: "craftsman_staircase_seed",
  specimen_url: SPECIMEN_URL,
  style_class: spec.style_class,
  materials_reinforced: materialObservations.length,
  joinery_families_reinforced: joineryObservations.length,
  rules_fired: report.firings.length,
  rules_passed: report.passes,
  rules_required_failures: report.required_failures,
  rules_warns: report.warns,
  overall: report.overall,
  explanation_bullets: explanation.bullets.length,
  explanation_substitution_notes: explanation.substitution_notes.length,
};
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
