#!/usr/bin/env node
// Reinforce Material Genome + Joinery DNA + Construction Rules from 4 new
// specimens (Philip 2026-08-04 · Colonial staircase + 3 kitchens).
//
// Each specimen carries Rule-c attribution to Philip · every reinforcement
// records the trade so cross-trade compounding continues (walnut on a kitchen
// makes walnut-on-staircase recommendations stronger).

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const material = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "material-genome", "index.ts")).href);
const joinery  = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "joinery-dna", "index.ts")).href);
const rules    = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "construction-rules", "index.ts")).href);

material.reset();
joinery.reset();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

const SPECIMENS = [
  {
    url: "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Aug%204,%202026,%2002_45_57%20AM.png",
    label: "Colonial turned-oak staircase with wainscot",
    materials: [
      ["oak_american_white_satin_lacquer", "staircase", 0.02, "solid oak treads with bullnose nosing on Colonial straight staircase"],
      ["oak_american_white_satin_lacquer", "handrail", 0.02, "solid oak traditional moulded handrail continuous over turned newels"],
      ["oak_american_white_satin_lacquer", "flooring", 0.02, "wide-plank engineered oak flooring · natural satin · honey colour · continuous hallway"],
      ["paint_matt_emulsion_white_shaker", "staircase", 0.02, "painted white risers · painted white closed-string stringers with mitred joints"],
      ["paint_matt_emulsion_white_shaker", "panelling", 0.02, "traditional picture-frame wainscoting · painted white rectangular panel mouldings alongside staircase"],
      ["brass_polished", "staircase", 0.01, "antique brass wall sconce with white fabric shade illuminating the staircase"],
    ],
    joinery_families: [
      ["TURNED_TRADITIONAL", "staircase", "large turned vase-shaped newel + matching lathe-turned oak balusters with narrow neck + decorative centre + square base"],
      ["VICTORIAN_TURNED", "staircase", "traditional Georgian/Colonial vocabulary · turned newel with stacked rings + ball finial"],
      ["NATURAL_OAK_HERITAGE", "staircase", "solid European/American White Oak · natural golden · satin lacquer · traditional closed-string housed construction"],
      ["OGEE_MOULDING", "staircase", "traditional moulded handrail profile on Colonial staircase"],
      ["PIGS_EAR_PROFILE", "staircase", "comfortable rounded grip handrail continuous over turned newels"],
      ["BULLNOSE_PROFILE", "staircase", "rounded bullnose starter step + rounded bullnose nosing on every tread"],
      ["RAISED_PANEL_TRADITIONAL", "panelling", "traditional picture-frame wainscoting · rectangular panel mouldings painted white"],
      ["CROWN_MOULDING_STEPPED", "staircase", "decorative crown moulding at ceiling reinforcing classic architectural style"],
      ["BEADED_FACE_FRAME", "panelling", "wainscoting picture-frame moulding aligned with home trim · beaded traditional appearance"],
    ],
    rules_combination: [
      { slot: "structural_system", value: "closed_string" },
      { slot: "flight_type", value: "straight" },
      { slot: "handrail_profile", value: "traditional_moulded_ploughed" },
      { slot: "balustrade_component", value: "fillets" },
      { slot: "newel_family", value: "turned_victorian" },
      { slot: "newel_finial", value: "ball" },
      { slot: "balustrade_system", value: "turned_baluster" },
      { slot: "starting_step_shape", value: "bullnose_curved_front" },
      { slot: "entrance_system", value: "single_bullnose" },
      { slot: "riser_type", value: "closed" },
      { slot: "use", value: "primary_domestic" },
      { slot: "handrail_height_mm", value: "900_to_1000" },
    ],
  },
  {
    url: "https://ik.imagekit.io/5vv5pw26q/Untitledasdsdsss.png",
    label: "Japandi L-shaped walnut waterfall kitchen",
    materials: [
      ["european_walnut_matt_lacquer", "kitchen", 0.02, "walnut oak veneer base + tall wall cabinets + island feature panel + display niches · horizontal grain continuous"],
      ["european_walnut_matt_lacquer", "cabinet", 0.02, "walnut veneer full-height tall cabinet wall with integrated appliances · furniture-quality finish"],
      ["quartz_worktop_white", "worktop", 0.02, "warm white engineered quartz worktop · square 20-40mm profile · very subtle veining"],
      ["quartz_worktop_white", "splashback", 0.02, "matching quartz slab full-height splashback · seamless · no tiles"],
      ["quartz_worktop_white", "kitchen", 0.015, "waterfall quartz end panel on kitchen island"],
      ["paint_matt_emulsion_white_shaker", "kitchen", 0.015, "matte warm-white lacquered MDF handleless upper cabinets · ceiling-height · anti-fingerprint"],
      ["porcelain_grey_large_format", "flooring", 0.02, "large-format light-beige porcelain tile flooring · matte · minimal grout"],
      ["stainless_steel_brushed", "kitchen", 0.01, "matte black composite sink + matte black stainless gooseneck mixer taps"],
      ["brass_polished", "kitchen", 0.01, "brass accent at pendant suspension point above island"],
    ],
    joinery_families: [
      ["CONTEMPORARY_SLAB", "kitchen", "handleless flat slab uppers + walnut veneer base drawers · super-matte laminate · ceiling-height"],
      ["HANDLELESS_MODERN", "kitchen", "integrated finger-pull channels + handleless soft-close drawers throughout"],
      ["WARM_WALNUT_LUXURY", "kitchen", "walnut oak veneer base + tall cabinet wall + island feature panel + illuminated niches"],
      ["NATURAL_OAK_HERITAGE", "kitchen", "walnut oak veneer with horizontal grain running continuously across drawers"],
      ["SQUARE_CONTEMPORARY_PROFILE", "worktop", "square 20-40mm contemporary worktop profile · seamless quartz splashback · sharp edges"],
    ],
    rules_combination: null,
  },
  {
    url: "https://ik.imagekit.io/5vv5pw26q/Untitledsasssdxcdxdasdfddxcxcfdsfxcvdf.png",
    label: "Japandi symmetrical single-wall walnut kitchen",
    materials: [
      ["european_walnut_matt_lacquer", "kitchen", 0.02, "light walnut oak veneer base + full-height walnut tall wall + walnut feature panel on island"],
      ["european_walnut_matt_lacquer", "cabinet", 0.02, "uninterrupted walnut veneer floor-to-ceiling tall cabinet wall · furniture-quality"],
      ["quartz_worktop_white", "worktop", 0.02, "warm white engineered quartz worktop with soft cream undertone · subtle marble veining"],
      ["quartz_worktop_white", "splashback", 0.02, "full-height matching quartz splashback continuous to underside of wall cabinets · no grout"],
      ["quartz_worktop_white", "kitchen", 0.015, "waterfall white quartz ends on extra-large island"],
      ["paint_matt_emulsion_white_shaker", "kitchen", 0.015, "super-matte lacquered MDF handleless upper cabinets · symmetrical · aligned vertical shadow gaps"],
      ["porcelain_grey_large_format", "flooring", 0.02, "large-format warm beige stone-effect porcelain tiles · matte · minimal grout"],
      ["stainless_steel_brushed", "kitchen", 0.01, "black composite undermount sinks + matte black stainless gooseneck mixer taps"],
      ["brass_polished", "kitchen", 0.01, "brass accent at pendant suspension point above island"],
    ],
    joinery_families: [
      ["CONTEMPORARY_SLAB", "kitchen", "handleless flat slab uppers + walnut veneer base + symmetrical vertical shadow gaps"],
      ["HANDLELESS_MODERN", "kitchen", "true handleless throughout · soft-close · vertical black pull handles only on tall cabinet wall accent"],
      ["WARM_WALNUT_LUXURY", "kitchen", "floor-to-ceiling walnut veneer tall wall + base cabinets + island feature panel + illuminated niches"],
      ["NATURAL_OAK_HERITAGE", "kitchen", "light walnut oak veneer with horizontal grain"],
      ["SQUARE_CONTEMPORARY_PROFILE", "worktop", "square 20-40mm contemporary worktop profile · full-height seamless quartz splashback"],
    ],
    rules_combination: null,
  },
  {
    url: "https://ik.imagekit.io/5vv5pw26q/Untitledasdsdsssdfdf.png",
    label: "Transitional Shaker brass + oak-shelf kitchen",
    materials: [
      ["paint_matt_emulsion_white_shaker", "kitchen", 0.02, "slim-frame Shaker painted warm white doors · recessed centre panel · full-overlay · consistent proportions"],
      ["paint_matt_emulsion_white_shaker", "cabinet", 0.02, "painted shaker ceiling-height cabinetry with decorative crown moulding + custom range hood mantle"],
      ["paint_matt_emulsion_white_shaker", "panelling", 0.015, "painted shaker island end panels and pantry wall · furniture-style"],
      ["oak_american_white_satin_lacquer", "kitchen", 0.02, "solid oak floating shelves with concealed brackets + under-shelf warm LED · warmth against painted cabinetry"],
      ["quartz_worktop_white", "worktop", 0.02, "premium white quartz worktop · subtle grey veining · straight square 30-40mm edge"],
      ["quartz_worktop_white", "splashback", 0.02, "full-height matching quartz splashback · minimal veining · seamless · no tiles"],
      ["brass_polished", "kitchen", 0.02, "brushed brass knobs + cup pulls + long brass pantry handles + brushed brass gooseneck mixer · consistent throughout"],
      ["brass_polished", "door", 0.01, "brushed brass hardware on cabinet doors matching taps and pendant fittings"],
      ["porcelain_grey_large_format", "flooring", 0.02, "large-format stone-look soft-beige porcelain flooring · matte · minimal grout"],
      ["glass_toughened_10mm", "kitchen", 0.01, "two large clear glass globe pendants over island with brushed brass fittings and warm exposed filament bulbs"],
    ],
    joinery_families: [
      ["IN_FRAME_SHAKER", "kitchen", "slim-frame Shaker doors · recessed centre panels · full-overlay · consistent proportions"],
      ["RAISED_PANEL_TRADITIONAL", "kitchen", "traditional shaker recessed-panel doors + decorative pantry doors + island end panels"],
      ["CROWN_MOULDING_STEPPED", "kitchen", "decorative crown moulding at ceiling-height uppers + custom range hood mantle"],
      ["OGEE_MOULDING", "kitchen", "traditional shaker joinery language + decorative range hood mantle mouldings"],
      ["BEADED_FACE_FRAME", "kitchen", "slim shaker face frames · furniture-style proportions · symmetrical cabinet layout"],
      ["NATURAL_OAK_HERITAGE", "kitchen", "solid oak floating shelves with concealed brackets + warm LED · natural oak accent against painted cabinetry"],
    ],
    rules_combination: null,
  },
];

