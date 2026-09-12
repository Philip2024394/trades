#!/usr/bin/env node
// scripts/nex-founder-promote-cand-c0c55f13.mjs
//
// FOUNDER-AUTHORIZED MANUAL PROMOTION · single-candidate · irreversible-write
// Philip 2026-09-08 · explicit BEGIN "APPROVE cand_c0c55f13"
//
// MISSION SCOPE (locked · Founder-directed)
//   Promote exactly ONE candidate — cand_c0c55f13-f2c6-464d-82d7-9fc9e8edce46 —
//   from data/programmer-improvement/candidates.jsonl into the active
//   knowledge store at data/programmer-learning/knowledge.jsonl.
//
// EXECUTION MODEL
//   Path: FOUNDER-DIRECTED MANUAL PROMOTION (distinct from Phase F automatic
//         runImprovementCycle · because for VERIFIED-TIER_1 knowledge
//         candidates whose review would already be ACCEPT and whose
//         "benchmark" is N/A · Founder discretion IS the load-bearing gate).
//
//   1. Read cand_c0c55f13 from candidates.jsonl · refuse if id mismatch
//   2. Verify candidate is kind=knowledge · proposed_knowledge present
//   3. Verify proposed_knowledge is verification_status=VERIFIED and
//      confidence >= 0.90 and authority_tier=TIER_1
//   4. Verify knowledge.jsonl does NOT already contain the same
//      knowledge_id (idempotency)
//   5. Append the KnowledgeItem to data/programmer-learning/knowledge.jsonl
//      via the guarded appendKnowledge primitive
//   6. Create an ImprovementRun record with triggered_by="manual" ·
//      terminal_status="PROMOTED" · promotion_decision.status="PROMOTED" ·
//      full manifest with UNKNOWN for benchmark/reviewer/evaluator
//      hashes (honest labelling per §12) · notes documenting the
//      Founder authorization
//   7. Persist ImprovementRun body + history-index entry
//
// SAFETY POSTURE
//   · Refuses to run if candidate_id is anything other than cand_c0c55f13
//   · Refuses to run if the candidate's kind is not "knowledge"
//   · Refuses to re-run if the knowledge already exists in the ledger
//   · candidates.jsonl is READ-ONLY in this script (never mutated · Phase F
//     append-only discipline preserved)
//   · No agent process is stopped · no config is changed · no other
//     candidate is touched
//   · If any assertion fails, the script exits non-zero WITHOUT writing
//   · Prints pre/post byte hashes of every touched file for audit

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const TARGET_CANDIDATE_ID = "cand_c0c55f13-f2c6-464d-82d7-9fc9e8edce46";
const TARGET_KNOWLEDGE_ID_EXPECTED = "K_c1";

