// Concrete job calculator — pure function.
//
// Takes structured dimensions + qualifiers → returns materials list,
// spec, cost estimate, difficulty, DIY-friendly flag, Building
// Control requirement, duration estimate.
//
// Trade-agnostic engine pattern: every job_type has a matching
// calculator in this folder (concrete.ts, decking.ts, roofing.ts,
// etc). All return the same shape (CalculatorResult) so the Job
// Engine can render, price, and recommend without knowing which
// trade it's dealing with.
//
// This function has ZERO side effects — no DB writes, no API
// calls. Pure input → output. Callable from anywhere:
//   · Server on job create
//   · Client for preview
//   · Test harness
//   · Trade's canteen installed-app widget
//   · Storybook

export type ConcreteDimensions = {
  length_m:    number;
  width_m:     number;
  thickness_mm: number;
};

export type ConcreteQualifiers = {
  use_case?:              "garden-path" | "patio" | "shed-base" | "driveway-car" |
                          "driveway-van" | "garage-floor" | "workshop-floor" |
                          "house-floor-slab" | "foundation-strip" | "foundation-trench" |
                          "footing" | "retaining-wall-footing" | "concrete-steps" |
                          "fence-posts" | "industrial-slab" | "custom";
  vehicle_weight?:        "none" | "car" | "van" | "truck" | "plant";
  soft_ground?:           boolean;
  reinforcement_planned?: boolean;
  pump_required?:         boolean;
  ready_mix_preferred?:   boolean;
  above_ground?:          boolean;   // above-ground slab needs engineer spec
  load_bearing?:          boolean;   // structural element → refuses spec, recommends engineer
};

export type MaterialItem = {
  item_slug:              string;        // 'cement-25kg', 'sharp-sand', 'ballast-20mm'
  display_name:           string;
  quantity:               number;
  unit:                   string;        // 'bag', 'm3', 'tonne', 'sheet', 'litre'
  category:               "cement" | "aggregate" | "sand" | "reinforcement" |
                          "membrane" | "edging" | "sub-base" | "consumable";
  merchant_category:      string;        // for recommender routing
  estimated_price_pence?: number | null;
  notes?:                 string;
};

export type CalculatorResult = {
  ok:                          true;
  volume_m3:                   number;
  area_m2:                     number;
  strength_class:              string;         // e.g. 'C20', 'C28/35'
  mix_ratio:                   string;         // e.g. '1:2:4'
  slump_class:                 string;         // e.g. 'S2'
  materials:                   MaterialItem[];
  reinforcement_spec:          string | null;
  sub_base_spec:               string;
  additional_items:            string[];       // DPM, formwork, expansion joints
  tools_required:              string[];
  estimated_duration_hours:    number;
  difficulty:                  "beginner" | "intermediate" | "advanced" | "specialist";
  diy_friendly:                boolean;
  building_control_required:   boolean;
  needs_structural_engineer:   boolean;
  cost_estimate_pence:         { low: number; high: number };
  warnings:                    string[];
  merchant_categories:         string[];       // for /api/knowledge/recommend
  trade_categories:            string[];
} | {
  ok: false;
  error:         string;
  recommendations?: string[];
};

// ─── Constants (UK trade practice values) ─────────────────────────

const CEMENT_KG_PER_M3_1_2_4  = 320;   // 1:2:4 general concrete
const CEMENT_KG_PER_M3_1_1_5_3 = 400;  // 1:1.5:3 structural
const SAND_KG_PER_M3          = 640;
const BALLAST_KG_PER_M3       = 1280;
const KG_PER_BAG_25           = 25;
const KG_PER_BAG_50           = 50;
const READY_MIX_MIN_LOAD_M3   = 1.0;

const READY_MIX_PRICE_PER_M3_PENCE = {
  low:  9000,   // £90 per m3
  high: 13000   // £130 per m3
};
const CEMENT_25KG_BAG_PENCE = { low: 550, high: 850 };
const SHARP_SAND_TONNE_PENCE = { low: 3500, high: 6000 };
const BALLAST_TONNE_PENCE = { low: 3000, high: 5500 };
const MESH_A252_SHEET_PENCE = { low: 3500, high: 5500 };  // 4.8m × 2.4m
const MOT_TYPE_1_TONNE_PENCE = { low: 2500, high: 4500 };

