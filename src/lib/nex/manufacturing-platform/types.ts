// Manufacturing Platform · types.
//
// Every design object knows how it is made: manufacturing steps · machines ·
// CNC · laser · router · assembly · fixings · estimated labour · tooling ·
// waste · packing · installation. Feeds Bill of Materials + Reality Advisor.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export type MachineKind = "cnc_router" | "cnc_mill" | "laser_cutter" | "waterjet" | "press_brake" | "table_saw" | "planer" | "thicknesser" | "spindle_moulder" | "hand_tools" | "sander" | "spray_booth" | "assembly_bench" | "packaging_line";

export type MachineOp = {
  machine: MachineKind;
  duration_min: number;
  bit_or_tool?: string;                  // e.g. "6mm ball nose" · "1064nm fiber laser"
  feed_rate_mm_per_min?: number;
  spindle_rpm?: number;
  waste_pct?: number;
  notes?: string;
};

export type ManufacturingStep = {
  step_id: string;
  order: number;
  description: string;
  operations: readonly MachineOp[];
  estimated_labour_min?: number;
  required_skills?: readonly string[];
};

export type CuttingListItem = {
  item_id: string;
  material_id: string;                   // references material-platform
  qty: number;
  length_mm: number;
  width_mm: number;
  thickness_mm: number;
  grain_direction?: "with" | "across";
  notes?: string;
};

export type InstallationStep = {
  step_id: string;
  order: number;
  description: string;
  required_tools?: readonly string[];
  required_people: number;
  estimated_duration_min: number;
  safety_notes?: string;
};

export type ManufacturingPlan = {
  object_id: string;
  object_kind: string;
  steps: readonly ManufacturingStep[];
  cutting_list: readonly CuttingListItem[];
  installation_sequence: readonly InstallationStep[];
  total_labour_min: number;
  total_material_waste_pct: number;
  packing_notes?: readonly string[];
  provenance: { named_expert: string; authored: string };
  generated_at: string;
};