let totalMatReinforcements = 0;
let totalJoineryReinforcements = 0;
let totalRulesEvaluated = 0;

for (const spec of SPECIMENS) {
  const meta = manifest.images[spec.url];
  if (!meta) { console.error("MISSING · manifest entry not found:", spec.url); continue; }
  console.log(`\n${spec.label}`);
  console.log("=".repeat(spec.label.length));

  // Material Genome
  console.log("Material Genome reinforcements:");
  for (const [id, trade, delta, reason] of spec.materials) {
    try {
      material.reinforce(id, trade, delta, reason, spec.url);
      const m = material.get(id);
      console.log(`  ↑ ${id} (${trade}) · obs=${m.observation_count} · conf=${m.aggregate_confidence.toFixed(3)}`);
      totalMatReinforcements++;
    } catch (e) {
      console.log(`  ✗ ${id} (${trade}) · ${e.message}`);
    }
  }

  // Joinery DNA
  console.log("Joinery DNA reinforcements:");
  for (const [family_id, trade, reason] of spec.joinery_families) {
    try {
      joinery.reinforce(family_id, 0.02, reason, trade, spec.url);
      const f = joinery.get(family_id);
      console.log(`  ↑ ${family_id} · obs=${f.observation_count} · conf=${f.aggregate_confidence.toFixed(3)}`);
      totalJoineryReinforcements++;
    } catch (e) {
      console.log(`  ✗ ${family_id} · ${e.message}`);
    }
  }

  // Construction Rules (staircase only for now)
  if (spec.rules_combination) {
    console.log("Construction Rules validation:");
    const report = rules.validateCombination(spec.rules_combination, { domain: "staircase" });
    console.log(`  rules fired: ${report.firings.length} · overall: ${report.overall} · passes: ${report.passes} · required failures: ${report.required_failures} · warns: ${report.warns}`);
    for (const f of report.firings) {
      const icon = f.status === "satisfied" ? "✓" : (f.severity === "required" ? "✗" : "⚠");
      console.log(`    ${icon} ${f.rule_id} · ${f.status}`);
    }
    totalRulesEvaluated += report.firings.length;
  }
}

