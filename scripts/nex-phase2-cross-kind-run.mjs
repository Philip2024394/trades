// scripts/nex-phase2-cross-kind-run.mjs
//
// Phase 2 · Cross-kind test runner · knowledge → skill/experience generality
// Runs two independent A/B measurements: skill candidate against skill corpus ·
// experience candidate against experience corpus. Both use same env-var
// isolation pattern as Y-W5-1-b. Neither promotes anything.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { freezeP2SecInputValCorpus, PHASE2_SKILL_ID } from "@/lib/nex/programmer-benchmark/corpus-phase2-security-input-validation";
import { freezeP2PerfQueryCorpus, PHASE2_EXPERIENCE_ID } from "@/lib/nex/programmer-benchmark/corpus-phase2-performance-query-optimization";
import { runABEvaluationCrossKind, computeABDelta, computeCrossKindAttribution } from "@/lib/nex/programmer-improvement/ab-harness";
import type { SkillItem, ExperienceItem } from "@/lib/nex/programmer-learning/types";
import { createHash } from "node:crypto";

// ─── Skill A/B ──────────────────────────────────────────────
const { corpus: skCorpus, hash: skHash } = freezeP2SecInputValCorpus();
const skHash2 = freezeP2SecInputValCorpus().hash;
if (skHash !== skHash2) { console.error("SKILL_CORPUS_HASH_UNSTABLE"); process.exit(2); }

const injectedSkill: SkillItem = {
  skill_id: PHASE2_SKILL_ID,
  name: "validate untrusted input against allowlist",
  domain: "security",
  description: "The skill of validating untrusted input by matching against an allowlist rather than a blocklist.",
  verification_recipe: "Skill requires the implementation must include allowlist matching and must include reject unknown inputs.",
  confidence: 0.9,
  promotion_state: "VERIFIED",
  supporting_experiences: [],
  created_at: "2026-09-07T00:00:00.000Z",
};

const skAB = runABEvaluationCrossKind({
  corpus: skCorpus,
  injected_kind: "skill",
  injected_skill: injectedSkill,
  candidate_id: "cand_phase2_skill_allowlist_validation",
});
const skDelta = computeABDelta(skAB);
const skAttribution = computeCrossKindAttribution(skAB, skDelta);

const skHashPost = createHash("sha256").update(JSON.stringify(skCorpus.cases)).digest("hex").slice(0, 16);
let skVerdict: string;
const skAllAttribOk = skAttribution.every((a) => a.attribution_ok);
if (skDelta.regressions > 0) skVerdict = "FAILED";
else if (skDelta.improvements > 0 && skDelta.delta > 0 && skAllAttribOk) skVerdict = "IMPROVED";
else if (skDelta.delta === 0 && skDelta.improvements === 0) skVerdict = "NO_VALID_IMPROVEMENT";
else skVerdict = "UNEXPLAINED";

// ─── Experience A/B ──────────────────────────────────────────
const { corpus: exCorpus, hash: exHash } = freezeP2PerfQueryCorpus();
const exHash2 = freezeP2PerfQueryCorpus().hash;
if (exHash !== exHash2) { console.error("EXP_CORPUS_HASH_UNSTABLE"); process.exit(2); }

const injectedExperience: ExperienceItem = {
  experience_id: PHASE2_EXPERIENCE_ID,
  task: "query optimization for accommodation booking retrieval",
  initial_hypothesis: "cursor pagination + batching + indexed filters would eliminate N+1 and full-table-scan patterns",
  action_taken: "implemented cursor-based pagination with bounded page size, batched related loads into single JOIN, indexed filter columns, and audit trail for slow queries",
  files_involved: ["src/performance/query-optimizer.ts"],
  expected_result: "query latency stays bounded even for large tenants",
  actual_result: "latency stayed under 200ms at p95 for 100k-row tenants; N+1 eliminated",
  evidence: ["benchmark-log-1", "benchmark-log-2", "prod-observability-log-1"],
  outcome: "success",
  lessons: [
    "For query optimization the implementation must include cursor pagination and must include batching of related loads and must include indexed filters and must include audit trail on slow query.",
  ],
  timestamp: "2026-09-07T00:00:00.000Z",
  provenance: {
    source: "phase2-experience-hypothetical",
    source_type: "internal_test",
    source_url: null,
    authority_tier: "TIER_1",
    retrieved_at: "2026-09-07T00:00:00.000Z",
    evidence_pointer: "phase2 experience simulated for A/B measurement · not promotion",
    observed_by: "system",
  },
};

const exAB = runABEvaluationCrossKind({
  corpus: exCorpus,
  injected_kind: "experience",
  injected_experience: injectedExperience,
  candidate_id: "cand_phase2_experience_query_optimization",
});
const exDelta = computeABDelta(exAB);
const exAttribution = computeCrossKindAttribution(exAB, exDelta);

const exHashPost = createHash("sha256").update(JSON.stringify(exCorpus.cases)).digest("hex").slice(0, 16);
let exVerdict: string;
const exAllAttribOk = exAttribution.every((a) => a.attribution_ok);
if (exDelta.regressions > 0) exVerdict = "FAILED";
else if (exDelta.improvements > 0 && exDelta.delta > 0 && exAllAttribOk) exVerdict = "IMPROVED";
else if (exDelta.delta === 0 && exDelta.improvements === 0) exVerdict = "NO_VALID_IMPROVEMENT";
else exVerdict = "UNEXPLAINED";

const out = {
  phase: "Phase 2 · Cross-kind test",
  skill: {
    corpus_version: skCorpus.version,
    corpus_hash: skHash,
    corpus_hash_post: skHashPost,
    corpus_hash_unchanged: skHash === skHashPost,
    case_count: skCorpus.case_count,
    before_correct: skDelta.before_correct,
    after_correct: skDelta.after_correct,
    delta: skDelta.delta,
    improvements: skDelta.improvements,
    regressions: skDelta.regressions,
    unchanged: skDelta.unchanged,
    verdict: skVerdict,
    attribution_all_ok: skAllAttribOk,
    per_case: skDelta.per_case,
    global_knowledge_unchanged: skAB.global_knowledge_bytes === skAB.global_knowledge_bytes_post,
  },
  experience: {
    corpus_version: exCorpus.version,
    corpus_hash: exHash,
    corpus_hash_post: exHashPost,
    corpus_hash_unchanged: exHash === exHashPost,
    case_count: exCorpus.case_count,
    before_correct: exDelta.before_correct,
    after_correct: exDelta.after_correct,
    delta: exDelta.delta,
    improvements: exDelta.improvements,
    regressions: exDelta.regressions,
    unchanged: exDelta.unchanged,
    verdict: exVerdict,
    attribution_all_ok: exAllAttribOk,
    per_case: exDelta.per_case,
    global_knowledge_unchanged: exAB.global_knowledge_bytes === exAB.global_knowledge_bytes_post,
  },
  integrated_verdict: (skVerdict === "IMPROVED" && exVerdict === "IMPROVED") ? "CROSS_KIND_IMPROVED" :
                       (skVerdict === "IMPROVED" || exVerdict === "IMPROVED") ? "PARTIAL_CROSS_KIND" :
                       "NO_CROSS_KIND_IMPROVEMENT",
  no_promotion_performed: true,
  candidates_remain_awaiting_approval: true,
};

console.log("PHASE_2_RESULT:" + JSON.stringify(out, null, 2));
skAB.cleanup();
exAB.cleanup();
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase2-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["tsx", tsPath],
  { cwd: process.cwd(), stdio: "inherit", env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
);
child.on("exit", (code) => process.exit(code ?? 1));
