// Material Genome Library · seed + store + cross-trade queries.
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

import type { MaterialDNA, MaterialTrade, MaterialQuery, Suitability, Substitution, SubstitutionKind } from "./types";
import { SEED_SUBSTITUTIONS } from "./substitutions";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

const SUITABILITY_RANK: Record<Suitability, number> = { avoid: 0, acceptable: 1, good: 2, excellent: 3 };

const SEED: readonly MaterialDNA[] = [
  // ─── Timbers ─────────────────────────────────────────────────────────
  {
    material_id: "oak_american_white_satin_lacquer",
    display_name: "American White Oak · satin lacquer",
    category: "timber",
    physics_ref: "oak_american_white_satin_lacquer",
    intelligence_ref: "oak_american_white_satin_lacquer",
    grain_character: "cathedral grain · quarter and crown grain · warm golden tones · visible ray-flecks on quartered stock",
    stain_response: ["takes_stain_evenly", "receives_dark_stain_well"],
    machining_ease: "moderate",
    durability_score: 88,
    uv_ageing_narrative: "gentle amber deepening over 10 years · never bleaches",
    moisture_movement_class: "medium",
    repairability_score: 92,
    sustainability_score: 88,
    premium_level: 4,
    compatible_finishes: ["satin_lacquer", "hardwax_oil", "matt_polyurethane", "natural_oil", "clear_wax"],
    recommended_applications: [
      { trade: "staircase", suitability: "excellent" },
      { trade: "kitchen", suitability: "excellent", note: "worktop · cabinet · island" },
      { trade: "flooring", suitability: "excellent" },
      { trade: "door", suitability: "excellent" },
      { trade: "furniture", suitability: "excellent" },
      { trade: "panelling", suitability: "excellent" },
      { trade: "wardrobe", suitability: "good" },
      { trade: "handrail", suitability: "excellent" },
      { trade: "worktop", suitability: "excellent", note: "requires 6-monthly re-oiling" },
    ],
    pairs_well_with: ["brass_polished", "quartz_worktop_white", "paint_matt_emulsion_white_shaker", "porcelain_grey_large_format"],
    avoid_pairing_with: ["stainless_steel_brushed"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "european_walnut_matt_lacquer",
    display_name: "European Walnut · matt lacquer",
    category: "timber",
    physics_ref: "european_walnut_matt_lacquer",
    intelligence_ref: "european_walnut_matt_lacquer",
    grain_character: "wavy interlocked grain · rich chocolate brown · book-matched panels reveal symmetric grain figure",
    stain_response: ["receives_dark_stain_well", "takes_stain_evenly"],
    machining_ease: "moderate",
    durability_score: 84,
    uv_ageing_narrative: "cool undertones warm to reddish-brown over decades",
    moisture_movement_class: "medium",
    repairability_score: 88,
    sustainability_score: 78,
    premium_level: 5,
    compatible_finishes: ["matt_lacquer", "hardwax_oil", "wax", "satin_lacquer"],
    recommended_applications: [
      { trade: "kitchen", suitability: "excellent", note: "luxury in-frame + island tops" },
      { trade: "staircase", suitability: "excellent", note: "closed-box fascia · mono-string treads" },
      { trade: "wardrobe", suitability: "excellent" },
      { trade: "furniture", suitability: "excellent" },
      { trade: "panelling", suitability: "excellent", note: "book-matched large panels" },
      { trade: "door", suitability: "good" },
      { trade: "flooring", suitability: "acceptable", note: "premium but soft under heavy traffic" },
    ],
    pairs_well_with: ["brass_polished", "quartz_worktop_white", "porcelain_grey_large_format"],
    avoid_pairing_with: ["stainless_steel_brushed"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "scandinavian_pine",
    display_name: "Scandinavian Pine",
    category: "timber",
    physics_ref: "scandinavian_pine",
    intelligence_ref: "scandinavian_pine",
    grain_character: "straight grain · pale cream tone · visible knots · light natural resin",
    stain_response: ["tends_to_blotch", "receives_pigmented_stain_well"],
    machining_ease: "easy",
    durability_score: 55,
    uv_ageing_narrative: "significant yellowing without UV-blocking finish",
    moisture_movement_class: "high",
    repairability_score: 75,
    sustainability_score: 92,
    premium_level: 2,
    compatible_finishes: ["natural_oil", "paint", "clear_wax", "matt_lacquer"],
    recommended_applications: [
      { trade: "staircase", suitability: "acceptable", note: "budget / paint-grade" },
      { trade: "furniture", suitability: "good" },
      { trade: "panelling", suitability: "excellent", note: "tongue-and-groove cladding" },
      { trade: "cabinet", suitability: "acceptable" },
      { trade: "flooring", suitability: "acceptable" },
    ],
    pairs_well_with: ["paint_matt_emulsion_white_shaker"],
    avoid_pairing_with: ["european_walnut_matt_lacquer"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "mahogany_polished",
    display_name: "Mahogany · high polish",
    category: "timber",
    physics_ref: "mahogany_polished",
    intelligence_ref: "mahogany_polished",
    grain_character: "interlocked grain · reddish-brown · high natural lustre when polished",
    stain_response: ["receives_dark_stain_well"],
    machining_ease: "moderate",
    durability_score: 86,
    uv_ageing_narrative: "moderate darkening over decades",
    moisture_movement_class: "medium",
    repairability_score: 82,
    sustainability_score: 60,
    premium_level: 5,
    compatible_finishes: ["polish", "satin_lacquer", "wax", "hardwax_oil"],
    recommended_applications: [
      { trade: "staircase", suitability: "excellent", note: "heritage grand entrance" },
      { trade: "furniture", suitability: "excellent" },
      { trade: "panelling", suitability: "excellent" },
      { trade: "door", suitability: "excellent" },
    ],
    pairs_well_with: ["brass_polished"],
    avoid_pairing_with: ["stainless_steel_brushed"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "ash_white",
    display_name: "White Ash",
    category: "timber",
    physics_ref: "ash_white",
    intelligence_ref: "ash_white",
    grain_character: "pronounced open grain · pale cream · high strength · resilient",
    stain_response: ["takes_stain_evenly"],
    machining_ease: "moderate",
    durability_score: 82,
    uv_ageing_narrative: "minimal ageing · retains pale colour",
    moisture_movement_class: "medium",
    repairability_score: 88,
    sustainability_score: 85,
    premium_level: 3,
    compatible_finishes: ["satin_lacquer", "hardwax_oil", "paint"],
    recommended_applications: [
      { trade: "staircase", suitability: "excellent", note: "resilient treads" },
      { trade: "flooring", suitability: "excellent" },
      { trade: "furniture", suitability: "excellent" },
      { trade: "cabinet", suitability: "good" },
    ],
    pairs_well_with: ["brass_polished", "paint_matt_emulsion_white_shaker"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  // ─── Metals ─────────────────────────────────────────────────────────
  {
    material_id: "steel_black_powder_coated",
    display_name: "Steel · black powder coated",
    category: "metal",
    physics_ref: "steel_black_powder_coated",
    intelligence_ref: "steel_black_powder_coated",
    grain_character: "matt black surface · smooth industrial texture",
    machining_ease: "requires_carbide",
    durability_score: 96,
    uv_ageing_narrative: "powder coat holds colour well · chips repair-only",
    moisture_movement_class: "low",
    repairability_score: 40,
    sustainability_score: 55,
    premium_level: 3,
    compatible_finishes: ["powder_coat", "wet_paint"],
    recommended_applications: [
      { trade: "staircase", suitability: "excellent", note: "mono-string · balustrade" },
      { trade: "handrail", suitability: "good" },
      { trade: "furniture", suitability: "good" },
      { trade: "cabinet", suitability: "acceptable" },
    ],
    pairs_well_with: ["european_walnut_matt_lacquer", "glass_toughened_10mm", "concrete_polished"],
    avoid_pairing_with: ["brass_polished"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "brass_polished",
    display_name: "Brass · polished",
    category: "metal",
    physics_ref: "brass_polished",
    intelligence_ref: "brass_polished",
    grain_character: "warm yellow · high lustre · develops rich patina if unlacquered",
    machining_ease: "moderate",
    durability_score: 90,
    uv_ageing_narrative: "develops rich brown/verdigris patina if unlacquered",
    moisture_movement_class: "low",
    repairability_score: 78,
    sustainability_score: 65,
    premium_level: 4,
    compatible_finishes: ["polish", "antique_brass", "brushed_brass", "lacquer"],
    recommended_applications: [
      { trade: "kitchen", suitability: "excellent", note: "hardware · tap · pendant fittings" },
      { trade: "staircase", suitability: "good", note: "handrail brackets · decorative newel rings" },
      { trade: "door", suitability: "excellent", note: "handles · hinges" },
      { trade: "furniture", suitability: "good" },
    ],
    pairs_well_with: ["oak_american_white_satin_lacquer", "european_walnut_matt_lacquer", "mahogany_polished", "quartz_worktop_white", "paint_matt_emulsion_white_shaker"],
    avoid_pairing_with: ["steel_black_powder_coated", "stainless_steel_brushed"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "aluminium_anodised",
    display_name: "Aluminium · anodised",
    category: "metal",
    physics_ref: "aluminium_anodised",
    intelligence_ref: "aluminium_anodised",
    machining_ease: "moderate",
    durability_score: 88,
    moisture_movement_class: "low",
    repairability_score: 55,
    sustainability_score: 72,
    premium_level: 3,
    compatible_finishes: ["anodised", "powder_coat"],
    recommended_applications: [
      { trade: "kitchen", suitability: "good", note: "window/door frames" },
      { trade: "cabinet", suitability: "acceptable" },
      { trade: "door", suitability: "excellent" },
    ],
    pairs_well_with: ["glass_toughened_10mm", "concrete_polished"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "stainless_steel_brushed",
    display_name: "Stainless Steel · brushed",
    category: "metal",
    machining_ease: "requires_carbide",
    durability_score: 95,
    uv_ageing_narrative: "stable · no ageing",
    moisture_movement_class: "low",
    repairability_score: 60,
    sustainability_score: 65,
    premium_level: 4,
    compatible_finishes: ["brushed", "polished", "electropolished"],
    recommended_applications: [
      { trade: "kitchen", suitability: "excellent", note: "commercial / industrial style · worktops · splashback · appliances" },
      { trade: "worktop", suitability: "excellent" },
      { trade: "splashback", suitability: "excellent" },
      { trade: "cabinet", suitability: "excellent" },
      { trade: "handrail", suitability: "excellent" },
    ],
    pairs_well_with: ["concrete_polished", "porcelain_grey_large_format", "glass_toughened_10mm"],
    avoid_pairing_with: ["oak_american_white_satin_lacquer", "european_walnut_matt_lacquer", "brass_polished"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  // ─── Glass ──────────────────────────────────────────────────────────
  {
    material_id: "glass_toughened_10mm",
    display_name: "Toughened Glass · 10mm",
    category: "glass",
    physics_ref: "glass_toughened_10mm",
    intelligence_ref: "glass_toughened_10mm",
    machining_ease: "difficult",
    durability_score: 85,
    uv_ageing_narrative: "stable · no ageing",
    moisture_movement_class: "low",
    repairability_score: 20,
    sustainability_score: 78,
    premium_level: 4,
    compatible_finishes: ["clear", "fluted", "ribbed", "sandblasted", "back_painted"],
    recommended_applications: [
      { trade: "staircase", suitability: "excellent", note: "balustrade" },
      { trade: "kitchen", suitability: "excellent", note: "display cabinet doors · splashback" },
      { trade: "cabinet", suitability: "excellent" },
      { trade: "splashback", suitability: "excellent" },
    ],
    pairs_well_with: ["stainless_steel_brushed", "steel_black_powder_coated", "aluminium_anodised", "european_walnut_matt_lacquer"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  // ─── Stone / Composite ──────────────────────────────────────────────
  {
    material_id: "quartz_worktop_white",
    display_name: "Engineered Quartz Worktop · white",
    category: "composite",
    physics_ref: "quartz_worktop",
    intelligence_ref: "quartz_worktop",
    machining_ease: "difficult",
    durability_score: 92,
    uv_ageing_narrative: "stable · minor yellowing possible over decades in direct sun",
    moisture_movement_class: "low",
    repairability_score: 45,
    sustainability_score: 60,
    premium_level: 4,
    compatible_finishes: ["polished", "matt", "leathered"],
    recommended_applications: [
      { trade: "worktop", suitability: "excellent" },
      { trade: "splashback", suitability: "excellent" },
      { trade: "kitchen", suitability: "excellent" },
    ],
    pairs_well_with: ["oak_american_white_satin_lacquer", "european_walnut_matt_lacquer", "paint_matt_emulsion_white_shaker", "brass_polished"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "granite_black",
    display_name: "Black Granite",
    category: "stone",
    physics_ref: "granite_black",
    intelligence_ref: "granite_black",
    machining_ease: "difficult",
    durability_score: 94,
    uv_ageing_narrative: "stable · no ageing",
    moisture_movement_class: "low",
    repairability_score: 40,
    sustainability_score: 55,
    premium_level: 4,
    compatible_finishes: ["polished", "honed", "leathered"],
    recommended_applications: [
      { trade: "worktop", suitability: "excellent" },
      { trade: "flooring", suitability: "excellent" },
      { trade: "splashback", suitability: "good" },
      { trade: "kitchen", suitability: "excellent" },
    ],
    pairs_well_with: ["oak_american_white_satin_lacquer", "european_walnut_matt_lacquer", "brass_polished"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "porcelain_grey_large_format",
    display_name: "Porcelain · large format · grey concrete look",
    category: "porcelain",
    machining_ease: "difficult",
    durability_score: 92,
    uv_ageing_narrative: "stable · no ageing",
    moisture_movement_class: "low",
    repairability_score: 30,
    sustainability_score: 70,
    premium_level: 3,
    compatible_finishes: ["matt", "polished", "textured", "concrete_look", "stone_look"],
    recommended_applications: [
      { trade: "flooring", suitability: "excellent" },
      { trade: "cladding", suitability: "excellent" },
      { trade: "splashback", suitability: "good" },
      { trade: "kitchen", suitability: "excellent", note: "large-format flooring compatible with every kitchen style" },
    ],
    pairs_well_with: ["oak_american_white_satin_lacquer", "paint_matt_emulsion_white_shaker", "european_walnut_matt_lacquer", "brass_polished", "stainless_steel_brushed"],
    avoid_pairing_with: [],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  // ─── Paint / Concrete ───────────────────────────────────────────────
  {
    material_id: "paint_matt_emulsion_white_shaker",
    display_name: "Paint · matt emulsion · shaker white",
    category: "paint",
    physics_ref: undefined,
    intelligence_ref: "paint_matt_emulsion_white",
    machining_ease: "easy",
    durability_score: 65,
    uv_ageing_narrative: "may yellow slightly on unlit north-facing walls · repaintable",
    moisture_movement_class: "low",
    repairability_score: 95,
    sustainability_score: 60,
    premium_level: 3,
    compatible_finishes: ["matt", "eggshell", "satin", "gloss"],
    recommended_applications: [
      { trade: "cabinet", suitability: "excellent", note: "shaker doors + face frames" },
      { trade: "wardrobe", suitability: "excellent" },
      { trade: "door", suitability: "excellent" },
      { trade: "panelling", suitability: "excellent" },
      { trade: "kitchen", suitability: "excellent" },
    ],
    pairs_well_with: ["oak_american_white_satin_lacquer", "quartz_worktop_white", "brass_polished", "porcelain_grey_large_format"],
    avoid_pairing_with: ["stainless_steel_brushed"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.6,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "concrete_polished",
    display_name: "Polished Concrete",
    category: "concrete",
    physics_ref: "concrete_polished",
    intelligence_ref: "concrete_polished",
    machining_ease: "difficult",
    durability_score: 90,
    uv_ageing_narrative: "may develop hairline cracks · gains character with age",
    moisture_movement_class: "low",
    repairability_score: 45,
    sustainability_score: 65,
    premium_level: 3,
    compatible_finishes: ["polished", "honed", "sealed_matt"],
    recommended_applications: [
      { trade: "flooring", suitability: "excellent", note: "industrial style" },
      { trade: "worktop", suitability: "good", note: "bespoke cast" },
      { trade: "cladding", suitability: "good" },
    ],
    pairs_well_with: ["steel_black_powder_coated", "stainless_steel_brushed", "european_walnut_matt_lacquer"],
    avoid_pairing_with: ["brass_polished"],
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: 0.55,
    evidence_asset_ids: [],
    history: [],
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
];

function withSubs(m: MaterialDNA): MaterialDNA {
  const subs = SEED_SUBSTITUTIONS[m.material_id];
  return {
    ...m,
    trades_it_appears_in: [],
    observation_count: 0,
    aggregate_confidence: m.aggregate_confidence,
    evidence_asset_ids: [],
    history: [],
    substitutions: subs ?? m.substitutions ?? [],
  };
}

const STORE = new Map<string, MaterialDNA>(SEED.map((m) => [m.material_id, withSubs(m)]));

export function reset(): void {
  STORE.clear();
  for (const m of SEED) STORE.set(m.material_id, withSubs(m));
}

export function get(material_id: string): MaterialDNA | undefined { return STORE.get(material_id); }
export function all(): readonly MaterialDNA[] { return Array.from(STORE.values()); }
export function count(): number { return STORE.size; }

export function reinforce(material_id: string, trade: MaterialTrade, delta: number, reason: string, evidence_asset_id?: string): MaterialDNA {
  const existing = STORE.get(material_id);
  if (!existing) throw new Error(`Unknown MaterialDNA: ${material_id}`);
  const cappedDelta = Math.max(0, Math.min(delta, 1 - existing.aggregate_confidence));
  const evidence = evidence_asset_id && !existing.evidence_asset_ids.includes(evidence_asset_id)
    ? [...existing.evidence_asset_ids, evidence_asset_id]
    : existing.evidence_asset_ids;
  const trades = existing.trades_it_appears_in.includes(trade)
    ? existing.trades_it_appears_in
    : [...existing.trades_it_appears_in, trade];
  const next: MaterialDNA = {
    ...existing,
    observation_count: existing.observation_count + 1,
    aggregate_confidence: existing.aggregate_confidence + cappedDelta,
    evidence_asset_ids: evidence,
    trades_it_appears_in: trades,
    history: [...existing.history, { at: new Date().toISOString(), delta: cappedDelta, reason, evidence: evidence_asset_id, trade }],
  };
  STORE.set(material_id, next);
  return next;
}

function suitabilityMeets(actual: Suitability, min: Suitability): boolean {
  return SUITABILITY_RANK[actual] >= SUITABILITY_RANK[min];
}

export function materialsForTrade(trade: MaterialTrade, min_suitability: Suitability = "good"): readonly MaterialDNA[] {
  return all().filter((m) =>
    m.recommended_applications.some((a) => a.trade === trade && suitabilityMeets(a.suitability, min_suitability))
  );
}

export function materialsForPremiumLevel(level: 1 | 2 | 3 | 4 | 5): readonly MaterialDNA[] {
  return all().filter((m) => m.premium_level >= level);
}

export function pairsWith(material_id: string): readonly MaterialDNA[] {
  const source = STORE.get(material_id);
  if (!source) return [];
  return source.pairs_well_with.map((id) => STORE.get(id)).filter((m): m is MaterialDNA => m !== undefined);
}

export function materialsCompatibleWithFinish(finish: string): readonly MaterialDNA[] {
  return all().filter((m) => m.compatible_finishes.includes(finish));
}

export function mostRepairable(threshold: number = 80): readonly MaterialDNA[] {
  return all().filter((m) => m.repairability_score >= threshold).sort((a, b) => b.repairability_score - a.repairability_score);
}

export function mostSustainable(threshold: number = 80): readonly MaterialDNA[] {
  return all().filter((m) => m.sustainability_score >= threshold).sort((a, b) => b.sustainability_score - a.sustainability_score);
}

export function query(q: MaterialQuery): readonly MaterialDNA[] {
  return all().filter((m) => {
    if (q.category && m.category !== q.category) return false;
    if (q.min_premium_level !== undefined && m.premium_level < q.min_premium_level) return false;
    if (q.finish && !m.compatible_finishes.includes(q.finish)) return false;
    if (q.min_repairability !== undefined && m.repairability_score < q.min_repairability) return false;
    if (q.min_sustainability !== undefined && m.sustainability_score < q.min_sustainability) return false;
    if (q.trades && q.trades.length > 0) {
      const min = q.min_suitability ?? "good";
      const covers = q.trades.every((t) => m.recommended_applications.some((a) => a.trade === t && suitabilityMeets(a.suitability, min)));
      if (!covers) return false;
    }
    return true;
  });
}

// Philip 2026-08-04 · Substitutions ── fourth relationship type.
export function substitutionsFor(material_id: string): readonly Substitution[] {
  return STORE.get(material_id)?.substitutions ?? [];
}

export function substitute(material_id: string, kind: SubstitutionKind): Substitution | undefined {
  return substitutionsFor(material_id).find((s) => s.kind === kind);
}

// Philip 2026-08-04 · Explanation stage · pipeline turns evidence into prose.
//   query → pairsWith → clash detection → explanation → recommendation
//
// Trust is built here: the user sees WHY european_walnut is recommended
// (application suitability + observed pairings + no significant clashes)
// rather than a black-box score.
export type ExplainInput = {
  material_id: string;
  trades?: readonly MaterialTrade[];
  intended_pairings?: readonly string[];
  budget_conscious?: boolean;
  sustainability_focused?: boolean;
};

export type Explanation = {
  material_id: string;
  display_name: string;
  prose: string;
  bullets: readonly string[];
  clashes: readonly { a: string; b: string; reason: string }[];
  substitution_notes: readonly string[];
};

export function explainRecommendation(input: ExplainInput): Explanation {
  const m = STORE.get(input.material_id);
  if (!m) throw new Error(`Unknown MaterialDNA: ${input.material_id}`);

  const bullets: string[] = [];

  // 1 · Suitability evidence per requested trade.
  const trades = input.trades ?? [];
  for (const t of trades) {
    const app = m.recommended_applications.find((a) => a.trade === t);
    if (app) {
      const note = app.note ? ` (${app.note})` : "";
      bullets.push(`${app.suitability} suitability for ${t}${note}`);
    } else {
      bullets.push(`no observed use for ${t} · use with caution`);
    }
  }

  // 2 · Observation-count evidence (compounding learning).
  if (m.observation_count > 0) {
    const tradesSeen = m.trades_it_appears_in.join(" · ");
    bullets.push(`observed ${m.observation_count}× across ${m.trades_it_appears_in.length} trade${m.trades_it_appears_in.length === 1 ? "" : "s"}${tradesSeen ? ` (${tradesSeen})` : ""}`);
  }

  // 3 · Pairing evidence.
  const pairings = input.intended_pairings ?? [];
  const positivePairs: string[] = [];
  const clashes: { a: string; b: string; reason: string }[] = [];
  for (const p of pairings) {
    const partner = STORE.get(p);
    if (!partner) continue;
    if (m.pairs_well_with.includes(p) || partner.pairs_well_with.includes(m.material_id)) {
      positivePairs.push(partner.display_name);
    }
    if (m.avoid_pairing_with.includes(p) || partner.avoid_pairing_with.includes(m.material_id)) {
      clashes.push({ a: m.material_id, b: p, reason: `${m.display_name} + ${partner.display_name} · avoid_pairing_with` });
    }
  }
  if (positivePairs.length > 0) bullets.push(`complements ${positivePairs.join(" · ")}`);
  if (clashes.length === 0 && pairings.length > 0) bullets.push(`no significant material conflicts for this combination`);
  for (const c of clashes) bullets.push(`⚠ ${c.reason}`);

  // 4 · Durability / repairability evidence when strong.
  if (m.durability_score >= 85) bullets.push(`durability score ${m.durability_score}/100`);
  if (m.repairability_score >= 85) bullets.push(`repairability score ${m.repairability_score}/100`);
  if (m.sustainability_score >= 85) bullets.push(`sustainability score ${m.sustainability_score}/100`);

  // 5 · Substitution guidance when the user cares.
  const substitution_notes: string[] = [];
  if (input.budget_conscious) {
    const alt = substitute(m.material_id, "economical");
    if (alt) {
      const target = STORE.get(alt.material_id);
      substitution_notes.push(`If budget is a concern, ${target?.display_name ?? alt.material_id} · ${alt.reason}${alt.trade_off ? ` Trade-off: ${alt.trade_off}` : ""}`);
    }
  }
  if (input.sustainability_focused) {
    const alt = substitute(m.material_id, "sustainable");
    if (alt) {
      const target = STORE.get(alt.material_id);
      substitution_notes.push(`For a lower-impact spec, ${target?.display_name ?? alt.material_id} · ${alt.reason}${alt.trade_off ? ` Trade-off: ${alt.trade_off}` : ""}`);
    }
  }

  const prose = `${m.display_name} is recommended because: ${bullets.join(", ")}.` + (substitution_notes.length > 0 ? " " + substitution_notes.join(" ") : "");

  return {
    material_id: m.material_id,
    display_name: m.display_name,
    prose,
    bullets,
    clashes,
    substitution_notes,
  };
}

/** Detect incompatible material pairings for whole-home coherence checks. */
export function detectPairingClashes(material_ids: readonly string[]): readonly { a: string; b: string; reason: string }[] {
  const out: { a: string; b: string; reason: string }[] = [];
  for (let i = 0; i < material_ids.length; i++) {
    const a = STORE.get(material_ids[i]);
    if (!a) continue;
    for (let j = i + 1; j < material_ids.length; j++) {
      const b = STORE.get(material_ids[j]);
      if (!b) continue;
      if (a.avoid_pairing_with.includes(b.material_id) || b.avoid_pairing_with.includes(a.material_id)) {
        out.push({ a: a.material_id, b: b.material_id, reason: `${a.display_name} + ${b.display_name} · avoid_pairing_with` });
      }
    }
  }
  return out;
}
