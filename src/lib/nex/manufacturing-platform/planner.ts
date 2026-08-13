// Manufacturing Platform · planManufacturing() MVP.
//
// Composes a ManufacturingPlan from a design object kind + dimensions +
// material. Starter rulesets for staircase + kitchen island · extended by
// domain packs.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import type { ManufacturingPlan, ManufacturingStep, CuttingListItem, InstallationStep } from "./types";

const PHILIP = "Philip O'Farrell";

export type PlanRequest = {
  object_id: string;
  object_kind: "staircase" | "kitchen_island" | "wardrobe" | "door" | "custom_joinery" | "other";
  material_id: string;
  dimensions_mm: { length?: number; width?: number; height?: number; depth?: number };
  quantity?: number;
};

function staircaseSteps(): readonly ManufacturingStep[] {
  return [
    { step_id: "s1", order: 1, description: "Machine treads to size (thickness + edge profile)", operations: [
      { machine: "thicknesser", duration_min: 20, notes: "thickness to 40mm" },
      { machine: "spindle_moulder", duration_min: 15, bit_or_tool: "bullnose 20mm", notes: "front edge bullnose" },
    ], estimated_labour_min: 45, required_skills: ["machinist"] },
    { step_id: "s2", order: 2, description: "Cut risers to size", operations: [
      { machine: "table_saw", duration_min: 15, waste_pct: 8 },
    ], estimated_labour_min: 20, required_skills: ["machinist"] },
    { step_id: "s3", order: 3, description: "Machine stringers with tread + riser housings", operations: [
      { machine: "cnc_router", duration_min: 90, bit_or_tool: "12mm end mill", feed_rate_mm_per_min: 3000, notes: "closed string housing" },
    ], estimated_labour_min: 30, required_skills: ["cnc_operator"] },
    { step_id: "s4", order: 4, description: "Sanding + preparation for finish", operations: [
      { machine: "sander", duration_min: 60 },
    ], estimated_labour_min: 90, required_skills: ["finisher"] },
    { step_id: "s5", order: 5, description: "Apply satin lacquer (3 coats)", operations: [
      { machine: "spray_booth", duration_min: 45, notes: "3 coats · sand between" },
    ], estimated_labour_min: 90, required_skills: ["finisher"] },
    { step_id: "s6", order: 6, description: "Assembly (glue + wedges + angle blocks)", operations: [
      { machine: "assembly_bench", duration_min: 120 },
    ], estimated_labour_min: 180, required_skills: ["joiner"] },
    { step_id: "s7", order: 7, description: "Packaging for delivery", operations: [
      { machine: "packaging_line", duration_min: 30, notes: "protective foam corners · corrugated box" },
    ], estimated_labour_min: 30 },
  ];
}

function islandSteps(): readonly ManufacturingStep[] {
  return [
    { step_id: "k1", order: 1, description: "Cut carcass panels to size (MFC/MDF)", operations: [{ machine: "cnc_router", duration_min: 60, bit_or_tool: "8mm compression", feed_rate_mm_per_min: 8000, waste_pct: 12 }], estimated_labour_min: 30, required_skills: ["cnc_operator"] },
    { step_id: "k2", order: 2, description: "Edge banding on visible faces", operations: [{ machine: "assembly_bench", duration_min: 90 }], estimated_labour_min: 90, required_skills: ["joiner"] },
    { step_id: "k3", order: 3, description: "Assemble carcasses with dowels + screws", operations: [{ machine: "assembly_bench", duration_min: 120 }], estimated_labour_min: 120, required_skills: ["joiner"] },
    { step_id: "k4", order: 4, description: "Fit doors + drawers + hinges (soft close)", operations: [{ machine: "assembly_bench", duration_min: 90 }], estimated_labour_min: 90, required_skills: ["joiner"] },
    { step_id: "k5", order: 5, description: "Prepare for worktop template", operations: [{ machine: "assembly_bench", duration_min: 30 }], estimated_labour_min: 30 },
  ];
}

function staircaseCutting(req: PlanRequest): readonly CuttingListItem[] {
  const treadCount = Math.max(1, Math.round((req.dimensions_mm.height ?? 2600) / 190));
  return [
    { item_id: "cl_tread", material_id: req.material_id, qty: treadCount, length_mm: req.dimensions_mm.width ?? 900, width_mm: 250, thickness_mm: 40, grain_direction: "with" },
    { item_id: "cl_riser", material_id: req.material_id, qty: treadCount - 1, length_mm: req.dimensions_mm.width ?? 900, width_mm: 190, thickness_mm: 18, grain_direction: "across" },
    { item_id: "cl_stringer", material_id: req.material_id, qty: 2, length_mm: req.dimensions_mm.length ?? 3600, width_mm: 300, thickness_mm: 40, grain_direction: "with" },
  ];
}

