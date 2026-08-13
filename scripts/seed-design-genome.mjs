#!/usr/bin/env node
// Design Genome seed · runs all 17 staircase reference specimens + 4 loft ladder
// banners through the compounding-learning platforms · reinforces Brand DNA +
// Colour Grammar · asserts typed Object Relationships · plans a Campaign Family.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(process.cwd());
const MANIFEST = path.join(ROOT, "data", "nex-image-manifest.json");
const LEARNING_LOG = path.join(ROOT, "data", "nex-learning-log.jsonl");

const { learn } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "visual-learning", "index.ts")).href);
const { count: objectCount, clear: clearObjects } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "object-library", "index.ts")).href);
const { seedPremiumTradeBanner, reinforce: reinforcePattern, get: getPattern, count: patternCount, clear: clearPatterns } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "pattern-library", "index.ts")).href);
const { clear: clearPatternLearning } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "pattern-learning", "index.ts")).href);
const brandDna = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "brand-dna", "index.ts")).href);
const { assertRelationship, count: relCount, clear: clearRel } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "relationship-library", "index.ts")).href);
const { planCampaign, count: campCount, clear: clearCamp } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "campaign-family", "index.ts")).href);
const { feelingsFromThemePacks } = await import(pathToFileURL(path.join(ROOT, "src", "lib", "nex", "colour-grammar", "index.ts")).href);

clearObjects();
clearPatterns();
clearPatternLearning();
brandDna.reset();
clearRel();
clearCamp();

const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const staircaseSpecimens = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.subject_domain === "staircase" && ["training_specimen", "canonical_reference", "joint_detail_reference", "marketing_hero"].includes(v?.staircase_context))
  .map(([url, meta]) => ({ url, ...meta }));
const loftLadderBanners = Object.entries(manifest.images ?? {})
  .filter(([, v]) => v?.campaign_family === "loft_ladder_collection")
  .map(([url, meta]) => ({ url, ...meta }));

// ─── Register staircase archetypes ─────────────────────────────────────

for (const sp of staircaseSpecimens) {
  const styleClass = (sp.style_class ?? "unknown").split("_")[0];
  learn({
    extraction_id: `vkep_stair_${sp.construction_type}_${sp.riser_type}_${sp.style_class}`,
    project_id: "staircase_object_library",
    candidates: [{
      candidate_family: "OTHER",
      shape: { primary_shape: sp.construction_type?.startsWith("mono") ? "prism" : "rectangle", edge_treatment: "sharp", proportions: "large", style_class: styleClass },
      material_id: sp.primary_material === "steel_spine_walnut_tread" ? "steel_black_powder_coated" : "european_walnut_matt_lacquer",
      dimensions: { length_mm: 3600, width_mm: 900, height_mm: 2600, thickness_mm: 45 },
      style: styleClass,
      observed_confidence: sp.confidence ?? 0.95,
      evidence_asset_id: sp.url,
      suggested_display_name: `Staircase Archetype · ${sp.construction_type} · ${sp.riser_type} · ${sp.style_class}`,
    }],
    style_signals: [
      { feature: "construction_type", value: sp.construction_type },
      { feature: "riser_type", value: sp.riser_type },
      { feature: "style_class", value: sp.style_class },
      { feature: "primary_material", value: sp.primary_material },
      ...(sp.newel_family ? [{ feature: "newel_family", value: sp.newel_family }] : []),
      ...(sp.entrance_system ? [{ feature: "entrance_system", value: sp.entrance_system }] : []),
    ],
  });
}

// ─── Pattern Library · reinforce PREMIUM_TRADE_BANNER_V1 with loft ladder evidence ─

const trade = seedPremiumTradeBanner();
for (const b of loftLadderBanners) {
  reinforcePattern(trade.pattern_id, 0.005, "vlp_seed", b.url);
}
const patternAfter = getPattern(trade.pattern_id);

// ─── Brand DNA · reinforce archetypes per loft ladder banner ───────────

const BRAND_MAP = {
  industrial_professional: "industrial",
  professional: "corporate",
  premium: "premium",
  family: "family",
  luxury: "luxury",
  modern: "modern",
  minimal: "minimal",
  heritage: "heritage",
  eco: "eco",
  trade: "trade",
  corporate: "corporate",
  industrial: "industrial",
};
for (const b of loftLadderBanners) {
  const archetype = BRAND_MAP[b.brand_personality] ?? "corporate";
  brandDna.reinforce(archetype, 0.02, `${b.banner_id} · ${b.theme_pack} · original=${b.brand_personality}`, b.url);
}

