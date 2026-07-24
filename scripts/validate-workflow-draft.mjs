// Validate the freshly-written workflow.json against its Zod schema.

import { readFileSync } from "node:fs";
import { z } from "zod";

const raw = JSON.parse(readFileSync("C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase\\workflow.json", "utf-8"));

const ConfidenceSchema = z.enum(["low", "medium", "high"]);
const AudienceLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const KnowledgeClassificationSchema = z.enum(["expert_observation","repair_procedure","diagnostic_procedure","professional_recommendation","industry_good_practice","safety_advice","manufacturer_guidance"]);
const RiskLevelSchema = z.enum(["low", "medium", "high"]);

const EvidenceCiteSchema = z.object({
  source: z.string().min(1),
  url:    z.string().url().optional(),
  note:   z.string().optional()
});

const ModuleHeaderSchema = z.object({
  version: z.string().min(1),
  authored_by: z.string().min(1),
  authored_at: z.string().datetime(),
  last_reviewed_at: z.string().datetime().optional(),
  regions: z.array(z.string().min(2).max(16)).default([])
});

const PlaybookSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  applies_to: z.array(z.string()).default([]),
  steps: z.array(z.object({
    order: z.number().int().nonnegative(),
    action: z.string().min(1),
    notes: z.string().optional()
  })).min(1),
  checkpoints: z.array(z.object({
    after_step: z.number().int().nonnegative(),
    verify: z.string().min(1)
  })).default([]),
  evidence: z.array(EvidenceCiteSchema).default([]),
  confidence: ConfidenceSchema,
  audience_level: AudienceLevelSchema.optional(),
  classification: KnowledgeClassificationSchema.optional(),
  safety_note: z.string().optional(),
  risk_level: RiskLevelSchema.optional()
});

const WorkflowModuleSchema = z.object({
  header: ModuleHeaderSchema,
  playbooks: z.array(PlaybookSchema).default([])
});

const result = WorkflowModuleSchema.safeParse(raw.payload);
if (!result.success) {
  console.log("❌ Schema validation FAILED");
  console.log(JSON.stringify(result.error.issues, null, 2));
  process.exit(1);
}

console.log("✓ JSON parseable");
console.log("✓ Schema validation passed");
console.log(`✓ ${raw.payload.playbooks.length} playbooks written`);
console.log(`✓ Module version: ${raw.version}`);
console.log(`✓ Author tag: ${raw.author_id}`);
console.log("\nPlaybook titles:");
for (const p of raw.payload.playbooks) console.log(`  · ${p.title} (${p.classification ?? "no class"}, risk: ${p.risk_level ?? "not rated"})`);
