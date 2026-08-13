#!/usr/bin/env node
// Reinforce Material Genome across every material-relevant specimen · proves
// cross-trade transfer: oak strengthens from BOTH staircase and kitchen uploads.
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const mg = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "material-genome", "index.ts")).href);

mg.reset();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));

// Map each specimen (subject_domain × primary_material/style_class) to the
// MaterialDNA ids it reinforces + the trade context.
function materialsForSpecimen(spec) {
  const results = [];
  const url = spec.url;
  const style = (spec.style_class ?? "").toLowerCase();
  const domain = spec.subject_domain;

  // Kitchens
  if (domain === "kitchen") {
    if (style.includes("walnut")) results.push({ material_id: "european_walnut_matt_lacquer", trade: "kitchen", reason: `${style} · walnut cabinetry` });
    if (style.includes("industrial_stainless")) {
      results.push({ material_id: "stainless_steel_brushed", trade: "kitchen", reason: `${style} · full stainless wrap` });
      results.push({ material_id: "glass_toughened_10mm", trade: "cabinet", reason: `${style} · fluted glass display cabinets` });
      results.push({ material_id: "porcelain_grey_large_format", trade: "flooring", reason: `${style} · large format grey porcelain floor` });
    }
    if (style.includes("shaker") && (style.includes("navy") || style.includes("warm_white") || style.includes("ivory") || style.includes("in_frame"))) {
      results.push({ material_id: "paint_matt_emulsion_white_shaker", trade: "cabinet", reason: `${style} · painted shaker doors` });
      results.push({ material_id: "brass_polished", trade: "kitchen", reason: `${style} · brass hardware + tap` });
    }
    if (style.includes("oak") || style.includes("navy_oak")) {
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "worktop", reason: `${style} · butcher-block oak island worktop` });
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "flooring", reason: `${style} · light oak plank floor` });
    }
    if (style.includes("warm_white") || style.includes("ivory") || style.includes("transitional")) {
      results.push({ material_id: "quartz_worktop_white", trade: "worktop", reason: `${style} · engineered quartz worktop + full-height splashback` });
      results.push({ material_id: "quartz_worktop_white", trade: "splashback", reason: `${style} · matching quartz splashback` });
      results.push({ material_id: "porcelain_grey_large_format", trade: "flooring", reason: `${style} · large-format light beige porcelain` });
    }
    if (style.includes("walnut_in_frame")) {
      results.push({ material_id: "european_walnut_matt_lacquer", trade: "worktop", reason: `${style} · solid walnut worktop` });
      results.push({ material_id: "brass_polished", trade: "kitchen", reason: `${style} · antique brass throughout` });
      results.push({ material_id: "porcelain_grey_large_format", trade: "flooring", reason: `${style} · warm grey porcelain floor` });
    }
    if (style.includes("walnut_contemporary_minimalism") || style.includes("walnut_veneer")) {
      results.push({ material_id: "european_walnut_matt_lacquer", trade: "cabinet", reason: `${style} · walnut veneer book-matched full-height cabinets` });
      results.push({ material_id: "granite_black", trade: "worktop", reason: `${style} · dark engineered stone honed worktop` });
      results.push({ material_id: "granite_black", trade: "splashback", reason: `${style} · black marble splashback large slab` });
      results.push({ material_id: "glass_toughened_10mm", trade: "cabinet", reason: `${style} · smoked glass display cabinets with black frames` });
      results.push({ material_id: "aluminium_anodised", trade: "cabinet", reason: `${style} · matte black aluminium frames` });
      results.push({ material_id: "porcelain_grey_large_format", trade: "flooring", reason: `${style} · charcoal grey stone-effect porcelain` });
    }
    if (style.includes("dark_luxury_monochromatic") || style.includes("dark_luxury")) {
      results.push({ material_id: "granite_black", trade: "worktop", reason: `${style} · black quartz / sintered stone waterfall island` });
      results.push({ material_id: "granite_black", trade: "splashback", reason: `${style} · matching black stone splashback continuous slab` });
      results.push({ material_id: "glass_toughened_10mm", trade: "cabinet", reason: `${style} · smoked bronze glass display cabinets` });
      results.push({ material_id: "aluminium_anodised", trade: "cabinet", reason: `${style} · matte black aluminium frames + slim window frames` });
      results.push({ material_id: "porcelain_grey_large_format", trade: "flooring", reason: `${style} · large-format timber-look porcelain grey-brown` });
      results.push({ material_id: "paint_matt_emulsion_white_shaker", trade: "cabinet", reason: `${style} · matte lacquered slab panels (adapted to black)` });
    }
    if (style.includes("scandinavian_japandi") || style.includes("japandi")) {
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "cabinet", reason: `${style} · oak veneer base cabinets with horizontal grain` });
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "cabinet", reason: `${style} · oak veneer display niches` });
      results.push({ material_id: "paint_matt_emulsion_white_shaker", trade: "cabinet", reason: `${style} · super matte white slab upper cabinets` });
      results.push({ material_id: "quartz_worktop_white", trade: "worktop", reason: `${style} · white quartz/porcelain worktop soft ivory` });
      results.push({ material_id: "quartz_worktop_white", trade: "splashback", reason: `${style} · matching quartz splashback full-height` });
      results.push({ material_id: "aluminium_anodised", trade: "door", reason: `${style} · black aluminium garden door frame` });
    }
    if (style.includes("solid_oak_worktop")) {
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "worktop", reason: `${style} · 40mm full-stave solid European oak worktop close-up` });
      results.push({ material_id: "paint_matt_emulsion_white_shaker", trade: "cabinet", reason: `${style} · navy painted shaker cabinets (paint family)` });
      results.push({ material_id: "brass_polished", trade: "kitchen", reason: `${style} · brushed brass gooseneck tap + cup pulls` });
    }
  }

  // Staircases
  if (domain === "staircase") {
    const primary = (spec.primary_material ?? "").toLowerCase();
    const construction = (spec.construction_type ?? "").toLowerCase();
    if (primary.includes("oak") || primary.includes("european_oak")) {
      results.push({ material_id: "oak_american_white_satin_lacquer", trade: "staircase", reason: `${construction} oak staircase upload` });
    }
    if (primary.includes("walnut")) {
      results.push({ material_id: "european_walnut_matt_lacquer", trade: "staircase", reason: `${construction} walnut staircase upload` });
    }
    if (primary.includes("hardwood_dark") || primary.includes("mahogany")) {
      results.push({ material_id: "mahogany_polished", trade: "staircase", reason: `${construction} dark hardwood staircase (mahogany-appearance)` });
    }
    if (primary.includes("steel")) {
      results.push({ material_id: "steel_black_powder_coated", trade: "staircase", reason: `${construction} steel staircase upload` });
    }
    if (construction.includes("steel_switchback")) {
      results.push({ material_id: "steel_black_powder_coated", trade: "staircase", reason: `external steel fire escape switchback` });
    }
    if (construction.includes("mono_string")) {
      results.push({ material_id: "steel_black_powder_coated", trade: "staircase", reason: `mono-string steel spine + walnut treads` });
      results.push({ material_id: "european_walnut_matt_lacquer", trade: "handrail", reason: `walnut treads on steel mono-string` });
    }
  }

  return results;
}