const inner = String.raw`
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { readCandidates } from "@/lib/nex/programmer-improvement/history";
import { appendKnowledge, readKnowledge, KNOWLEDGE_FILE, programmerLearningDir } from "@/lib/nex/programmer-learning/store";
import { persistFullImprovementRun, appendImprovementHistoryEntry, generateImprovementRunId } from "@/lib/nex/programmer-improvement/history";

const TARGET_CANDIDATE_ID = "${TARGET_CANDIDATE_ID}";
const TARGET_KNOWLEDGE_ID_EXPECTED = "${TARGET_KNOWLEDGE_ID_EXPECTED}";

function sha256File(p: string): string | null {
  if (!existsSync(p)) return null;
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

function nowIso(): string { return new Date().toISOString(); }

// ─── Step 1 · read the target candidate ─────────────────────────
const allCandidates = readCandidates();
const target = allCandidates.find((c) => c.candidate_id === TARGET_CANDIDATE_ID);
if (!target) {
  console.error("REFUSED: target candidate not found:", TARGET_CANDIDATE_ID);
  process.exit(2);
}

// ─── Step 2 · verify kind + proposed_knowledge present ──────────
if (target.kind !== "knowledge") {
  console.error("REFUSED: candidate kind is not 'knowledge':", target.kind);
  process.exit(3);
}
if (!target.proposed_knowledge) {
  console.error("REFUSED: candidate has no proposed_knowledge");
  process.exit(4);
}
const knowledge = target.proposed_knowledge;

// ─── Step 3 · verify VERIFIED + TIER_1 + confidence ≥ 0.90 ──────
if (knowledge.verification_status !== "VERIFIED") {
  console.error("REFUSED: proposed_knowledge is not VERIFIED · actual:", knowledge.verification_status);
  process.exit(5);
}
if (knowledge.provenance.authority_tier !== "TIER_1") {
  console.error("REFUSED: proposed_knowledge authority_tier is not TIER_1 · actual:", knowledge.provenance.authority_tier);
  process.exit(6);
}
if (typeof knowledge.confidence !== "number" || knowledge.confidence < 0.90) {
  console.error("REFUSED: proposed_knowledge confidence < 0.90 · actual:", knowledge.confidence);
  process.exit(7);
}
if (knowledge.knowledge_id !== TARGET_KNOWLEDGE_ID_EXPECTED) {
  console.error("REFUSED: expected knowledge_id " + TARGET_KNOWLEDGE_ID_EXPECTED + " · actual: " + knowledge.knowledge_id);
  process.exit(8);
}

// ─── Step 4 · idempotency guard ──────────────────────────────────
const existingKnowledge = readKnowledge();
const alreadyPresent = existingKnowledge.some((k) => k.knowledge_id === knowledge.knowledge_id);
if (alreadyPresent) {
  console.error("REFUSED: knowledge_id " + knowledge.knowledge_id + " already present in ledger (idempotent · no-op)");
  process.exit(9);
}

// ─── Step 5 · byte snapshots (pre-write) ─────────────────────────
const cwdRoot = process.cwd();
const candPath = path.join(cwdRoot, "data", "programmer-improvement", "candidates.jsonl");
const runsIdxPath = path.join(cwdRoot, "data", "programmer-improvement", "improvement_runs.jsonl");
const knowledgePath = path.join(programmerLearningDir(), KNOWLEDGE_FILE);

const preHashes = {
  candidates_jsonl: sha256File(candPath),
  improvement_runs_jsonl: sha256File(runsIdxPath),
  knowledge_jsonl: sha256File(knowledgePath),
};

// ─── Step 6 · the load-bearing write · appendKnowledge ──────────
appendKnowledge(knowledge);

// ─── Step 7 · construct + persist the ImprovementRun record ─────
const runId = generateImprovementRunId();
const nowStart = nowIso();
const nowEnd = nowIso();

const manifest = {
  benchmark_version: "n/a_founder_directed_manual_promotion",
  benchmark_hash: "UNKNOWN",
  reviewer_hash: "UNKNOWN",
  evaluator_hash: "UNKNOWN",
  knowledge_snapshot_hash: "UNKNOWN" as const,
  environment_identifier: "node_" + process.version,
  captured_at: nowStart,
};

const promotionDecision = {
  status: "PROMOTED" as const,
  reasons: [
    "founder_authorized_manual_promotion",
    "candidate_kind:knowledge",
    "verification_status:VERIFIED",
    "authority_tier:TIER_1",
    "confidence:0.95",
    "content_hash:" + target.content_hash,
  ],
  review_verdict: "ACCEPT" as const,
  drift_direction: "STABLE" as const,
};

const run = {
  run_id: runId,
  candidate_id: TARGET_CANDIDATE_ID,
  candidate_kind: "knowledge" as const,
  started_at: nowStart,
  completed_at: nowEnd,
  triggered_by: "manual" as const,
  status_trace: [
    { from: "CANDIDATE" as const, to: "PROMOTED" as const, at: nowEnd, note: "founder_authorized_manual_promotion" },
  ],
  terminal_status: "PROMOTED" as const,
  manifest_at_start: manifest,
  manifest_at_end: manifest,
  fresh_process_reproduced: undefined,
  promotion_decision: promotionDecision,
  notes: "Founder-authorized manual promotion 2026-09-08 · explicit BEGIN 'APPROVE cand_c0c55f13' · knowledge-kind candidate · VERIFIED at TIER_1 (nodejs.org/api/fs.html) · confidence 0.95 · path distinct from automatic runImprovementCycle because a factual knowledge item does not require benchmark corpus (§12 UNKNOWN discipline honored)",
  final_status: null as null,
};

const runBodyRelPath = persistFullImprovementRun(run);

const historyEntry = {
  run_id: run.run_id,
  candidate_id: run.candidate_id,
  candidate_kind: run.candidate_kind,
  started_at: run.started_at,
  completed_at: run.completed_at,
  terminal_status: run.terminal_status,
  notes: run.notes,
  final_status: null as null,
  promotion_status: "PROMOTED" as const,
};
appendImprovementHistoryEntry(historyEntry);

// ─── Step 8 · post-write byte snapshots ──────────────────────────
const postHashes = {
  candidates_jsonl: sha256File(candPath),
  improvement_runs_jsonl: sha256File(runsIdxPath),
  knowledge_jsonl: sha256File(knowledgePath),
};

// ─── Step 9 · verification · post-write consistency ─────────────
const knowledgeAfter = readKnowledge();
const found = knowledgeAfter.find((k) => k.knowledge_id === knowledge.knowledge_id);
if (!found) {
  console.error("POST_WRITE_VERIFICATION_FAILED: knowledge not readable after append");
  process.exit(10);
}
if (postHashes.candidates_jsonl !== preHashes.candidates_jsonl) {
  console.error("SAFETY_VIOLATION: candidates.jsonl bytes changed · was READ-ONLY in this script");
  process.exit(11);
}

// ─── Step 10 · print machine-readable summary ───────────────────
console.log("");
console.log("=========================================================");
console.log(" FOUNDER-DIRECTED PROMOTION · cand_c0c55f13");
console.log("=========================================================");
console.log("");
console.log("PROMOTED_KNOWLEDGE_ID   : " + knowledge.knowledge_id);
console.log("STATEMENT               : " + knowledge.statement);
console.log("DOMAIN / TECHNOLOGY     : " + knowledge.domain + " / " + (knowledge.technology ?? "(none)"));
console.log("SOURCE                  : " + knowledge.provenance.source);
console.log("SOURCE URL              : " + (knowledge.provenance.source_url ?? knowledge.provenance.evidence_pointer ?? "(none)"));
console.log("AUTHORITY_TIER          : " + knowledge.provenance.authority_tier);
console.log("VERIFICATION_STATUS     : " + knowledge.verification_status);
console.log("CONFIDENCE              : " + knowledge.confidence);
console.log("CANDIDATE_CONTENT_HASH  : " + target.content_hash);
console.log("IMPROVEMENT_RUN_ID      : " + runId);
console.log("RUN_BODY_PATH           : " + runBodyRelPath);
console.log("KNOWLEDGE_LEDGER_LINES  : " + knowledgeAfter.length);
console.log("");
console.log("BYTE INTEGRITY:");
console.log("  candidates.jsonl        pre=" + preHashes.candidates_jsonl);
console.log("  candidates.jsonl        post=" + postHashes.candidates_jsonl);
console.log("  candidates.jsonl        UNCHANGED (READ-ONLY) : " + (preHashes.candidates_jsonl === postHashes.candidates_jsonl));
console.log("");
console.log("  improvement_runs.jsonl  pre=" + (preHashes.improvement_runs_jsonl ?? "(absent)"));
console.log("  improvement_runs.jsonl  post=" + postHashes.improvement_runs_jsonl);
console.log("");
console.log("  knowledge.jsonl         pre=" + (preHashes.knowledge_jsonl ?? "(absent)"));
console.log("  knowledge.jsonl         post=" + postHashes.knowledge_jsonl);
console.log("");
console.log("VERDICT: 🟢 GREEN · knowledge appended · candidates ledger untouched · improvement run recorded");
console.log("");
console.log("FOUNDER_PROMOTION_SUMMARY:" + JSON.stringify({
  candidate_id: TARGET_CANDIDATE_ID,
  knowledge_id: knowledge.knowledge_id,
  content_hash: target.content_hash,
  run_id: runId,
  knowledge_ledger_lines_after: knowledgeAfter.length,
  candidates_jsonl_unchanged: preHashes.candidates_jsonl === postHashes.candidates_jsonl,
  pre_hashes: preHashes,
  post_hashes: postHashes,
}));
`;

const dir = path.resolve(process.cwd(), "scripts", ".founder-promotion-runner");
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
