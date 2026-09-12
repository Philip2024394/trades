// scripts/nex-phase8-multi-domain-run.mjs
//
// Phase 8 · Multi-domain intelligence runner
// Invokes verifyMultiDomain against 3 real domains + prints full report.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { verifyMultiDomain } from "@/lib/nex/master-ai/multi-domain-verifier";
import { freezeNetworkResilienceCorpusV1, CANDIDATE_PROPOSED_KNOWLEDGE_ID } from "@/lib/nex/programmer-benchmark/corpus-network-resilience-v1";
import { freezeP2SecInputValCorpus, PHASE2_SKILL_ID } from "@/lib/nex/programmer-benchmark/corpus-phase2-security-input-validation";
import { freezePhase4Corpus, phase4TaughtKnowledgePayload } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";

const netCorpus = freezeNetworkResilienceCorpusV1().corpus;
const secCorpus = freezeP2SecInputValCorpus().corpus;
const spkCorpus = freezePhase4Corpus().corpus;

const networkKnowledge = {
  knowledge_id: CANDIDATE_PROPOSED_KNOWLEDGE_ID,
  statement: "For failure mode 'internet_offline_or_unknown' the network client must include timeout with a bounded budget and must include retry with exponential backoff and jitter and must include circuit breaker that opens after N consecutive failures and must include fail closed on repeated failures and must include heartbeat health check discipline separating currently unavailable from permanently degraded.",
  domain: "network",
  technology: "network.resilience",
  provenance: { source: "phase8_multi_domain", source_type: "external_documentation", source_url: null, authority_tier: "TIER_1", retrieved_at: new Date().toISOString(), evidence_pointer: "cand_d032110b · simulated VERIFIED for A/B measurement · not promotion", observed_by: "system" },
  verification_status: "VERIFIED",
  confidence: 0.9,
  content_hash: "phase8_network",
  created_at: new Date().toISOString(),
};

const securitySkill = {
  skill_id: PHASE2_SKILL_ID,
  name: "validate untrusted input against allowlist",
  domain: "security",
  description: "The skill of validating untrusted input by matching against an allowlist rather than a blocklist.",
  verification_recipe: "Skill requires the implementation must include allowlist matching and must include reject unknown inputs.",
  confidence: 0.9,
  promotion_state: "VERIFIED",
  supporting_experiences: [],
  created_at: new Date().toISOString(),
};

const speakingKnowledge = phase4TaughtKnowledgePayload();

const injections = [
  { domain_label: "network", knowledge_items: [networkKnowledge] },
  { domain_label: "security", skill_items: [securitySkill] },
  { domain_label: "speaking.life_safety", knowledge_items: [speakingKnowledge] },
];

const benchmarks = [
  { domain_label: "network", corpus: netCorpus, case_count: netCorpus.case_count,
    evaluate: () => evaluateCorpus(netCorpus).results.filter((r) => r.match_status === "CORRECT").length },
  { domain_label: "security", corpus: secCorpus, case_count: secCorpus.case_count,
    evaluate: () => evaluateCorpus(secCorpus).results.filter((r) => r.match_status === "CORRECT").length },
  { domain_label: "speaking.life_safety", corpus: spkCorpus, case_count: spkCorpus.case_count,
    evaluate: () => evaluateSpeakingCorpus(spkCorpus).results.filter((r) => r.match_status === "CORRECT").length },
];

const v = verifyMultiDomain(injections, benchmarks);

// Compute baselines from cross-contamination matrix
const baselines = {};
for (const cell of v.cross_contamination_matrix) baselines[cell.benchmark_domain] = cell.baseline_passed;

const own = {};
for (const r of v.own_domain_results) own[r.domain_label] = { passed: r.passed, case_count: r.case_count, baseline: baselines[r.domain_label] ?? 0, delta: r.passed - (baselines[r.domain_label] ?? 0) };

console.log("PHASE_8_MULTI_DOMAIN_RESULT:" + JSON.stringify({
  own_domain_improvements: own,
  cross_contamination_matrix: v.cross_contamination_matrix,
  any_leakage_detected: v.any_leakage_detected,
  leakage_details: v.leakage_details,
  verdict: (!v.any_leakage_detected && Object.values(own).every((r) => r.delta > 0)) ? "MULTI_DOMAIN_GREEN" : (v.any_leakage_detected ? "LEAKAGE_DETECTED_RED" : "OWN_DOMAIN_NO_IMPROVEMENT_YELLOW"),
  candidate_promoted: false,
  production_knowledge_written: false,
}, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase8-runner");
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
