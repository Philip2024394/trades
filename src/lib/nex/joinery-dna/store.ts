// Joinery DNA Library · store + seeds + cross-trade queries.
//
// Doctrine: docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md

import type { JoineryDNAFamily, JoineryTrade, CrossTradeQuery } from "./types";

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

const SEED_FAMILIES: readonly JoineryDNAFamily[] = [
  { family_id: "IN_FRAME_SHAKER", display_name: "In-frame Shaker", component_kind: "cabinet_door", design_language: "in_frame_traditional", trades_it_appears_in: ["kitchen", "wardrobe", "panelling", "door", "cabinet", "staircase"], material_families: ["oak", "walnut", "painted_mdf", "ash"], characteristic_features: ["wide_stiles", "wide_rails", "flat_centre_panel", "traditional_proportions", "face_frame"], incompatible_with: ["CONTEMPORARY_SLAB", "HANDLELESS_MODERN", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "RAISED_PANEL_TRADITIONAL", display_name: "Raised Panel · Traditional", component_kind: "raised_panel", design_language: "traditional_british", trades_it_appears_in: ["staircase", "kitchen", "wardrobe", "panelling", "door", "furniture"], material_families: ["oak", "walnut", "mahogany", "painted"], characteristic_features: ["recessed_field", "raised_centre_panel", "moulded_border"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "OGEE_MOULDING", display_name: "Ogee Moulding", component_kind: "moulding", design_language: "traditional_british", trades_it_appears_in: ["crown_moulding", "architrave", "skirting", "cabinet", "furniture"], material_families: ["oak", "walnut", "painted_mdf", "pine"], characteristic_features: ["s_curve_profile", "double_curved", "traditional"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS", "SQUARE_CONTEMPORARY_PROFILE"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "BULLNOSE_PROFILE", display_name: "Bullnose Profile", component_kind: "edge_profile", design_language: "traditional_british", trades_it_appears_in: ["staircase", "kitchen", "shelf", "window", "cabinet"], material_families: ["oak", "walnut", "ash", "quartz", "solid_timber"], characteristic_features: ["rounded_front_edge", "semi_circular_profile", "traditional_finish"], incompatible_with: ["SQUARE_CONTEMPORARY_PROFILE"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "TURNED_TRADITIONAL", display_name: "Turned Traditional", component_kind: "turned_profile", design_language: "traditional_british", trades_it_appears_in: ["staircase", "furniture", "cabinet"], material_families: ["oak", "walnut", "mahogany", "ash"], characteristic_features: ["lathe_turned", "symmetrical_beads", "decorative_neck", "square_top_bottom"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS", "SQUARE_CONTEMPORARY_PROFILE"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "CROWN_MOULDING_STEPPED", display_name: "Crown Moulding · Stepped", component_kind: "crown_moulding", design_language: "traditional_british", trades_it_appears_in: ["crown_moulding", "kitchen", "wardrobe", "panelling", "staircase", "furniture"], material_families: ["oak", "walnut", "painted_mdf"], characteristic_features: ["multi_step_profile", "deep_shadow_lines", "continuous_wrap"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },

  { family_id: "CONTEMPORARY_SLAB", display_name: "Contemporary Slab", component_kind: "cabinet_door", design_language: "contemporary_minimal", trades_it_appears_in: ["kitchen", "wardrobe", "door", "panelling", "cabinet"], material_families: ["painted", "veneer", "acrylic", "stainless_steel"], characteristic_features: ["flat_slab", "no_frame", "minimal", "european"], incompatible_with: ["IN_FRAME_SHAKER", "RAISED_PANEL_TRADITIONAL", "VICTORIAN_TURNED"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "HANDLELESS_MODERN", display_name: "Handleless Modern", component_kind: "cabinet_door", design_language: "contemporary_minimal", trades_it_appears_in: ["kitchen", "wardrobe", "cabinet"], material_families: ["painted", "veneer", "stainless_steel"], characteristic_features: ["integrated_rail", "push_latch", "gap_pull"], incompatible_with: ["IN_FRAME_SHAKER", "RAISED_PANEL_TRADITIONAL", "TURNED_TRADITIONAL"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "SQUARE_CONTEMPORARY_PROFILE", display_name: "Square Contemporary Profile", component_kind: "edge_profile", design_language: "contemporary_minimal", trades_it_appears_in: ["staircase", "kitchen", "skirting", "architrave", "cabinet"], material_families: ["oak", "painted", "stainless_steel"], characteristic_features: ["sharp_square_edges", "no_moulding", "minimal"], incompatible_with: ["OGEE_MOULDING", "TURNED_TRADITIONAL", "VICTORIAN_TURNED"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "INDUSTRIAL_STAINLESS", display_name: "Industrial Stainless", component_kind: "cabinet_system", design_language: "industrial_stainless", trades_it_appears_in: ["kitchen", "cabinet"], material_families: ["stainless_steel", "brushed_metal"], characteristic_features: ["brushed_stainless", "waterfall_edge", "commercial_grade", "seamless_fabrication"], incompatible_with: ["IN_FRAME_SHAKER", "RAISED_PANEL_TRADITIONAL", "TURNED_TRADITIONAL"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },

  { family_id: "VICTORIAN_TURNED", display_name: "Victorian Turned", component_kind: "turned_profile", design_language: "victorian", trades_it_appears_in: ["staircase", "furniture", "cabinet"], material_families: ["oak", "walnut", "mahogany"], characteristic_features: ["multi_bead_decorative_turning", "waist_turning", "traditional_proportions"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "GEORGIAN_CLASSICAL", display_name: "Georgian Classical", component_kind: "architectural_joinery", design_language: "georgian", trades_it_appears_in: ["door", "window", "panelling", "staircase", "furniture"], material_families: ["oak", "walnut", "mahogany", "painted"], characteristic_features: ["symmetrical_proportions", "fielded_panels", "astragal_glazing", "classical_pilasters"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "BEADED_FACE_FRAME", display_name: "Beaded Face Frame", component_kind: "face_frame", design_language: "in_frame_traditional", trades_it_appears_in: ["kitchen", "wardrobe", "furniture", "cabinet"], material_families: ["oak", "walnut", "painted_mdf"], characteristic_features: ["face_frame_with_bead_detail", "in_frame_construction", "traditional"], incompatible_with: ["CONTEMPORARY_SLAB", "HANDLELESS_MODERN"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "PIGS_EAR_PROFILE", display_name: "Pig's Ear Profile", component_kind: "handrail_profile", design_language: "traditional_british", trades_it_appears_in: ["staircase", "shelf"], material_families: ["oak", "walnut"], characteristic_features: ["half_round_wall_mounted", "d_shape_profile"], incompatible_with: ["SQUARE_CONTEMPORARY_PROFILE"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },

  { family_id: "CHAMFERED_MODERN_TRADITIONAL", display_name: "Chamfered Modern Traditional", component_kind: "edge_profile", design_language: "modern_traditional", trades_it_appears_in: ["staircase", "furniture", "panelling", "cabinet"], material_families: ["oak", "walnut", "painted"], characteristic_features: ["stop_chamfered_edges", "clean_transition", "restrained_ornament"], incompatible_with: [], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "FLUTED_COLUMN", display_name: "Fluted Column", component_kind: "column_profile", design_language: "classical", trades_it_appears_in: ["staircase", "furniture", "panelling", "cabinet"], material_families: ["oak", "walnut", "painted"], characteristic_features: ["vertical_grooves", "classical_proportions", "decorative"], incompatible_with: ["CONTEMPORARY_SLAB", "INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "TONGUE_AND_GROOVE_PANELLING", display_name: "Tongue and Groove Panelling", component_kind: "wall_panelling", design_language: "cottage_traditional", trades_it_appears_in: ["panelling", "door"], material_families: ["oak", "pine", "painted_mdf"], characteristic_features: ["vertical_or_horizontal_slats", "tongue_and_groove_joint", "traditional_cladding"], incompatible_with: ["INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "RAISED_FIELD_PANEL_LARGE_FORMAT", display_name: "Raised Field Panel · Large Format", component_kind: "raised_panel", design_language: "georgian", trades_it_appears_in: ["door", "wardrobe", "panelling", "furniture"], material_families: ["oak", "walnut", "mahogany", "painted"], characteristic_features: ["oversized_raised_panel", "heavy_moulded_border", "formal"], incompatible_with: ["CONTEMPORARY_SLAB", "HANDLELESS_MODERN"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },

  { family_id: "WARM_WALNUT_LUXURY", display_name: "Warm Walnut · Luxury", component_kind: "material_finish", design_language: "luxury_heritage", trades_it_appears_in: ["kitchen", "wardrobe", "staircase", "furniture", "panelling", "cabinet"], material_families: ["walnut"], characteristic_features: ["book_matched_grain", "satin_lacquer", "furniture_grade_finish", "warm_chocolate_tone"], incompatible_with: ["INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
  { family_id: "NATURAL_OAK_HERITAGE", display_name: "Natural Oak · Heritage", component_kind: "material_finish", design_language: "heritage_traditional", trades_it_appears_in: ["staircase", "kitchen", "panelling", "door", "furniture", "cabinet"], material_families: ["oak"], characteristic_features: ["european_oak", "natural_satin", "visible_cathedral_grain", "warm_golden_tone"], incompatible_with: ["INDUSTRIAL_STAINLESS"], observation_count: 0, aggregate_confidence: 0.5, evidence_asset_ids: [], history: [], provenance: { named_expert: PHILIP, authored: AUTHORED } },
];

const STORE = new Map<string, JoineryDNAFamily>(SEED_FAMILIES.map((f) => [f.family_id, { ...f, evidence_asset_ids: [], history: [], observation_count: 0, aggregate_confidence: 0.5 }]));

export function reset(): void {
  STORE.clear();
  for (const f of SEED_FAMILIES) STORE.set(f.family_id, { ...f, evidence_asset_ids: [], history: [], observation_count: 0, aggregate_confidence: 0.5 });
}

export function get(family_id: string): JoineryDNAFamily | undefined { return STORE.get(family_id); }
export function all(): readonly JoineryDNAFamily[] { return Array.from(STORE.values()); }
export function count(): number { return STORE.size; }

/** Reinforce a joinery family from a new specimen · cross-trade reinforcement is
 *  the whole point (a kitchen upload AND a staircase upload both strengthen
 *  IN_FRAME_SHAKER if both share the language). */
export function reinforce(family_id: string, delta: number, reason: string, trade: JoineryTrade, evidence_asset_id?: string): JoineryDNAFamily {
  const existing = STORE.get(family_id);
  if (!existing) throw new Error(`Unknown joinery family: ${family_id}`);
  const cappedDelta = Math.max(0, Math.min(delta, 1 - existing.aggregate_confidence));
  const evidence = evidence_asset_id && !existing.evidence_asset_ids.includes(evidence_asset_id)
    ? [...existing.evidence_asset_ids, evidence_asset_id]
    : existing.evidence_asset_ids;
  const entry = { at: new Date().toISOString(), delta: cappedDelta, reason, evidence: evidence_asset_id, trade };
  const next: JoineryDNAFamily = {
    ...existing,
    observation_count: existing.observation_count + 1,
    aggregate_confidence: existing.aggregate_confidence + cappedDelta,
    evidence_asset_ids: evidence,
    history: [...existing.history, entry],
  };
  STORE.set(family_id, next);
  return next;
}

export function familiesForTrade(trade: JoineryTrade): readonly JoineryDNAFamily[] {
  return all().filter((f) => f.trades_it_appears_in.includes(trade));
}

export function familiesForDesignLanguage(design_language: string): readonly JoineryDNAFamily[] {
  return all().filter((f) => f.design_language === design_language);
}

/** Return families that appear across EVERY trade in the input list. This is
 *  the cross-trade coherence lookup — what design language recurs across the
 *  whole home? */
export function sharedFamiliesAcross(trades: readonly JoineryTrade[]): readonly JoineryDNAFamily[] {
  return all().filter((f) => trades.every((t) => f.trades_it_appears_in.includes(t)));
}

export function query(q: CrossTradeQuery): readonly JoineryDNAFamily[] {
  return all().filter((f) => {
    if (q.trades && !q.trades.every((t) => f.trades_it_appears_in.includes(t))) return false;
    if (q.design_language && f.design_language !== q.design_language) return false;
    if (q.material && !f.material_families.includes(q.material)) return false;
    if (q.min_confidence !== undefined && f.aggregate_confidence < q.min_confidence) return false;
    return true;
  });
}

/** Detect incompatible families in a proposed set · used by Recommendation Engine
 *  to warn on incoherent whole-home selections. */
export function detectClashes(family_ids: readonly string[]): readonly { a: string; b: string; reason: string }[] {
  const clashes: { a: string; b: string; reason: string }[] = [];
  for (let i = 0; i < family_ids.length; i++) {
    const a = STORE.get(family_ids[i]);
    if (!a) continue;
    for (let j = i + 1; j < family_ids.length; j++) {
      const b = STORE.get(family_ids[j]);
      if (!b) continue;
      if (a.incompatible_with.includes(b.family_id) || b.incompatible_with.includes(a.family_id)) {
        clashes.push({ a: a.family_id, b: b.family_id, reason: `${a.display_name} clashes with ${b.display_name}` });
      }
    }
  }
  return clashes;
}
