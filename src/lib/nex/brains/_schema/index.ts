// Public barrel for Brain module schemas.

export * from "./common";
export * from "./craft";
export * from "./regulations";
export * from "./materials";
export * from "./workflow";
export * from "./defects";
export * from "./pricing_model";
export * from "./manifest";

import { CraftModuleSchema } from "./craft";
import { RegulationsModuleSchema } from "./regulations";
import { MaterialsModuleSchema } from "./materials";
import { WorkflowModuleSchema } from "./workflow";
import { DefectsModuleSchema } from "./defects";
import { PricingModelModuleSchema } from "./pricing_model";

export const V1_MODULE_NAMES = [
  "craft", "regulations", "materials",
  "workflow", "defects", "pricing_model"
] as const;
export type V1ModuleName = typeof V1_MODULE_NAMES[number];

export const V2_MODULE_NAMES = [
  "tools", "business_tone", "sub_specialisations", "regional_variants"
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
  pricing_model: PricingModelModuleSchema
} as const;
