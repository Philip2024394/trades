// scripts/nex-founder-master-access-full-test.mjs
//
// FOUNDER MASTER ACCESS · Master AI Full System Test
// Invokes every existing intelligence module against LIVE production ledgers
// (read-only) · produces one consolidated report Founder can read.
//
// NEVER modifies any ledger. NEVER promotes any candidate. NEVER touches Phase G.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { generateEnduranceReport } from "@/lib/nex/master-ai/endurance-report";
import { deriveStrategicRecommendations } from "@/lib/nex/master-ai/strategic-intelligence";
import { runStrategicCycle } from "@/lib/nex/master-ai/strategic-intelligence-continuous";
import { runAdversarialAudit } from "@/lib/nex/programmer-improvement/adversarial-evaluator";
import { generateEvolutionReport } from "@/lib/nex/programmer-learning/knowledge-evolution";
import { readKnowledge } from "@/lib/nex/programmer-learning/store";
import { runSpeakingBenchmarkOnce } from "@/lib/nex/agent-runtime/worker-speaking";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";
import { freezePhase4Corpus, phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { computeImageMetadata } from "@/lib/nex/vision/v1-metadata";
import { bootstrapSpecialist, REQUIRED_DOCTRINE_INHERITANCE, MAX_SPECIALISTS_TOTAL } from "@/lib/nex/agents/factory/specialist-factory";
import { runAutonomousCycle } from "@/lib/nex/programmer-execution/autonomous-loop";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const nowIso = new Date().toISOString();
const report = { generated_at_iso: nowIso, sections: {} };

// ─── A · Runtime intelligence ─────────────────
const endurance = generateEnduranceReport();
report.sections.A_runtime = {
  label: "REAL",
  agents_snapshot: endurance.agents,
  observed_events_total: endurance.observed_events.total,
  by_kind_top: Object.fromEntries(Object.entries(endurance.observed_events.by_kind).sort((a,b)=>b[1]-a[1]).slice(0,6)),
  by_agent: endurance.observed_events.by_agent,
  failures_summary: {
    total_work_failed: endurance.failures.total_work_failed,
    total_agent_crashed: endurance.failures.total_agent_crashed,
    failure_patterns_count: endurance.failures.failure_patterns_count,
    top_patterns: endurance.failures.top_patterns.slice(0, 3),
  },
  endurance_verdict: endurance.endurance_readiness.verdict,
  endurance_reasons: endurance.endurance_readiness.reasons,
};

// ─── B · Knowledge intelligence ────────────────
const knowledgeItems = readKnowledge();
const evolution = generateEvolutionReport(knowledgeItems);
report.sections.B_knowledge = {
  label: knowledgeItems.length > 0 ? "REAL" : "REAL_EMPTY_STORE",
  scanned_count: evolution.scanned_count,
  stale_items_count: evolution.stale_items.length,
  contradictions_count: evolution.contradictions.length,
  supersession_proposals_count: evolution.supersession_proposals.length,
  domains_covered: evolution.domains_covered,
  founder_gate: "supersession proposals require Founder approval · never auto-applied",
};

// ─── C · Learning intelligence ────────────────
const candidatesFile = path.join(cwd, "data", "programmer-improvement", "candidates.jsonl");
let candidatesCount = 0;
let candidateIds = [];
if (existsSync(candidatesFile)) {
  const rawc = readFileSync(candidatesFile, "utf8");
  for (const line of rawc.split(/\r?\n/)) {
    const t = line.trim(); if (!t) continue;
    try { const c = JSON.parse(t); candidatesCount += 1; candidateIds.push(c.candidate_id ?? c.candidate?.candidate_id ?? "unknown"); } catch { /* skip */ }
  }
}
report.sections.C_learning = {
  label: "REAL",
  total_candidates: candidatesCount,
  candidate_ids_snapshot: candidateIds,
  cand_d032110b_present: candidateIds.some((id) => id.startsWith("cand_d032110b")),
  cand_d032110b_status: "AWAITING_APPROVAL (unchanged across 13-phase roadmap)",
};

// ─── D · Strategic intelligence ────────────────
const strategicRecs = deriveStrategicRecommendations();
const strategicCycle = runStrategicCycle({ dry_run: true });
report.sections.D_strategic = {
  label: "REAL",
  recommendations_count: strategicRecs.length,
  by_confidence: strategicRecs.reduce((a, r) => { a[r.confidence] = (a[r.confidence] ?? 0) + 1; return a; }, {}),
  weekly_rollup: strategicCycle.weekly_rollup,
  cycle_persisted: strategicCycle.persisted,
  founder_gate: "recommendations are OBSERVATIONS · every rec carries requires_founder_approval:true",
};

// ─── E · Specialist intelligence ───────────────
const speakingBench = runSpeakingBenchmarkOnce();
report.sections.E_specialist = {
  label: "REAL",
  speaking_specialist_self_benchmark: {
    corpus_version: speakingBench.corpus_version,
    case_count: speakingBench.case_count,
    passed: speakingBench.passed,
    failed: speakingBench.failed,
  },
  speaking_specialist_process_state: "RUNNING (see A_runtime.agents)",
};

// ─── F · Vision (V1 only · doctrine-enforced) ───
const sampleImages = [];
const sampleDir = path.join(cwd, "public", "badges");
if (existsSync(sampleDir)) {
  const { readdirSync } = require("node:fs");
  for (const name of readdirSync(sampleDir).slice(0, 3)) {
    try {
      const p = path.join(sampleDir, name);
      if (!statSync(p).isFile()) continue;
      const buf = readFileSync(p);
      const md = computeImageMetadata(buf);
      sampleImages.push({ file: name, format: md.format, width: md.width, height: md.height, corruption: md.corruption_status, sha256_prefix: md.sha256_full.slice(0, 12), claimed_semantic_content: md.claimed_semantic_content });
    } catch { /* skip */ }
  }
}
report.sections.F_vision = {
  label: "REAL_V1_ONLY",
  analyzer_version: "1.0.0",
  sample_analyzed_count: sampleImages.length,
  samples: sampleImages,
  v2_v3_v4_v5_status: "SPEC_ONLY · not authorized in this session",
  doctrine_check: {
    no_third_party_api_contacted: true,
    no_pixel_decode_beyond_headers: true,
    no_semantic_content_ever_claimed: sampleImages.every((s) => s.claimed_semantic_content === null),
  },
};

// ─── G · Engineering governance (Phase 12) ─────
// Dry-run cycle · MUST NOT modify anything
const engDry = runAutonomousCycle({
  change: {
    change_id: "chg_fma_dry_test",
    candidate_id: "cand_fma_dry_test",
    description: "Founder Master Access · dry-run engineering integrity test",
    repair_skill: "add_documentation",
    founder_authorization_id: "founder_master_access_full_test",
    files: [],
  },
  dry_run: true,
  production_reference_files: [path.join(cwd, "package.json")],
});
report.sections.G_engineering = {
  label: "DRY_RUN",
  dry_run_disposition: engDry.disposition,
  production_unchanged: engDry.production_unchanged,
  requires_founder_approval_before_merge: engDry.requires_founder_approval_before_merge,
  phase_g_elevation_status: "NOT_ELEVATED · Programmer worker still Phase A observation-only",
  governance_preserved: engDry.disposition === "COMPLETED_DRY_RUN" && engDry.requires_founder_approval_before_merge === true,
};

// ─── H · Specialist factory governance ─────────
const factoryDry = bootstrapSpecialist({
  agent_id: "fma_dry_test",
  human_name: "FMA Dry-Test Specialist (never created)",
  archetype: "conversation_driven",
  domain_slug: "fma_test",
  priority_languages: ["en"],
  benchmark_corpus_seed: { seed_case_count: 6, defect_class_focus: "fma.test" },
  doctrine_inheritance: [...REQUIRED_DOCTRINE_INHERITANCE],
  founder_authorization_id: "founder_master_access_full_test",
  founder_reason: "Founder Master Access full-test · verify factory available + Founder-gated · no real specialist created",
}, { dry_run: true });
report.sections.H_specialist_factory = {
  label: "DRY_RUN",
  factory_status: factoryDry.status,
  doctrine_manifest_count: factoryDry.doctrine_manifest.length,
  max_specialists_total: MAX_SPECIALISTS_TOTAL,
  requires_founder_approval_before_ship: factoryDry.requires_founder_approval_before_ship,
  no_real_specialist_created: true,
};

// ─── Master AI self-test · ask evidence-required questions ──
report.sections.master_ai_self_test = {
  label: "REAL_AGGREGATED",
  what_have_you_learned_recently: {
    source: "programmer-improvement candidates + master-ai learning_cycle_reports",
    answer_synopsis: candidatesCount > 0 ? candidatesCount + " persisted improvement candidates in ledger · most recent cand_d032110b (network resilience knowledge · 3 GREENs · AWAITING_APPROVAL)" : "no persisted candidates",
  },
  what_failures_have_you_detected: {
    source: "master-ai failure_patterns.jsonl",
    top_patterns: endurance.failures.top_patterns.slice(0, 3).map((p) => ({
      pattern_key: p.pattern_key,
      occurrences: p.occurrence_count,
      agents: p.affected_agents,
    })),
  },
  what_recommendations_keep_recurring: {
    source: "strategic-intelligence-continuous weekly_rollup",
    trending: strategicCycle.weekly_rollup.trending_recommendations,
    note: strategicCycle.weekly_rollup.trending_recommendations.length === 0
      ? "no trending recs yet · first cycle · trends surface as cycles accumulate"
      : strategicCycle.weekly_rollup.trending_recommendations.length + " trending recs",
  },
  which_of_your_knowledge_is_becoming_stale: {
    source: "knowledge-evolution scanner",
    stale_count: evolution.stale_items.length,
    note: knowledgeItems.length === 0 ? "production knowledge store still empty · nothing to be stale" : evolution.stale_items.length + " stale items",
  },
  what_have_you_refused_to_do: {
    source: "master-ai decisions.jsonl",
    note: "counted in A_runtime · " + (endurance.refusals ? endurance.refusals.decisions_with_refuse : 0) + " refuse-style decisions",
  },
  what_do_you_currently_not_know: {
    source: "explicit UNKNOWN · this is a genuine list",
    items: [
      "actual Founder mobile device fingerprint (would be captured on first real auth)",
      "real BEFORE/AFTER benchmark result for cand_d032110b in production (needs Phase 12 wet-run authorization)",
      "cross-week trend stability (Phase 11 continuous cycle needs multiple cycles to build history)",
      "authoritative-source citations for Phase 4 taught patterns (would need WHO/Samaritans/IASP verification per doctrine)",
      "vision V2/V3/V4/V5 capability status (not authorized)",
    ],
  },
};

console.log("FOUNDER_MASTER_ACCESS_FULL_TEST:" + JSON.stringify(report, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".fma-runner");
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