// ─── Preset defaults (matches hammerex_job_templates.presets_json) ─

export const CONCRETE_PRESETS: Record<string, {
  display_name:           string;
  default_thickness_mm:   number;
  default_use_case:       ConcreteQualifiers["use_case"];
  suggested_class:        string;
  reinforcement_default:  boolean;
  building_control:       boolean;
  above_ground:           boolean;
  load_bearing:           boolean;
}> = {
  "driveway-car":            { display_name: "Driveway (car)",          default_thickness_mm: 100, default_use_case: "driveway-car",         suggested_class: "C28/35", reinforcement_default: true,  building_control: false, above_ground: false, load_bearing: false },
  "driveway-van":            { display_name: "Driveway (van/light commercial)", default_thickness_mm: 150, default_use_case: "driveway-van", suggested_class: "C32/40", reinforcement_default: true, building_control: false, above_ground: false, load_bearing: false },
  "patio":                   { display_name: "Patio",                   default_thickness_mm: 100, default_use_case: "patio",               suggested_class: "C25",    reinforcement_default: false, building_control: false, above_ground: false, load_bearing: false },
  "garden-path":             { display_name: "Garden path",             default_thickness_mm:  75, default_use_case: "garden-path",         suggested_class: "C20",    reinforcement_default: false, building_control: false, above_ground: false, load_bearing: false },
  "shed-base":               { display_name: "Shed base",               default_thickness_mm: 100, default_use_case: "shed-base",           suggested_class: "C20",    reinforcement_default: false, building_control: false, above_ground: false, load_bearing: false },
  "garage-floor":            { display_name: "Garage floor",            default_thickness_mm: 150, default_use_case: "garage-floor",        suggested_class: "C28/35", reinforcement_default: true,  building_control: true,  above_ground: false, load_bearing: false },
  "workshop-floor":          { display_name: "Workshop floor",          default_thickness_mm: 200, default_use_case: "workshop-floor",      suggested_class: "C32/40", reinforcement_default: true,  building_control: true,  above_ground: false, load_bearing: false },
  "house-floor-slab":        { display_name: "House floor slab",        default_thickness_mm: 150, default_use_case: "house-floor-slab",    suggested_class: "C28/35", reinforcement_default: true,  building_control: true,  above_ground: false, load_bearing: true },
  "foundation-strip":        { display_name: "Strip foundation",        default_thickness_mm: 225, default_use_case: "foundation-strip",    suggested_class: "C25",    reinforcement_default: false, building_control: true,  above_ground: false, load_bearing: true },
  "foundation-trench":       { display_name: "Trench-fill foundation",  default_thickness_mm: 800, default_use_case: "foundation-trench",   suggested_class: "C25",    reinforcement_default: false, building_control: true,  above_ground: false, load_bearing: true },
  "retaining-wall-footing":  { display_name: "Retaining wall footing",  default_thickness_mm: 300, default_use_case: "retaining-wall-footing", suggested_class: "C32/40", reinforcement_default: true, building_control: true, above_ground: false, load_bearing: true },
  "concrete-steps":          { display_name: "Concrete steps",          default_thickness_mm: 100, default_use_case: "concrete-steps",      suggested_class: "C25",    reinforcement_default: true,  building_control: false, above_ground: true, load_bearing: true },
  "fence-posts":             { display_name: "Fence post foundations",  default_thickness_mm: 600, default_use_case: "fence-posts",         suggested_class: "C20",    reinforcement_default: false, building_control: false, above_ground: false, load_bearing: false }
};

// ─── The calculator ───────────────────────────────────────────────

