// Object Library · Object DNA schema (Philip 2026-08-04).
//
// Every recognised object receives its own permanent identity. The renderer
// doesn't CREATE handrails · it renders Object Library entries. Every design
// uses REAL objects with real supplier links · real cost · real construction
// rules · real compatibility rules.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

export type ObjectFamily =
  | "STAIR_TREAD" | "STAIR_RISER" | "STAIR_STRING" | "STAIR_NEWEL" | "STAIR_SPINDLE" | "STAIR_HANDRAIL" | "STAIR_GLASS" | "STAIR_LED"
  | "KITCHEN_CABINET" | "KITCHEN_WORKTOP" | "KITCHEN_ISLAND" | "KITCHEN_SINK" | "KITCHEN_TAP" | "KITCHEN_HANDLE" | "KITCHEN_HINGE" | "KITCHEN_APPLIANCE"
  | "DOOR" | "WINDOW" | "SKIRTING" | "ARCHITRAVE" | "PANEL"
  | "LIGHT" | "WARDROBE" | "MEDIA_WALL" | "STORAGE" | "FURNITURE"
  | "FIXING" | "MATERIAL_SAMPLE" | "OTHER";

export type ObjectDimensions = {
  length_mm?: number;
  width_mm?: number;
  height_mm?: number;
  depth_mm?: number;
  diameter_mm?: number;
  thickness_mm?: number;
};

export type ObjectShapeSignature = {
  primary_shape: string;                 // "rectangle" · "cylinder" · "tapered" · etc.
  edge_treatment?: string;               // "sharp" · "rounded" · "chamfered" · "bullnose" · "moulded"
  proportions?: "small" | "medium" | "large";
  style_class?: string;                  // e.g. "shaker" · "modern" · "traditional" · "industrial" · "scandinavian" · "heritage"
};

export type SupplierLink = {
  name: string;                          // manufacturer / supplier
  product_code?: string;
  region?: string;
  lead_time_weeks?: number;
  url?: string;
};

export type ObjectVariant = {
  variant_id: string;
  label: string;                         // e.g. "walnut · matt lacquer · 50mm"
  material_id?: string;                  // references material-platform
  dimensions?: ObjectDimensions;
  cost_gbp?: number;
  image_example_asset_ids?: readonly string[];
};

export type ObjectVersionEntry = {
  version: number;
  captured_at: string;
  changes: readonly string[];            // human-readable list of what changed
  changed_by: string;                    // e.g. "visual_learning_platform" · "philip"
  confidence: number;                    // 0..1 aggregate confidence at this version
};

export type ConstructionRule = {
  rule: string;                          // human-readable
  citation?: string;                     // e.g. "Building Regs Part K · sphere rule"
  severity: "info" | "advisory" | "required";
};

// Hierarchical subcomponent entry · Philip 2026-08-04.
// A complex object (staircase · kitchen · wardrobe) exposes its anatomy
// (flight_type → structural_system → joinery → decorative_elements → material
// → finish) without becoming N flat records. Optional · backward compatible.
export type SubcomponentEntry = {
  slot: string;                          // e.g. "flight_type" · "structural_system" · "entrance_system"
  value: string;                         // e.g. "straight" · "closed_string" · "double_bullnose"
  object_ref?: string;                   // optional · references another ObjectDNA id
  children?: readonly SubcomponentEntry[];
  confidence?: number;                   // 0..1
};

export type ObjectDNA = {
  object_id: string;                     // e.g. "STAIR_HANDRAIL_028441"
  family: ObjectFamily;
  display_name: string;

  shape: ObjectShapeSignature;
  material_id?: string;                  // references material-platform
  dimensions?: ObjectDimensions;
  style?: string;

  manufacturing_steps?: readonly string[];
  compatible_objects: readonly string[]; // object_ids
  cost_gbp?: number;
  weight_kg?: number;
  construction_rules: readonly ConstructionRule[];

  image_example_asset_ids: readonly string[];   // evidence · references UniversalAsset ids
  supplier_links?: readonly SupplierLink[];

  history: readonly ObjectVersionEntry[];       // append-only version log
  variants?: readonly ObjectVariant[];

  subcomponents?: readonly SubcomponentEntry[]; // hierarchical anatomy (Philip 2026-08-04 · optional · backward compatible)

  aggregate_confidence: number;                 // 0..1 · updated by Visual Learning
  observation_count: number;                    // how many uploads have contributed

  tags?: readonly string[];

  provenance: {
    named_expert: string;                       // Rule c
    authored: string;                           // ISO
    knowledge_ref?: string;
  };

  created_at: string;
  updated_at: string;
};
