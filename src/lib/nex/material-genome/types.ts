// Material Genome Library · types (Philip 2026-08-04 · 10th Design Genome library).
//
// Composes material-platform/catalog.ts + material-platform/physics.ts into a
// single queryable DNA object · adds cross-trade dimensions + reinforcement +
// design intelligence (premium_level · repairability · sustainability · grain
// character narrative · recommended applications · coherent pairings).
//
// Doctrine: docs/brains/nex-material-genome-tenth-library-philip-2026-08-04.md

export type MaterialTrade =
  | "staircase" | "kitchen" | "door" | "wardrobe" | "furniture" | "flooring"
  | "panelling" | "worktop" | "cabinet" | "splashback" | "handrail" | "cladding";

export type MaterialCategory =
  | "timber" | "metal" | "glass" | "stone" | "composite"
  | "paint" | "porcelain" | "concrete" | "textile";

export type MachiningEase = "easy" | "moderate" | "difficult" | "requires_carbide";
export type MoistureMovementClass = "low" | "medium" | "high";
export type Suitability = "excellent" | "good" | "acceptable" | "avoid";
export type StainResponseTag = "takes_stain_evenly" | "tends_to_blotch" | "resists_stain" | "receives_dark_stain_well" | "receives_pigmented_stain_well";

export type ApplicationRecommendation = {
  trade: MaterialTrade;
  suitability: Suitability;
  note?: string;
};

// Philip 2026-08-04 · substitutions as a fourth relationship type · beyond
// suitability / pairings / clashes. Enables budget-conscious guidance and
// alternative-recommendation phrasing ("If budget is a concern, stained oak
// preserves much of the visual character while reducing cost").
export type SubstitutionKind = "premium" | "economical" | "sustainable" | "appearance" | "durability";

export type Substitution = {
  kind: SubstitutionKind;
  material_id: string;              // target material_id in this library
  reason: string;                   // human-readable rationale (goes into explanations)
  trade_off?: string;               // what the user loses when substituting
};

export type MaterialDNA = {
  material_id: string;                     // references material-platform catalog id · also serves as the DNA id
  display_name: string;
  category: MaterialCategory;

  // Composed references (never mutated · read-only pointers to material-platform)
  physics_ref?: string;                    // material-platform physics id
  intelligence_ref?: string;               // material-platform catalog id

  // Design intelligence (Philip 2026-08-04 additions)
  grain_character?: string;
  stain_response?: readonly StainResponseTag[];
  machining_ease?: MachiningEase;
  durability_score: number;                // 0-100
  uv_ageing_narrative?: string;
  moisture_movement_class: MoistureMovementClass;
  repairability_score: number;             // 0-100
  sustainability_score: number;            // 0-100
  premium_level: 1 | 2 | 3 | 4 | 5;
  compatible_finishes: readonly string[];
  recommended_applications: readonly ApplicationRecommendation[];

  // Cross-trade coherence
  pairs_well_with: readonly string[];
  avoid_pairing_with: readonly string[];

  // Philip 2026-08-04 · fourth relationship type · substitutions.
  substitutions?: readonly Substitution[];

  // Growing intelligence
  trades_it_appears_in: readonly MaterialTrade[];
  observation_count: number;
  aggregate_confidence: number;
  evidence_asset_ids: readonly string[];
  history: readonly { at: string; delta: number; reason: string; evidence?: string; trade?: MaterialTrade }[];

  provenance: { named_expert: string; authored: string };
};

export type MaterialQuery = {
  trades?: readonly MaterialTrade[];       // returns materials with EVERY listed trade suitability
  min_suitability?: Suitability;           // treated as ≥ threshold when filtering by trade
  min_premium_level?: 1 | 2 | 3 | 4 | 5;
  category?: MaterialCategory;
  finish?: string;
  min_repairability?: number;
  min_sustainability?: number;
};
