import { readFileSync } from "node:fs";
import { z } from "zod";

const raw = JSON.parse(readFileSync("C:\\Users\\Victus\\trades\\.author-studio-drafts\\staircase\\defects.json", "utf-8"));

const ConfidenceSchema = z.enum(["low", "medium", "high"]);
const EvidenceCiteSchema = z.object({ source: z.string().min(1), url: z.string().url().optional(), note: z.string().optional() });
const ModuleHeaderSchema = z.object({
  version: z.string().min(1), authored_by: z.string().min(1), authored_at: z.string().datetime(),
  last_reviewed_at: z.string().datetime().optional(), regions: z.array(z.string().min(2).max(16)).default([])
});
const DefectSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), applies_to: z.array(z.string()).default([]),
  symptoms: z.array(z.string()).min(1), causes: z.array(z.string()).default([]), fixes: z.array(z.string()).default([]),
  severity: z.enum(["cosmetic", "functional", "safety_critical"]),
  vision_hints: z.array(z.string()).default([]), evidence: z.array(EvidenceCiteSchema).default([]),
  confidence: ConfidenceSchema
});
const DefectsModuleSchema = z.object({ header: ModuleHeaderSchema, defects: z.array(DefectSchema).default([]) });

const result = DefectsModuleSchema.safeParse(raw.payload);
if (!result.success) {
  console.log("❌ FAILED"); console.log(JSON.stringify(result.error.issues, null, 2)); process.exit(1);
}
const originals = raw.payload.defects.filter(d => d.id.startsWith("cand."));
const interims = raw.payload.defects.filter(d => d.id.startsWith("interim_"));
console.log(`✓ ${raw.payload.defects.length} defects total (${originals.length} original + ${interims.length} interim)`);
console.log(`✓ Schema valid`);
console.log(`\nInterim defects:`);
for (const d of interims) console.log(`  · [${d.severity}] ${d.name}`);