export function calculateConcrete(
  dimensions: ConcreteDimensions,
  qualifiers: ConcreteQualifiers = {}
): CalculatorResult {
  const { length_m, width_m, thickness_mm } = dimensions;

  // Input validation
  if (!(length_m > 0 && width_m > 0 && thickness_mm > 0)) {
    return {
      ok: false,
      error: "Length, width and thickness must all be greater than zero.",
      recommendations: ["Enter positive numbers for length, width, and thickness."]
    };
  }
  if (length_m > 100 || width_m > 100) {
    return {
      ok: false,
      error: "Slab dimensions over 100m require engineered ground beam design — get a structural engineer.",
      recommendations: ["Contact a structural engineer via Networkers."]
    };
  }

  // Refuse to spec structural / above-ground elements — route to engineer
  if (qualifiers.load_bearing || qualifiers.above_ground) {
    return {
      ok: false,
      error: "This is a load-bearing or above-ground concrete element. A structural engineer must specify the mix, thickness, and reinforcement per Approved Doc A + BS EN 1992.",
      recommendations: [
        "Get a structural engineer's spec before ordering materials",
        "Notify Building Control before starting work",
        "Networkers can connect you with a local structural engineer"
      ]
    };
  }

  const area_m2   = length_m * width_m;
  const volume_m3 = area_m2 * (thickness_mm / 1000);

  // Preset lookup — pulls suggested spec if use_case matches
  const preset = qualifiers.use_case ? CONCRETE_PRESETS[qualifiers.use_case] : null;
  const strengthClass = preset?.suggested_class ?? chooseStrengthClass(qualifiers);
  const isStructural  = strengthClass !== "C15" && strengthClass !== "C20" && strengthClass !== "C25";
  const cementKgPerM3 = isStructural ? CEMENT_KG_PER_M3_1_1_5_3 : CEMENT_KG_PER_M3_1_2_4;
  const mixRatio      = isStructural ? "1:1.5:3" : "1:2:4";

  // Reinforcement decision
  const reinforcementPlanned = qualifiers.reinforcement_planned ?? preset?.reinforcement_default ?? false;
  const reinforcementSpec    = reinforcementPlanned ? chooseMeshSpec(qualifiers, thickness_mm) : null;

  // Ready-mix vs bags decision
  const useReadyMix = qualifiers.ready_mix_preferred ?? (volume_m3 >= 0.5);
  const materials   = buildMaterialsList({
    volume_m3,
    area_m2,
    thickness_mm,
    cementKgPerM3,
    reinforcementSpec,
    useReadyMix,
    subBaseRequired: !isNoSubBaseUseCase(qualifiers.use_case)
  });

  // Sub-base spec
  const subBaseSpec = isNoSubBaseUseCase(qualifiers.use_case)
    ? "No sub-base needed for this use case"
    : (qualifiers.soft_ground
        ? "200mm compacted MOT Type 1 in two lifts (soft ground)"
        : "150mm compacted MOT Type 1");

  // Additional items
  const additional: string[] = [];
  if (!isNoSubBaseUseCase(qualifiers.use_case)) {
    additional.push("Weed membrane (DPM under domestic slabs, above sub-base)");
    additional.push("Formwork timber (25mm × 100mm rails + pegs)");
    additional.push(`Expansion joint filler board (10mm) — length ~${((length_m + width_m) * 2).toFixed(1)}m`);
    if (reinforcementPlanned) additional.push("Mesh spacers (50mm plastic chairs, ~4 per m²)");
  }

  // Tools
  const tools = ["Mixer or ready-mix pump access", "Wheelbarrows (2+)", "Screed board (2 × slab width)", "Wooden float", "Steel trowel", "Laser or line level", "Tamping bar", "Bull float"];
  if (reinforcementPlanned) tools.push("Tie wire + pliers");
  if (qualifiers.pump_required) tools.push("Pump crew (2-3 hours access)");

  // Duration estimate (rough — prep + pour + finish, in hours)
  const durationHours = estimateDurationHours(area_m2, reinforcementPlanned);

  // Difficulty + DIY-friendly
  const { difficulty, diyFriendly } = classifyDifficulty(volume_m3, reinforcementPlanned, qualifiers);

  // Building control
  const buildingControl = preset?.building_control ?? false;

  // Cost estimate
  const costLow  = estimateCostPence(materials, "low");
  const costHigh = estimateCostPence(materials, "high");

  // Warnings
  const warnings: string[] = [];
  if (thickness_mm > 300 && !preset?.building_control) {
    warnings.push("Slab over 300mm thick — check with Building Control.");
  }
  if (qualifiers.soft_ground && !reinforcementPlanned) {
    warnings.push("Soft ground without reinforcement is high-risk. Consider adding A252 mesh.");
  }
  if (volume_m3 > 4 && !qualifiers.pump_required) {
    warnings.push("Large pour — consider a concrete pump if access is difficult.");
  }
  warnings.push("These are estimates. Final spec depends on ground conditions, loading, and local Building Regs. For structural elements, get engineer's sign-off.");

  return {
    ok: true,
    volume_m3:                Number(volume_m3.toFixed(2)),
    area_m2:                  Number(area_m2.toFixed(2)),
    strength_class:           strengthClass,
    mix_ratio:                mixRatio,
    slump_class:              qualifiers.pump_required ? "S4" : "S3",
    materials,
    reinforcement_spec:       reinforcementSpec,
    sub_base_spec:            subBaseSpec,
    additional_items:         additional,
    tools_required:           tools,
    estimated_duration_hours: durationHours,
    difficulty,
    diy_friendly:             diyFriendly,
    building_control_required: buildingControl,
    needs_structural_engineer: false,
    cost_estimate_pence:      { low: costLow, high: costHigh },
    warnings,
    merchant_categories:      ["building-merchant","concrete-supplier","builders-supplies","aggregate-supplier"],
    trade_categories:         diyFriendly
      ? ["bricklayer","groundworker","driveway-installer","concrete-specialist"]
      : ["groundworker","concrete-specialist","concrete-contractor","structural-engineer"]
  };
}

