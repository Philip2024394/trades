// Defects module — common faults, causes, fixes.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { ConfidenceSchema, EvidenceCiteSchema, ModuleHeaderSchema } from "./common";

export const DefectSchema = z.object({
  id:          z.string().min(1),
  name:        z.string().min(1),
  applies_to:  z.array(z.string()).default([]),         // material families or component types
  symptoms:    z.array(z.string()).min(1),
  causes:      z.array(z.string()).default([]),
  fixes:       z.array(z.string()).default([]),
  severity:    z.enum(["cosmetic", "functional", "safety_critical"]),
  vision_hints: z.array(z.string()).default([]),        // cues for Vision integration
  evidence:    z.array(EvidenceCiteSchema).default([]),
  confidence:  ConfidenceSchema
});
export type Defect = z.infer<typeof DefectSchema>;

export const DefectsModuleSchema = z.object({
  header:  ModuleHeaderSchema,
  defects: z.array(DefectSchema).default([])
});
export type DefectsModule = z.infer<typeof DefectsModuleSchema>;