// ─── Cross-trade proof ────────────────────────────────────────────────
console.log("\n\n══ CROSS-TRADE PROOF ══");
const walnut = material.get("european_walnut_matt_lacquer");
const oak = material.get("oak_american_white_satin_lacquer");
const brass = material.get("brass_polished");
const quartz = material.get("quartz_worktop_white");
const paint = material.get("paint_matt_emulsion_white_shaker");
console.log(`european_walnut · observed ${walnut.observation_count}× across ${walnut.trades_it_appears_in.length} trades [${walnut.trades_it_appears_in.join(", ")}] · confidence ${walnut.aggregate_confidence.toFixed(3)}`);
console.log(`oak_american_white · observed ${oak.observation_count}× across ${oak.trades_it_appears_in.length} trades [${oak.trades_it_appears_in.join(", ")}] · confidence ${oak.aggregate_confidence.toFixed(3)}`);
console.log(`brass_polished · observed ${brass.observation_count}× across ${brass.trades_it_appears_in.length} trades [${brass.trades_it_appears_in.join(", ")}] · confidence ${brass.aggregate_confidence.toFixed(3)}`);
console.log(`quartz_worktop_white · observed ${quartz.observation_count}× across ${quartz.trades_it_appears_in.length} trades [${quartz.trades_it_appears_in.join(", ")}] · confidence ${quartz.aggregate_confidence.toFixed(3)}`);
console.log(`paint_matt_emulsion_white_shaker · observed ${paint.observation_count}× across ${paint.trades_it_appears_in.length} trades [${paint.trades_it_appears_in.join(", ")}] · confidence ${paint.aggregate_confidence.toFixed(3)}`);