// ─── Helpers ──────────────────────────────────────────────────────

function chooseStrengthClass(q: ConcreteQualifiers): string {
  if (q.vehicle_weight === "van" || q.vehicle_weight === "truck") return "C32/40";
  if (q.vehicle_weight === "car")   return "C28/35";
  if (q.use_case === "patio" || q.use_case === "shed-base") return "C25";
  if (q.use_case === "garden-path") return "C20";
  return "C25";
}

function chooseMeshSpec(q: ConcreteQualifiers, thickness_mm: number): string {
  if (q.vehicle_weight === "van" || q.vehicle_weight === "truck" || thickness_mm >= 150) return "A252 mesh (4.8m × 2.4m sheets, 200mm overlap, 50mm cover)";
  if (q.vehicle_weight === "car" || thickness_mm >= 100) return "A193 mesh (4.8m × 2.4m sheets, 200mm overlap, 50mm cover)";
  return "A142 mesh (4.8m × 2.4m sheets, 200mm overlap, 50mm cover)";
}

function isNoSubBaseUseCase(useCase?: ConcreteQualifiers["use_case"]): boolean {
  return useCase === "fence-posts" || useCase === "footing" || useCase === "foundation-strip" || useCase === "foundation-trench";
}

function buildMaterialsList(inputs: {
  volume_m3:           number;
  area_m2:             number;
  thickness_mm:        number;
  cementKgPerM3:       number;
  reinforcementSpec:   string | null;
  useReadyMix:         boolean;
  subBaseRequired:     boolean;
}): MaterialItem[] {
  const items: MaterialItem[] = [];

  if (inputs.useReadyMix) {
    const loadM3 = Math.max(Math.ceil(inputs.volume_m3 * 2) / 2, READY_MIX_MIN_LOAD_M3);   // round to nearest 0.5, min 1
    items.push({
      item_slug:         "ready-mix-concrete",
      display_name:      `Ready-mix concrete (${loadM3.toFixed(1)} m³)`,
      quantity:          loadM3,
      unit:              "m³",
      category:          "cement",
      merchant_category: "concrete-supplier",
      estimated_price_pence: Math.round((READY_MIX_PRICE_PER_M3_PENCE.low + READY_MIX_PRICE_PER_M3_PENCE.high) / 2 * loadM3),
      notes:             loadM3 > inputs.volume_m3 ? `Ordering ${loadM3} m³ (${(loadM3 - inputs.volume_m3).toFixed(2)} m³ over) to hit supplier minimum load` : undefined
    });
  } else {
    const cementKg    = inputs.volume_m3 * inputs.cementKgPerM3;
    const bags25      = Math.ceil(cementKg / KG_PER_BAG_25);
    items.push({
      item_slug:         "cement-25kg",
      display_name:      "Cement (25kg bags)",
      quantity:          bags25,
      unit:              "bag",
      category:          "cement",
      merchant_category: "building-merchant",
      estimated_price_pence: Math.round((CEMENT_25KG_BAG_PENCE.low + CEMENT_25KG_BAG_PENCE.high) / 2 * bags25)
    });
    items.push({
      item_slug:         "sharp-sand",
      display_name:      "Sharp sand",
      quantity:          Number((inputs.volume_m3 * SAND_KG_PER_M3 / 1000).toFixed(2)),
      unit:              "tonne",
      category:          "sand",
      merchant_category: "aggregate-supplier"
    });
    items.push({
      item_slug:         "ballast-20mm",
      display_name:      "Ballast (20mm)",
      quantity:          Number((inputs.volume_m3 * BALLAST_KG_PER_M3 / 1000).toFixed(2)),
      unit:              "tonne",
      category:          "aggregate",
      merchant_category: "aggregate-supplier"
    });
  }

  if (inputs.reinforcementSpec) {
    const sheetsNeeded = Math.ceil(inputs.area_m2 / (4.8 * 2.4 * 0.85));   // 85% coverage after overlap
    items.push({
      item_slug:         "mesh-a252-sheet",
      display_name:      "Reinforcement mesh (4.8m × 2.4m sheets)",
      quantity:          sheetsNeeded,
      unit:              "sheet",
      category:          "reinforcement",
      merchant_category: "building-merchant",
      estimated_price_pence: Math.round((MESH_A252_SHEET_PENCE.low + MESH_A252_SHEET_PENCE.high) / 2 * sheetsNeeded)
    });
  }

  if (inputs.subBaseRequired) {
    const subBaseVolume = inputs.area_m2 * 0.15;   // 150mm sub-base
    const tonnes        = Number((subBaseVolume * 1.9).toFixed(2));   // ~1.9 t/m³
    items.push({
      item_slug:         "mot-type-1",
      display_name:      "MOT Type 1 sub-base",
      quantity:          tonnes,
      unit:              "tonne",
      category:          "sub-base",
      merchant_category: "aggregate-supplier",
      estimated_price_pence: Math.round((MOT_TYPE_1_TONNE_PENCE.low + MOT_TYPE_1_TONNE_PENCE.high) / 2 * tonnes)
    });
  }

  items.push({
    item_slug:         "dpm-polythene",
    display_name:      "DPM polythene sheet (1200 gauge)",
    quantity:          Number((inputs.area_m2 * 1.1).toFixed(1)),
    unit:              "m²",
    category:          "membrane",
    merchant_category: "building-merchant"
  });

  return items;
}

