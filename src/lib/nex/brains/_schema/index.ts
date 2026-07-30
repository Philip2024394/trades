// Public barrel for Brain module schemas.

export * from "./common";
export * from "./craft";
export * from "./regulations";
export * from "./materials";
export * from "./workflow";
export * from "./defects";
export * from "./pricing_model";
export * from "./terminology";
export * from "./manifest";

import { CraftModuleSchema } from "./craft";
import { RegulationsModuleSchema } from "./regulations";
import { MaterialsModuleSchema } from "./materials";
import { WorkflowModuleSchema } from "./workflow";
import { DefectsModuleSchema } from "./defects";
import { PricingModelModuleSchema } from "./pricing_model";
import { TerminologyModuleSchema } from "./terminology";

// V1 modules are required per ADR-0017. Terminology is NOT added to V1
// because reality has not (yet) earned permission to demand it for every
// brain. It sits as an optional/first-class V2 module — the Terminology
// staircase brain can ship with only Terminology present, and future
// brains that don't have terminology yet remain valid.
export const V1_MODULE_NAMES = [
  "craft", "regulations", "materials",
  "workflow", "defects", "pricing_model"
] as const;
export type V1ModuleName = typeof V1_MODULE_NAMES[number];

// V2 modules pass through the loader as raw JSON (warning, not failure)
// when absent · validated against schema when present. Terminology sits
// here per Philip 2026-07-30 Path B.1 · smallest possible integration.
export const V2_MODULE_NAMES = [
  "tools", "business_tone", "sub_specialisations", "regional_variants",
  "terminology"
] as const;
export type V2ModuleName = typeof V2_MODULE_NAMES[number];

export type BrainModuleName = V1ModuleName | V2ModuleName;

/** Runtime lookup from module name to Zod schema. Used by the loader
 *  to validate each JSON pack when a Brain boots. */
export const MODULE_SCHEMAS = {
  craft:         CraftModuleSchema,
  regulations:   RegulationsModuleSchema,
  materials:     MaterialsModuleSchema,
  workflow:      WorkflowModuleSchema,
  defects:       DefectsModuleSchema,
  pricing_model: PricingModelModuleSchema,
  terminology:   TerminologyModuleSchema
} as const;