const shared = joinery.sharedFamiliesAcross(["kitchen", "staircase"]);
console.log(`\nsharedFamiliesAcross([kitchen, staircase]) · ${shared.length} families:`);
shared.slice(0, 10).forEach((f) => console.log(`  · ${f.family_id} (obs=${f.observation_count})`));

// ─── Explanation stage proof on the Colonial specimen materials ───────
console.log("\n══ EXPLANATION STAGE · Colonial staircase oak recommendation ══");
const oakExplanation = material.explainRecommendation({
  material_id: "oak_american_white_satin_lacquer",
  trades: ["staircase", "handrail", "flooring"],
  intended_pairings: ["paint_matt_emulsion_white_shaker", "brass_polished"],
  budget_conscious: true,
  sustainability_focused: false,
});
console.log(oakExplanation.prose);

console.log("\n══ EXPLANATION STAGE · Transitional Shaker painted-shaker recommendation ══");
const paintExplanation = material.explainRecommendation({
  material_id: "paint_matt_emulsion_white_shaker",
  trades: ["kitchen", "cabinet"],
  intended_pairings: ["oak_american_white_satin_lacquer", "quartz_worktop_white", "brass_polished"],
  budget_conscious: false,
  sustainability_focused: false,
});
console.log(paintExplanation.prose);

// ─── Learning log ─────────────────────────────────────────────────────
const row = {
  at: new Date().toISOString(),
  kind: "colonial_and_3_kitchens_seed",
  specimens: SPECIMENS.length,
  material_reinforcements: totalMatReinforcements,
  joinery_reinforcements: totalJoineryReinforcements,
  rules_evaluated: totalRulesEvaluated,
  shared_kitchen_staircase_families: shared.length,
  walnut_trades: walnut.trades_it_appears_in,
  oak_trades: oak.trades_it_appears_in,
  brass_trades: brass.trades_it_appears_in,
  quartz_trades: quartz.trades_it_appears_in,
  paint_trades: paint.trades_it_appears_in,
};
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