function estimateDurationHours(area_m2: number, hasReinforcement: boolean): number {
  const prepHours   = 2 + area_m2 * 0.1;                    // ~2h + 6min/m²
  const meshHours   = hasReinforcement ? area_m2 * 0.05 : 0;
  const pourHours   = 1 + area_m2 * 0.08;
  const finishHours = area_m2 * 0.1;
  return Number((prepHours + meshHours + pourHours + finishHours).toFixed(1));
}

function classifyDifficulty(volume_m3: number, reinforcement: boolean, q: ConcreteQualifiers): {
  difficulty:  "beginner" | "intermediate" | "advanced" | "specialist";
  diyFriendly: boolean;
} {
  if (volume_m3 < 0.5 && !reinforcement) return { difficulty: "beginner",     diyFriendly: true  };
  if (volume_m3 < 1.5 && q.vehicle_weight !== "van" && q.vehicle_weight !== "truck") return { difficulty: "intermediate", diyFriendly: true  };
  if (volume_m3 < 4)                        return { difficulty: "advanced",     diyFriendly: false };
  return                                    { difficulty: "specialist",   diyFriendly: false };
}

function estimateCostPence(materials: MaterialItem[], bound: "low" | "high"): number {
  // Materials only, low/high wide by 25% (labour extra, quoted by trades)
  const base = materials.reduce((acc, m) => acc + (m.estimated_price_pence ?? 0), 0);
  return bound === "low" ? Math.round(base * 0.9) : Math.round(base * 1.25);
}
