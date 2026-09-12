// scripts/nex-w5-1-a-2-run.mjs
//
// Phase 1 · W5-1-a-2 · Independent replication runner
// Composes the independent corpus (Y-W5-1-a-2) + existing A/B harness (Y-W5-1-b)
// + baseline stability + fresh-process verification.

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { freezeNetworkResilienceCorpusV1Independent, CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT } from "@/lib/nex/programmer-benchmark/corpus-network-resilience-v1-independent";
import { runABEvaluation, computeABDelta, computeAttribution } from "@/lib/nex/programmer-improvement/ab-harness";
import type { KnowledgeItem } from "@/lib/nex/programmer-learning/types";
import { createHash } from "node:crypto";

const argv = process.argv.slice(2);
const mode = argv[0] ?? "full";

const { corpus, hash: corpusHash } = freezeNetworkResilienceCorpusV1Independent();
const corpusHashRefreeze = freezeNetworkResilienceCorpusV1Independent().hash;
if (corpusHash !== corpusHashRefreeze) {
  console.error("BENCHMARK_HASH_UNSTABLE");
  process.exit(2);
}

// Same candidate as W5-1 · same proposed_knowledge_id · injected as
// HYPOTHETICAL VERIFIED for measurement only (candidate on disk stays
// UNVERIFIED / AWAITING_APPROVAL).
const injected: KnowledgeItem = {
  knowledge_id: CANDIDATE_PROPOSED_KNOWLEDGE_ID_V1_INDEPENDENT, // know_w5_1_ebba7bd5
  statement: "For failure mode 'internet_offline_or_unknown' the network client must include timeout with a bounded budget and must include retry with exponential backoff and jitter and must include circuit breaker that opens after N consecutive failures and must include fail closed on repeated failures and must include heartbeat health check discipline separating currently unavailable from permanently degraded.",
  domain: "network",
  technology: "network.resilience",
  provenance: {
    source: "y_w5_1_a_2_ab_harness_simulated_promotion",
    source_type: "external_documentation",
    source_url: "https://en.wikipedia.org/wiki/Circuit_breaker_design_pattern",
    authority_tier: "TIER_1",
    retrieved_at: "2026-09-07T00:00:00.000Z",
    evidence_pointer: "candidate:cand_d032110b · proposed_knowledge simulated as VERIFIED for A/B measurement on independent corpus · not promotion",
    observed_by: "system",
  },
  verification_status: "VERIFIED",
  confidence: 0.9,
  content_hash: "w5_1_ebba7bd5_hash_verified",
  created_at: "2026-09-07T00:00:00.000Z",
};

const ab = runABEvaluation({ corpus, injected_knowledge: injected, candidate_id: "cand_d032110b-99af-4a58-82fd-26bc101c201b" });
const delta = computeABDelta(ab);
const attribution = computeAttribution(ab, delta);

let baselineStability: { stable: boolean; before_correct_run1: number; before_correct_run2: number } | null = null;
if (mode === "full") {
  const ab2 = runABEvaluation({ corpus, injected_knowledge: injected, candidate_id: "cand_d032110b-99af-4a58-82fd-26bc101c201b" });
  const delta2 = computeABDelta(ab2);
  baselineStability = {
    stable: delta.before_correct === delta2.before_correct,
    before_correct_run1: delta.before_correct,
    before_correct_run2: delta2.before_correct,
  };
  ab2.cleanup();
}

const corpusHashPost = createHash("sha256").update(JSON.stringify(corpus.cases)).digest("hex").slice(0, 16);
const hashUnchanged = corpusHash === corpusHashPost;

let verdict: "IMPROVED" | "NO_VALID_IMPROVEMENT" | "FAILED" | "UNEXPLAINED";
const allAttribOk = attribution.every((a) => a.attribution_ok);
if (delta.regressions > 0) verdict = "FAILED";
else if (delta.improvements > 0 && delta.delta > 0 && allAttribOk) verdict = "IMPROVED";
else if (delta.delta === 0 && delta.improvements === 0) verdict = "NO_VALID_IMPROVEMENT";
else verdict = "UNEXPLAINED";

const out = {
  phase: "W5-1-a-2 · independent replication",
  mode,
  corpus_version: corpus.version,
  corpus_hash: corpusHash,
  corpus_hash_post: corpusHashPost,
  corpus_hash_unchanged: hashUnchanged,
  case_count: corpus.case_count,
  before_correct: delta.before_correct,
  after_correct: delta.after_correct,
  delta: delta.delta,
  improvements: delta.improvements,
  regressions: delta.regressions,
  unchanged: delta.unchanged,
  verdict,
  baseline_stability: baselineStability,
  attribution_all_ok: allAttribOk,
  attribution,
  per_case: delta.per_case,
  global_knowledge_bytes_pre: ab.global_knowledge_bytes,
  global_knowledge_bytes_post: ab.global_knowledge_bytes_post,
  global_knowledge_unchanged: ab.global_knowledge_bytes === ab.global_knowledge_bytes_post,
  candidate_id: "cand_d032110b-99af-4a58-82fd-26bc101c201b",
  candidate_promoted: false,
  candidate_status: "AWAITING_APPROVAL (unchanged)",
};
console.log("W5_1_A_2_RESULT:" + JSON.stringify(out, null, 2));
ab.cleanup();
`;

const dir = path.resolve(process.cwd(), "scripts", ".w5-1-a-2-runner");
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
const tsPath = path.join(dir, "runner.ts");
writeFileSync(tsPath, inner, "utf8");
process.on("exit", () => { try { unlinkSync(tsPath); } catch { /* */ } });

function runOnce(mode) {
  return new Promise((resolve, reject) => {
    let out = "";
    const child = spawn(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["tsx", tsPath, mode],
      { cwd: process.cwd(), env: { ...process.env, NODE_NO_WARNINGS: "1" }, shell: true }
    );
    child.stdout.on("data", (d) => { out += d.toString(); process.stdout.write(d); });
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("exit", (code) => code === 0 ? resolve(out) : reject(new Error("exit " + code)));
  });
}

const primaryOut = await runOnce("full");
console.log("\n===== W5-1-a-2 FRESH PROCESS VERIFICATION =====\n");
const freshOut = await runOnce("full");

function extract(out) {
  const m = out.match(/W5_1_A_2_RESULT:(\{[\s\S]*?\n\})/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
const primary = extract(primaryOut);
const fresh = extract(freshOut);
const reproducible = !!(primary && fresh
  && primary.corpus_hash === fresh.corpus_hash
  && primary.before_correct === fresh.before_correct
  && primary.after_correct === fresh.after_correct
  && primary.delta === fresh.delta
  && primary.verdict === fresh.verdict);

console.log("\nW5_1_A_2_FRESH_PROCESS_VERIFICATION:" + JSON.stringify({
  primary_hash: primary?.corpus_hash,
  fresh_hash: fresh?.corpus_hash,
  primary_verdict: primary?.verdict,
  fresh_verdict: fresh?.verdict,
  primary_delta: primary?.delta,
  fresh_delta: fresh?.delta,
  reproducible,
}, null, 2));
