// Joinery DNA Library · types (Philip 2026-08-04 · 9th Design Genome library).
//
// A Joinery Family is a REUSABLE COMPONENT MOTIF that recurs across trades.
// The same "raised panel · shaker" motif appears on staircase newel panels ·
// kitchen cabinet doors · wardrobes · panelling · interior doors. Each use is
// a different ObjectDNA in the Object Library · but they SHARE a JoineryDNA
// family that carries the design language across the whole home.
//
// Doctrine: docs/brains/nex-joinery-dna-library-ninth-genome-philip-2026-08-04.md

export type JoineryTrade =
  | "staircase" | "kitchen" | "wardrobe" | "panelling" | "door" | "window"
  | "skirting" | "architrave" | "crown_moulding" | "cabinet" | "furniture" | "shelf";

export type JoineryDNAFamily = {
  family_id: string;                       // e.g. "IN_FRAME_SHAKER"
  display_name: string;
  component_kind: string;                  // "cabinet_door" · "moulding" · "handrail_profile" · etc.
  design_language: string;                 // "shaker" · "in_frame_traditional" · "victorian" · "georgian" · "contemporary_slab" · etc.
  trades_it_appears_in: readonly JoineryTrade[];
  material_families: readonly string[];    // ["oak", "walnut", "painted_mdf"]
  characteristic_features: readonly string[];
  incompatible_with: readonly string[];    // other family_ids that clash on the same project
  observation_count: number;
  aggregate_confidence: number;
  evidence_asset_ids: readonly string[];
  history: readonly { at: string; delta: number; reason: string; evidence?: string; trade?: JoineryTrade }[];
  provenance: { named_expert: string; authored: string };
};

export type CrossTradeQuery = {
  trades?: readonly JoineryTrade[];
  design_language?: string;
  material?: string;
  min_confidence?: number;
};
