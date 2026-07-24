// Common Zod primitives shared by every Brain module.
// Per ADR-0017 §3 every fact has evidence + confidence, every rule has
// applies_when + then + escalate_if, every playbook has steps + checkpoints.

import { z } from "zod";

export const ConfidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/** Who the piece of knowledge is intended for. The same fact / rule /
 *  playbook can carry a lower or higher level so runtime retrieval
 *  can tailor an answer to the requester's audience without
 *  duplicating content.
 *
 *  1 · Homeowner — everyday non-trade reader
 *  2 · DIY Enthusiast — experienced amateur
 *  3 · Apprentice — early-career trade
 *  4 · Qualified Tradesperson — full trade competency
 *  5 · Expert / Manufacturer — specialist / manufacturer depth
 */
export const AudienceLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5)
]);
export type AudienceLevel = z.infer<typeof AudienceLevelSchema>;

export const AUDIENCE_LEVEL_LABELS: Record<AudienceLevel, string> = {
  1: "Homeowner",
  2: "DIY Enthusiast",
  3: "Apprentice",
  4: "Qualified Tradesperson",
  5: "Expert / Manufacturer"
};

export const RegionCodeSchema = z.string().min(2).max(16);

export const EvidenceCiteSchema = z.object({
  source: z.string().min(1),        // e.g. "BS 5395-1:2010 §6.1"
  url:    z.string().url().optional(),
  note:   z.string().optional()
});
export type EvidenceCite = z.infer<typeof EvidenceCiteSchema>;

/** Standard head every module JSON pack carries. Per ADR-0017 §3. */
export const ModuleHeaderSchema = z.object({
  version:          z.string().min(1),         // semver e.g. "0.1.0"
  authored_by:      z.string().min(1),         // Author user id or handle
  authored_at:      z.string().datetime(),
  last_reviewed_at: z.string().datetime().optional(),
  regions:          z.array(RegionCodeSchema).default([])
});
export type ModuleHeader = z.infer<typeof ModuleHeaderSchema>;

/** Classification of a knowledge statement.
 *
 *  The classification separates "here is a fact" from "here is a repair
 *  step" from "here is safety advice." Runtime retrieval + merchant-
 *  facing UI can render each class with the appropriate frame — a repair
 *  procedure gets safety framing, a manufacturer guidance line gets
 *  attribution framing, an expert observation gets "in the Author's
 *  experience" hedging.
 *
 *  The classification is OPTIONAL. Items authored before this field
 *  was added default to `expert_observation` at read time. */
export const KnowledgeClassificationSchema = z.enum([
  "expert_observation",
  "repair_procedure",
  "diagnostic_procedure",
  "professional_recommendation",
  "industry_good_practice",
  "safety_advice",
  "manufacturer_guidance"
]);
export type KnowledgeClassification = z.infer<typeof KnowledgeClassificationSchema>;

export const KNOWLEDGE_CLASSIFICATION_LABELS: Record<KnowledgeClassification, string> = {
  expert_observation:          "Expert Field Observation",
  repair_procedure:            "Repair Procedure",
  diagnostic_procedure:        "Diagnostic Procedure",
  professional_recommendation: "Professional Recommendation",
  industry_good_practice:      "Industry Good Practice",
  safety_advice:               "Safety Advice",
  manufacturer_guidance:       "Manufacturer Guidance"
};

/** Risk of performing a Rule's action or a Playbook's procedure.
 *  Answers the different question from Defect.severity — this is
 *  "how risky is doing this thing?" not "how bad is this defect?"
 *
 *  1 · low    — homeowner-appropriate · low tool skill · low harm risk
 *  2 · medium — requires care · basic tool skill · potential harm if done wrong
 *  3 · high   — structural / at height / specialised tools · qualified pro advised
 *
 *  Optional. Rules and Playbooks authored before this field was added
 *  default to unset (rendered as "not rated" at read time). */
export const RiskLevelSchema = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  low:    "Low · homeowner-appropriate",
  medium: "Medium · requires care and confidence",
  high:   "High · qualified professional advised"
};

/** A single fact: evidence + confidence required. */
export const FactSchema = z.object({
  id:             z.string().min(1),
  statement:      z.string().min(1),
  evidence:       z.array(EvidenceCiteSchema).min(1),
  confidence:     ConfidenceSchema,
  audience_level: AudienceLevelSchema.optional(),
  classification: KnowledgeClassificationSchema.optional(),
  safety_note:    z.string().optional()
});
export type Fact = z.infer<typeof FactSchema>;

/** A conditional rule: predicate + action + safety escape. */
export const RuleSchema = z.object({
  id:             z.string().min(1),
  applies_when:   z.record(z.string(), z.unknown()),
  then:           z.string().min(1),
  escalate_if:    z.string().optional(),
  evidence:       z.array(EvidenceCiteSchema).default([]),
  confidence:     ConfidenceSchema,
  audience_level: AudienceLevelSchema.optional(),
  classification: KnowledgeClassificationSchema.optional(),
  safety_note:    z.string().optional(),
  risk_level:     RiskLevelSchema.optional()
});
export type Rule = z.infer<typeof RuleSchema>;

/** A sequenced playbook: ordered steps + verifiable checkpoints. */
export const PlaybookSchema = z.object({
  id:          z.string().min(1),
  title:       z.string().min(1),
  applies_to:  z.array(z.string()).default([]),
  steps:       z.array(z.object({
    order:      z.number().int().nonnegative(),
    action:     z.string().min(1),
    notes:      z.string().optional()
  })).min(1),
  checkpoints: z.array(z.object({
    after_step: z.number().int().nonnegative(),
    verify:     z.string().min(1)
  })).default([]),
  evidence:       z.array(EvidenceCiteSchema).default([]),
  confidence:     ConfidenceSchema,
  audience_level: AudienceLevelSchema.optional(),
  classification: KnowledgeClassificationSchema.optional(),
  safety_note:    z.string().optional(),
  risk_level:     RiskLevelSchema.optional()
});
export type Playbook = z.infer<typeof PlaybookSchema>;
