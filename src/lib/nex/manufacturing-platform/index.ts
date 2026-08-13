// Manufacturing Platform · public exports.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

export { planManufacturing } from "./planner";
export type {
  ManufacturingPlan, ManufacturingStep, MachineOp, MachineKind,
  CuttingListItem, InstallationStep,
} from "./types";
export type { PlanRequest } from "./planner";
