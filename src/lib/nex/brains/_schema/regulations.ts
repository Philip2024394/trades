// Regulations module — region-scoped official cites.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { ConfidenceSchema, EvidenceCiteSchema, ModuleHeaderSchema, RuleSchema } from "./common";

export const RegulationRefSchema = z.object({
  id:            z.string().min(1),           // e.g. "uk.part_k.1.1"
  country:       z.string().min(2).max(4),    // ISO code
  title:         z.string().min(1),
  section:       z.string().optional(),
  requirement:   z.string().min(1),
  applies_to:    z.array(z.string()).default([]),
  evidence:      z.array(EvidenceCiteSchema).min(1),
  confidence:    ConfidenceSchema,
  effective_from: z.string().optional(),
  superseded_by:  z.string().optional()
});
export type RegulationRef = z.infer<typeof RegulationRefSchema>;

export const RegulationsModuleSchema = z.object({
  header:      ModuleHeaderSchema,
  regulations: z.array(RegulationRefSchema).default([]),
  rules:       z.array(RuleSchema).default([])
});
export type RegulationsModule = z.infer<typeof RegulationsModuleSchema>;
