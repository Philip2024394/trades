#!/usr/bin/env node
// Seed Joinery DNA reinforcement across the 3 cross-trade specimens ·
// demonstrates that a single upload strengthens multiple joinery families ·
// and that families like IN_FRAME_SHAKER + WARM_WALNUT_LUXURY receive
// observations from BOTH kitchen and staircase uploads (the whole point of
// cross-trade transfer).
//
// Doctrine: docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const joinery = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "joinery-dna", "index.ts")).href);

joinery.reset();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const specimens = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.tags?.includes("joinery_dna_seed") || v?.tags?.includes("material_genome_seed"))
  .map(([url, meta]) => ({ url, ...meta }));

console.log(`Joinery DNA cross-trade seed · ${specimens.length} specimens`);

// Map each specimen to the joinery families it reinforces.
function familiesForSpecimen(spec) {
  const results = [];

  if (spec.style_class === "walnut_in_frame_shaker_luxury") {
    results.push(["IN_FRAME_SHAKER", "kitchen", "walnut in-frame shaker · face frames + raised panel + wide stiles/rails"]);
    results.push(["RAISED_PANEL_TRADITIONAL", "kitchen", "raised panel shaker doors on walnut in-frame kitchen"]);
    results.push(["CROWN_MOULDING_STEPPED", "kitchen", "large stepped cornice moulding continuous around room"]);
    results.push(["BEADED_FACE_FRAME", "kitchen", "in-frame face frames · furniture-style proportions"]);
    results.push(["WARM_WALNUT_LUXURY", "kitchen", "solid walnut · book-matched · satin lacquer · furniture-grade finish"]);
    results.push(["OGEE_MOULDING", "kitchen", "traditional mouldings on cabinet framing"]);
  }

  if (spec.style_class === "grand_luxury_traditional") {
    results.push(["NATURAL_OAK_HERITAGE", "staircase", "European Oak · golden stain · natural cathedral grain · satin poly"]);
    results.push(["TURNED_TRADITIONAL", "staircase", "traditional turned balusters · symmetrical waist-turning · square top/bottom"]);
    results.push(["VICTORIAN_TURNED", "staircase", "upper landing turned newels · traditional decorative turning"]);
    results.push(["BULLNOSE_PROFILE", "staircase", "bullnose leading edge on hardwood treads"]);
    results.push(["RAISED_PANEL_TRADITIONAL", "staircase", "sculptural + traditional joinery language on newel bases"]);
    results.push(["OGEE_MOULDING", "staircase", "traditional profile on continuous curved handrail"]);
    results.push(["PIGS_EAR_PROFILE", "staircase", "traditional British mopstick/comfort handrail profile 54-60mm"]);
    // Cross-trade: same NATURAL_OAK_HERITAGE + RAISED_PANEL_TRADITIONAL that shows up on Georgian kitchens
  }

  if (spec.style_class === "industrial_stainless_commercial") {
    results.push(["INDUSTRIAL_STAINLESS", "kitchen", "brushed stainless steel wrapped commercial-grade island + splashback"]);
    results.push(["CONTEMPORARY_SLAB", "kitchen", "flat slab doors · no frame · minimal european styling"]);
    results.push(["HANDLELESS_MODERN", "kitchen", "handle rail design + integrated pull"]);
    results.push(["SQUARE_CONTEMPORARY_PROFILE", "kitchen", "sharp square edges throughout · no traditional mouldings"]);
  }

  if (spec.style_class === "modern_shaker_navy_oak_island") {
    results.push(["IN_FRAME_SHAKER", "kitchen", "navy shaker doors with recessed centre panels + slim frame"]);
    results.push(["RAISED_PANEL_TRADITIONAL", "kitchen", "shaker recessed panel doors"]);
    results.push(["BULLNOSE_PROFILE", "kitchen", "butcher-block oak worktop with thick square edge"]);
    results.push(["NATURAL_OAK_HERITAGE", "kitchen", "solid oak butcher-block island worktop + light oak flooring"]);
  }

  if (spec.style_class === "luxury_transitional_warm_white_ivory") {
    results.push(["IN_FRAME_SHAKER", "kitchen", "warm off-white shaker with narrow frame"]);
    results.push(["RAISED_PANEL_TRADITIONAL", "kitchen", "traditional shaker with narrow frame detailing"]);
    results.push(["CROWN_MOULDING_STEPPED", "kitchen", "decorative crown moulding around perimeter"]);
    results.push(["BEADED_FACE_FRAME", "kitchen", "in-frame face frames · furniture-grade"]);
    results.push(["OGEE_MOULDING", "kitchen", "traditional mouldings"]);
  }

  if (spec.style_class === "walnut_contemporary_minimalism") {
    results.push(["CONTEMPORARY_SLAB", "kitchen", "flat slab walnut veneer full-height cabinetry"]);
    results.push(["HANDLELESS_MODERN", "kitchen", "handleless drawers · shadow-gap reveals"]);
    results.push(["WARM_WALNUT_LUXURY", "kitchen", "book-matched walnut veneer · satin matte · vertical grain"]);
    results.push(["SQUARE_CONTEMPORARY_PROFILE", "kitchen", "thin contemporary worktop profile · square edges"]);
  }

  if (spec.style_class === "dark_luxury_monochromatic") {
    results.push(["CONTEMPORARY_SLAB", "kitchen", "flat slab matte black cabinets · full-overlay construction"]);
    results.push(["HANDLELESS_MODERN", "kitchen", "handleless with integrated finger pulls · push-to-open"]);
    results.push(["SQUARE_CONTEMPORARY_PROFILE", "kitchen", "waterfall stone ends · sharp square profile · slim cylindrical pendants"]);
  }

  if (spec.style_class === "scandinavian_japandi_oak_veneer_white") {
    results.push(["CONTEMPORARY_SLAB", "kitchen", "flat slab super matte white uppers + oak veneer bases"]);
    results.push(["HANDLELESS_MODERN", "kitchen", "true handleless · push-to-open · nearly invisible hardware"]);
    results.push(["NATURAL_OAK_HERITAGE", "kitchen", "natural oak veneer base cabinets with horizontal grain + oak display niches"]);
    results.push(["SQUARE_CONTEMPORARY_PROFILE", "kitchen", "clean horizontal + vertical shadow gaps · square edges"]);
  }

  if (spec.style_class === "solid_oak_worktop_navy_shaker_context") {
    results.push(["NATURAL_OAK_HERITAGE", "worktop", "40mm full-stave solid European oak worktop close-up"]);
    results.push(["IN_FRAME_SHAKER", "kitchen", "navy shaker cabinets · recessed doors · brass cup pulls"]);
    results.push(["BULLNOSE_PROFILE", "worktop", "square edge worktop with slight eased corners"]);
    results.push(["OGEE_MOULDING", "kitchen", "traditional shaker joinery language"]);
  }

  return results;
}