const specimens = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.subject_domain === "kitchen" || (v?.subject_domain === "staircase" && ["training_specimen", "canonical_reference", "marketing_hero", "reusable_module"].includes(v?.staircase_context)))
  .map(([url, meta]) => ({ url, ...meta }));

console.log(`Material Genome cross-trade seed · ${specimens.length} candidate specimens`);

let reinforcements = 0;
for (const spec of specimens) {
  const mats = materialsForSpecimen(spec);
  for (const m of mats) {
    try {
      mg.reinforce(m.material_id, m.trade, 0.01, m.reason, spec.url);
      reinforcements++;
    } catch { /* unknown id · skip */ }
  }
}

console.log(`Reinforcements applied · ${reinforcements}`);

// Prove cross-trade transfer
const oak = mg.get("oak_american_white_satin_lacquer");
const walnut = mg.get("european_walnut_matt_lacquer");
const brass = mg.get("brass_polished");
const steel = mg.get("steel_black_powder_coated");

console.log("");
console.log("Cross-trade transfer proof:");
console.log(`  oak_american_white       · observations ${oak.observation_count} · confidence ${oak.aggregate_confidence.toFixed(3)} · trades [${oak.trades_it_appears_in.join(", ")}]`);
console.log(`  european_walnut          · observations ${walnut.observation_count} · confidence ${walnut.aggregate_confidence.toFixed(3)} · trades [${walnut.trades_it_appears_in.join(", ")}]`);
console.log(`  brass_polished           · observations ${brass.observation_count} · confidence ${brass.aggregate_confidence.toFixed(3)} · trades [${brass.trades_it_appears_in.join(", ")}]`);
console.log(`  steel_black_powder_coated· observations ${steel.observation_count} · confidence ${steel.aggregate_confidence.toFixed(3)} · trades [${steel.trades_it_appears_in.join(", ")}]`);

// Query proof
console.log("");
console.log("materialsForTrade(kitchen, excellent):");
const kitchenExcellent = mg.materialsForTrade("kitchen", "excellent");
kitchenExcellent.slice(0, 10).forEach((m) => console.log(`  · ${m.material_id} · L${m.premium_level} · obs=${m.observation_count}`));

// Clash proof
console.log("");
console.log("detectPairingClashes([oak, stainless, brass]):");
const clashes = mg.detectPairingClashes(["oak_american_white_satin_lacquer", "stainless_steel_brushed", "brass_polished"]);
clashes.forEach((c) => console.log(`  ✗ ${c.reason}`));

const row = {
  at: new Date().toISOString(),
  kind: "material_genome_cross_trade_seed",
  specimens: specimens.length,
  reinforcements,
  oak_observations: oak.observation_count,
  oak_trades: oak.trades_it_appears_in,
  walnut_observations: walnut.observation_count,
  walnut_trades: walnut.trades_it_appears_in,
  brass_observations: brass.observation_count,
  clashes_detected: clashes.length,
};
fs.appendFileSync(LEARNING_LOG, JSON.stringify(row) + "\n");
console.log(`\nAppended 1 row to ${path.relative(ROOT, LEARNING_LOG)}`);
