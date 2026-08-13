// Geometry Platform · MaterialObject (Philip 2026-08-04).
//
// Every material a first-class object. One "oak" definition used everywhere.
// PBR-ready · manufacturer-aware · cost-aware · maintenance-aware.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

export type MaterialKind = "timber" | "metal" | "glass" | "stone" | "concrete" | "paint" | "lacquer" | "fabric" | "led" | "composite";

export type MaterialObject = {
  id: string;                            // e.g. "oak_american_white_satin_lacquer"
  kind: MaterialKind;
  display_name: string;

  // PBR surface properties
  base_color_hex: string;
  grain_texture_ref?: string;
  normal_map_ref?: string;
  roughness: number;                     // 0..1
  metallic?: number;                     // 0..1 (0 for wood/glass · 1 for polished steel)
  transparency?: number;                 // 0..1 · 0 opaque
  reflectivity?: number;                 // 0..1
  emissive_hex?: string;                 // for LED / emissive materials
  emissive_intensity?: number;

  // Provenance + cost + maintenance
  manufacturer?: string;
  product_code?: string;
  cost_per_m2_gbp?: number;
  cost_per_m3_gbp?: number;
  cost_per_linear_m_gbp?: number;
  maintenance_notes?: string;
  care_frequency?: "annual" | "biennial" | "5_year" | "none";

  // Provenance (Rule c)
  provenance: {
    named_expert?: string;
    authored?: string;
    knowledge_ref?: string;              // link to knowledge-layer entry
  };
};