// ─── Object Relationship Library · loft ladder taxonomy ───────────────

assertRelationship({ from_object_id: "LOFT_LADDER", kind: "requires", to_object_id: "LOFT_HATCH", confidence: 0.98, reason: "loft ladders require a compatible hatch" });
assertRelationship({ from_object_id: "LOFT_HATCH", kind: "mounted_in", to_object_id: "CEILING", confidence: 0.99, reason: "hatch fits into ceiling opening" });
assertRelationship({ from_object_id: "CEILING", kind: "inside", to_object_id: "ROOM", confidence: 1.0, reason: "spatial containment" });
assertRelationship({ from_object_id: "LOFT_LADDER", kind: "used_for", to_object_id: "loft_access", confidence: 1.0 });
assertRelationship({ from_object_id: "LOFT_LADDER", kind: "compatible_with", to_object_id: "LOFT_HANDRAIL", confidence: 0.9 });
// Staircase relationships
assertRelationship({ from_object_id: "STAIRCASE_TREAD", kind: "supports", to_object_id: "HUMAN_LOAD", confidence: 1.0 });
assertRelationship({ from_object_id: "STAIRCASE_BALUSTER", kind: "supports", to_object_id: "STAIRCASE_HANDRAIL", confidence: 0.99 });
assertRelationship({ from_object_id: "STAIRCASE_HANDRAIL", kind: "connects_to", to_object_id: "STAIRCASE_NEWEL", confidence: 0.99 });
assertRelationship({ from_object_id: "STAIRCASE_TREAD", kind: "mounted_in", to_object_id: "STAIRCASE_STRING", confidence: 0.98 });
assertRelationship({ from_object_id: "STAIRCASE_VOLUTE", kind: "connects_to", to_object_id: "STAIRCASE_HANDRAIL", confidence: 0.95 });

// ─── Campaign Family · plan a full domestic pack from the industrial_black_gold loft ladder ─

const camp = planCampaign({
  campaign_id: "loft_ladder_premium_autumn_2026",
  display_name: "Loft Ladder Premium · Autumn 2026",
  base_design_document_id: "doc_loft_ladder_banner_001",
  product_family: "loft_ladders",
  audience: "luxury_homeowner",
  brand_archetype: "premium",
  theme_pack: "industrial_black_gold",
  pattern_id: "PREMIUM_TRADE_BANNER_V1",
});

// ─── Colour Grammar reverse lookup · what feelings does the theme signal? ─

const feelings = feelingsFromThemePacks(["industrial_black_gold", "modern_blue", "industrial_black_red", "nature_green"]);

// ─── Summary ────────────────────────────────────────────────────────────

console.log("Design Genome seed summary");
console.log("--------------------------");
console.log(`Object Library size (in-memory · demo)      · ${objectCount()}`);
console.log(`Pattern Library size                        · ${patternCount()}`);
console.log(`Pattern PREMIUM_TRADE_BANNER_V1 confidence  · ${patternAfter?.aggregate_confidence.toFixed(3)}`);
console.log(`Pattern PREMIUM_TRADE_BANNER_V1 evidence    · ${patternAfter?.banner_example_asset_ids.length}`);
console.log(`Brand DNA archetypes reinforced             · ${brandDna.all().filter((p) => p.observation_count > 0).length}`);
brandDna.all().filter((p) => p.observation_count > 0).forEach((p) => console.log(`  - ${p.archetype} · confidence ${p.aggregate_confidence.toFixed(2)} · observations ${p.observation_count}`));
console.log(`Object Relationships registered             · ${relCount()}`);
console.log(`Campaign Families planned                   · ${campCount()}`);
console.log(`  - ${camp.campaign_id} · outputs ${camp.outputs.length} channels`);
console.log(`Colour-grammar feelings from 4 loft ladder themes · ${feelings.length}`);
console.log(`  - ${feelings.join(", ")}`);

const now = new Date().toISOString();
const rows = [
  { at: now, kind: "design_genome_seed", staircase_specimens: staircaseSpecimens.length, loft_ladder_banners: loftLadderBanners.length, pattern_confidence: patternAfter?.aggregate_confidence, brand_reinforced: brandDna.all().filter((p) => p.observation_count > 0).length, relationships: relCount(), campaigns: campCount(), feelings_count: feelings.length },
];
fs.appendFileSync(LEARNING_LOG, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`\nAppended ${rows.length} rows to ${path.relative(ROOT, LEARNING_LOG)}`);
