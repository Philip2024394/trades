// Material Intelligence Platform · types.
//
// Every material a first-class intelligence object · carries domain knowledge
// beyond PBR: fire rating · slip rating · carbon · maintenance · cost ·
// manufacturers. One `oak_american_white_satin_lacquer` definition drives
// every render · every quotation · every carbon report · every regulation check.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

export type MaterialCategory = "timber" | "metal" | "glass" | "stone" | "concrete" | "paint" | "lacquer" | "fabric" | "composite" | "ceramic" | "led" | "insulation";

export type FireRating = "A1" | "A2" | "B" | "C" | "D" | "E" | "F";        // Euroclass
export type SlipRating = "R9" | "R10" | "R11" | "R12" | "R13";
export type PriceStability = "stable" | "moderate" | "volatile";
export type CareFrequency = "none" | "annual" | "biennial" | "5_year" | "10_year";

export type Manufacturer = {
  name: string;
  product_code?: string;
  region?: string;                       // "UK" · "EU" · "US" · "Global"
  lead_time_weeks?: number;
  minimum_order?: { value: number; unit: string };
};

export type MaterialIntelligence = {
  id: string;                            // e.g. "oak_american_white_satin_lacquer"
  display_name: string;
  category: MaterialCategory;

  // Physical
  base_color_hex: string;
  density_kg_per_m3?: number;
  roughness?: number;                    // 0..1
  reflectivity?: number;
  transparency?: number;

  // Regulatory
  fire_rating?: FireRating;
  slip_rating?: SlipRating;
  voc_g_per_l?: number;

  // Sustainability
  carbon_kg_co2e_per_kg?: number;        // embodied carbon
  recyclability_pct?: number;
  fsc_certified?: boolean;
  water_usage_l_per_kg?: number;

  // Cost
  cost_per_m2_gbp?: number;
  cost_per_m3_gbp?: number;
  cost_per_linear_m_gbp?: number;
  price_stability?: PriceStability;

  // Maintenance + lifespan
  care_frequency?: CareFrequency;
  care_notes?: string;
  expected_lifespan_years?: number;
  patina_behaviour?: string;

  // Manufacturers
  manufacturers?: readonly Manufacturer[];

  // Provenance (Rule c)
  provenance: {
    named_expert: string;
    authored: string;                    // ISO
    sources?: readonly string[];         // e.g. ["BS EN 13501-1 · Euroclass"]
    knowledge_ref?: string;
  };

  // Tags for retrieval
  tags?: readonly string[];
};