for (const spec of specimens) {
  const families = familiesForSpecimen(spec);
  console.log(`\n${spec.subject_domain}/${spec.style_class}:`);
  for (const [family_id, trade, reason] of families) {
    joinery.reinforce(family_id, 0.02, reason, trade, spec.url);
    console.log(`  ↑ ${family_id} (${trade})`);
  }
}

// ─── Prove cross-trade transfer ────────────────────────────────────────

console.log("\n\nCROSS-TRADE OBSERVATIONS · families reinforced by more than one trade:");
const crossTrade = joinery.all().filter((f) => {
  const trades = new Set(f.history.map((h) => h.trade));
  return trades.size >= 2;
});
for (const f of crossTrade) {
  const trades = Array.from(new Set(f.history.map((h) => h.trade))).join(", ");
  console.log(`  ${f.family_id} · ${f.observation_count} observations across trades [${trades}] · confidence ${f.aggregate_confidence.toFixed(3)}`);
}

// ─── sharedFamiliesAcross([kitchen, staircase]) query ─────────────────

console.log("\nsharedFamiliesAcross([kitchen, staircase]) query result:");
const shared = joinery.sharedFamiliesAcross(["kitchen", "staircase"]);
shared.slice(0, 8).forEach((f) => console.log(`  · ${f.family_id} (obs=${f.observation_count})`));

// ─── Detect clashes if a customer tried to mix traditional walnut + industrial ─

console.log("\nClash detection for INCOHERENT selection (IN_FRAME_SHAKER + INDUSTRIAL_STAINLESS + WARM_WALNUT_LUXURY):");
const clashes = joinery.detectClashes(["IN_FRAME_SHAKER", "INDUSTRIAL_STAINLESS", "WARM_WALNUT_LUXURY"]);
clashes.forEach((c) => console.log(`  ✗ ${c.reason}`));

const row = {
  at: new Date().toISOString(),
  kind: "joinery_dna_cross_trade_seed",
  specimens: specimens.length,
  cross_trade_families: crossTrade.length,
  cross_trade_family_ids: crossTrade.map((f) => f.family_id),
  shared_kitchen_staircase: shared.length,
  clashes_detected: clashes.length,
};
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