function islandCutting(req: PlanRequest): readonly CuttingListItem[] {
  return [
    { item_id: "cl_side_panel", material_id: req.material_id, qty: 2, length_mm: req.dimensions_mm.length ?? 2400, width_mm: 720, thickness_mm: 18, grain_direction: "with" },
    { item_id: "cl_back_panel", material_id: req.material_id, qty: 1, length_mm: req.dimensions_mm.length ?? 2400, width_mm: 720, thickness_mm: 18, grain_direction: "with" },
    { item_id: "cl_top_panel", material_id: req.material_id, qty: 1, length_mm: req.dimensions_mm.length ?? 2400, width_mm: req.dimensions_mm.width ?? 900, thickness_mm: 18, grain_direction: "with" },
    { item_id: "cl_base_panel", material_id: req.material_id, qty: 1, length_mm: req.dimensions_mm.length ?? 2400, width_mm: req.dimensions_mm.width ?? 900, thickness_mm: 18, grain_direction: "with" },
  ];
}

function staircaseInstallation(): readonly InstallationStep[] {
  return [
    { step_id: "i1", order: 1, description: "Deliver + protect flooring", required_tools: ["dolly", "corner_protectors"], required_people: 2, estimated_duration_min: 60 },
    { step_id: "i2", order: 2, description: "Fit lower newel + bottom stringer", required_tools: ["level", "screws", "adhesive"], required_people: 2, estimated_duration_min: 120, safety_notes: "verify wall fixings into structural stud." },
    { step_id: "i3", order: 3, description: "Fit treads + risers + wedges", required_tools: ["clamps", "PVA_glue", "wedges"], required_people: 2, estimated_duration_min: 240 },
    { step_id: "i4", order: 4, description: "Fit upper newel + handrail + balustrade", required_tools: ["level", "handrail_clamps"], required_people: 2, estimated_duration_min: 180, safety_notes: "regs handrail 900-1000mm above pitch line · sphere rule <100mm gap." },
    { step_id: "i5", order: 5, description: "Snag list + final polish", required_tools: ["wax", "cloth"], required_people: 1, estimated_duration_min: 60 },
  ];
}

function islandInstallation(): readonly InstallationStep[] {
  return [
    { step_id: "i1", order: 1, description: "Position carcass · level with adjustable feet", required_tools: ["spirit_level"], required_people: 2, estimated_duration_min: 60 },
    { step_id: "i2", order: 2, description: "Fix carcasses together · scribe to wall/floor", required_tools: ["scribe", "jigsaw"], required_people: 2, estimated_duration_min: 90 },
    { step_id: "i3", order: 3, description: "Template worktop", required_tools: ["template_kit"], required_people: 1, estimated_duration_min: 60 },
    { step_id: "i4", order: 4, description: "Fit doors + drawers · adjust hinges", required_tools: ["screwdriver_set"], required_people: 1, estimated_duration_min: 60 },
    { step_id: "i5", order: 5, description: "Snag list + protect for worktop fit", required_tools: [], required_people: 1, estimated_duration_min: 30 },
  ];
}

export function planManufacturing(req: PlanRequest): ManufacturingPlan {
  const steps = req.object_kind === "staircase" ? staircaseSteps() : req.object_kind === "kitchen_island" ? islandSteps() : [];
  const cutting = req.object_kind === "staircase" ? staircaseCutting(req) : req.object_kind === "kitchen_island" ? islandCutting(req) : [];
  const installation = req.object_kind === "staircase" ? staircaseInstallation() : req.object_kind === "kitchen_island" ? islandInstallation() : [];
  const total_labour_min = steps.reduce((s, x) => s + (x.estimated_labour_min ?? 0), 0);
  const wasteValues = steps.flatMap((s) => s.operations.map((o) => o.waste_pct ?? 0)).filter((w) => w > 0);
  const total_material_waste_pct = wasteValues.length ? Math.round((wasteValues.reduce((s, w) => s + w, 0) / wasteValues.length) * 10) / 10 : 5;
  return {
    object_id: req.object_id,
    object_kind: req.object_kind,
    steps,
    cutting_list: cutting,
    installation_sequence: installation,
    total_labour_min,
    total_material_waste_pct,
    packing_notes: req.object_kind === "staircase" ? ["Wrap treads individually · foam corners · assembly diagram inside"] : req.object_kind === "kitchen_island" ? ["Flat-pack in labelled cartons · assembly guide + fixings pack per carton"] : undefined,
    provenance: { named_expert: PHILIP, authored: "2026-08-04" },
    generated_at: new Date().toISOString(),
  };
}
