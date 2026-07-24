// Pricing model module — trade-specific unit rates + regional multipliers.
// Per ADR-0017 §1 V1 required.

import { z } from "zod";
import { ConfidenceSchema, EvidenceCiteSchema, ModuleHeaderSchema, RegionCodeSchema } from "./common";

/** Structured pricing rule. `formula` is a structured expression — no
 *  arbitrary code — evaluated by the Estimator adapter. */
export const PricingRuleSchema = z.object({
  id:              z.string().min(1),
  rule_key:        z.string().min(1),           // "labour.per_riser.oak"
  unit:            z.enum(["hours", "gbp_pence", "metres", "each", "square_metres", "cubic_metres"]),
  applies_when:    z.record(z.string(), z.unknown()),
  base_value:      z.number(),
  regional_multipliers: z.record(RegionCodeSchema, z.number().positive()).default({}),
  evidence:        z.array(EvidenceCiteSchema).default([]),
  confidence:      ConfidenceSchema
});
export type PricingRule = z.infer<typeof PricingRuleSchema>;

export const PricingModelModuleSchema = z.object({
  header: ModuleHeaderSchema,
  rules:  z.array(PricingRuleSchema).default([])
});
export type PricingModelModule = z.infer<typeof PricingModelModuleSchema>;
