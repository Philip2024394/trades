// Material Intelligence Platform · Material Physics extension.
//
// Beyond density + fire rating + carbon (Phase E.3), materials now also know:
// grain · hardness · expansion coefficient · moisture behaviour · UV ageing
// curve · machining · staining · oil absorption · paint adhesion.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export type Grain = "straight" | "interlocked" | "wavy" | "cross" | "curly" | "figured" | "none";

export type MachiningEase = "easy" | "moderate" | "difficult" | "requires_carbide";

export type MaterialPhysics = {
  material_id: string;                   // references material-platform catalog
  grain?: Grain;
  janka_hardness_lbf?: number;           // wood hardness (Janka scale · lb-force)
  mohs_hardness?: number;                // stone/mineral hardness
  thermal_expansion_1e6_per_c?: number;  // coefficient of thermal expansion · 10⁻⁶/°C
  moisture_content_pct_dry?: number;     // typical dry-state moisture (timbers)
  moisture_content_pct_wet?: number;     // saturation
  moisture_movement_pct_per_pct_mc?: number; // % dimensional change per %MC change
  uv_ageing_10yr?: "minimal" | "gentle_amber" | "moderate_darkening" | "significant_bleaching" | "significant_yellowing";
  machining?: MachiningEase;
  staining?: "excellent" | "good" | "moderate" | "poor";
  oil_absorption?: "high" | "medium" | "low" | "none";
  paint_adhesion?: "excellent" | "good" | "moderate" | "poor" | "not_recommended";
  bend_radius_min_mm?: number;           // minimum bend radius for sheet materials
  provenance: { named_expert: string; authored: string; sources?: readonly string[] };
};

const PHILIP = "Philip O'Farrell";
const AUTHORED = "2026-08-04";

export const MATERIAL_PHYSICS: readonly MaterialPhysics[] = [
  {
    material_id: "oak_american_white_satin_lacquer",
    grain: "straight",
    janka_hardness_lbf: 1360,
    thermal_expansion_1e6_per_c: 4.9,
    moisture_content_pct_dry: 8,
    moisture_content_pct_wet: 25,
    moisture_movement_pct_per_pct_mc: 0.26,
    uv_ageing_10yr: "gentle_amber",
    machining: "moderate",
    staining: "good",
    oil_absorption: "medium",
    paint_adhesion: "good",
    provenance: { named_expert: PHILIP, authored: AUTHORED, sources: ["Wood Handbook USDA · AHEC oak spec"] },
  },
  {
    material_id: "european_walnut_matt_lacquer",
    grain: "wavy",
    janka_hardness_lbf: 1010,
    thermal_expansion_1e6_per_c: 5.1,
    moisture_content_pct_dry: 8,
    moisture_content_pct_wet: 22,
    moisture_movement_pct_per_pct_mc: 0.28,
    uv_ageing_10yr: "moderate_darkening",
    machining: "moderate",
    staining: "excellent",
    oil_absorption: "medium",
    paint_adhesion: "moderate",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "scandinavian_pine",
    grain: "straight",
    janka_hardness_lbf: 380,
    thermal_expansion_1e6_per_c: 4.5,
    moisture_content_pct_dry: 12,
    moisture_content_pct_wet: 30,
    moisture_movement_pct_per_pct_mc: 0.24,
    uv_ageing_10yr: "significant_yellowing",
    machining: "easy",
    staining: "moderate",
    oil_absorption: "high",
    paint_adhesion: "excellent",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "mahogany_polished",
    grain: "interlocked",
    janka_hardness_lbf: 800,
    uv_ageing_10yr: "moderate_darkening",
    machining: "moderate",
    staining: "excellent",
    oil_absorption: "medium",
    paint_adhesion: "good",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "steel_black_powder_coated",
    mohs_hardness: 4,
    thermal_expansion_1e6_per_c: 12,
    machining: "requires_carbide",
    paint_adhesion: "excellent",
    provenance: { named_expert: PHILIP, authored: AUTHORED },
  },
  {
    material_id: "glass_toughened_10mm",
    mohs_hardness: 6,
    thermal_expansion_1e6_per_c: 8.5,
    machining: "difficult",
    paint_adhesion: "not_recommended",
    provenance: { named_expert: PHILIP, authored: AUTHORED, sources: ["BS EN 12150"] },
  },
];

const INDEX = new Map<string, MaterialPhysics>(MATERIAL_PHYSICS.map((p) => [p.material_id, p]));

export function getPhysics(material_id: string): MaterialPhysics | undefined { return INDEX.get(material_id); }
export function listPhysics(): readonly MaterialPhysics[] { return MATERIAL_PHYSICS; }
