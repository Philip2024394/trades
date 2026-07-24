// Materials module — species/grades/pack sizes/defect risk per SKU.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { ConfidenceSchema, EvidenceCiteSchema, ModuleHeaderSchema } from "./common";

export const MaterialSchema = z.object({
  id:               z.string().min(1),
  family:           z.string().min(1),                 // "wood" | "metal" | "concrete" | ...
  name:             z.string().min(1),                 // "European oak, PAR"
  grades:           z.array(z.string()).default([]),
  pack_sizes:       z.array(z.string()).default([]),
  coverage_note:    z.string().optional(),
  defect_risk:      z.enum(["low", "medium", "high"]),
  waste_factor_pct: z.number().min(0).max(100).default(10),
  compatible_with:  z.array(z.string()).default([]),
  incompatible_with: z.array(z.string()).default([]),
  evidence:         z.array(EvidenceCiteSchema).default([]),
  confidence:       ConfidenceSchema
});
export type Material = z.infer<typeof MaterialSchema>;

export const MaterialsModuleSchema = z.object({
  header:    ModuleHeaderSchema,
  materials: z.array(MaterialSchema).default([])
});
export type MaterialsModule = z.infer<typeof MaterialsModuleSchema>;
