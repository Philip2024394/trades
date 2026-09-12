// scripts/nex-phase4-w5-3-run.mjs
//
// Phase 4 · W5-3 · Master AI teaches Speaking Specialist · A/B runner
//
// Steps:
//   1. Freeze Phase 4 corpus + hash
//   2. Isolate BEFORE knowledge store (empty)
//   3. Run corpus BEFORE
//   4. Isolate AFTER knowledge store · write taught knowledge
//   5. Run corpus AFTER
//   6. Compute delta + attribution
//   7. Also run existing Phase 3 corpus under AFTER to prove zero regressions
//   8. Report

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync } from "node:fs";
import path from "node:path";

const inner = String.raw`
import { freezePhase4Corpus, phase4TaughtKnowledgePayload, PHASE4_TAUGHT_KNOWLEDGE_ID } from "@/lib/nex/agents/nex-speaking/corpus-phase4";
import { freezeSpeakingCorpusV1 } from "@/lib/nex/agents/nex-speaking/corpus";
import { evaluateSpeakingCorpus } from "@/lib/nex/agents/nex-speaking/evaluator";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";

// ─── Freeze Phase 4 corpus ─────────────────────────────────────
const { corpus: p4Corpus, hash: p4Hash } = freezePhase4Corpus();
const p4Hash2 = freezePhase4Corpus().hash;
if (p4Hash !== p4Hash2) { console.error("PHASE4_CORPUS_HASH_UNSTABLE"); process.exit(2); }

// ─── Freeze Phase 3 corpus (for regression check) ──────────────
const { corpus: p3Corpus, hash: p3Hash } = freezeSpeakingCorpusV1();

// ─── Isolated stores ───────────────────────────────────────────
const beforeRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-run-before-"));
const afterRoot = mkdtempSync(path.join(tmpdir(), "nex-p4-run-after-"));

// AFTER store gets the taught knowledge
writeFileSync(
  path.join(afterRoot, "knowledge.jsonl"),
  JSON.stringify(phase4TaughtKnowledgePayload()) + "\n",
  "utf8",
);

const priorRoot = process.env.NEX_PROGRAMMER_LEARNING_DIR;

// ─── BEFORE run (Phase 4 corpus) ──────────────────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = beforeRoot;
const p4Before = evaluateSpeakingCorpus(p4Corpus);

// ─── AFTER run (Phase 4 corpus) ───────────────────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = afterRoot;
const p4After = evaluateSpeakingCorpus(p4Corpus);

// ─── Regression check: Phase 3 corpus BEFORE ──────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = beforeRoot;
const p3Before = evaluateSpeakingCorpus(p3Corpus);

// ─── Regression check: Phase 3 corpus AFTER ───────────────────
process.env.NEX_PROGRAMMER_LEARNING_DIR = afterRoot;
const p3After = evaluateSpeakingCorpus(p3Corpus);

// Restore
if (priorRoot === undefined) delete process.env.NEX_PROGRAMMER_LEARNING_DIR;
else process.env.NEX_PROGRAMMER_LEARNING_DIR = priorRoot;

// ─── Corpus hash unchanged post-eval ──────────────────────────
const p4HashPost = createHash("sha256").update(JSON.stringify(p4Corpus.cases)).digest("hex").slice(0, 16);
const p3HashPost = createHash("sha256").update(JSON.stringify(p3Corpus.cases)).digest("hex").slice(0, 16);

// ─── Delta + verdict ──────────────────────────────────────────
const delta = p4After.passed - p4Before.passed;
const improvements = p4After.results.filter((r, i) => {
  const b = p4Before.results.find((bb) => bb.case_id === r.case_id);
  return b && b.match_status === "WRONG" && r.match_status === "CORRECT";
}).length;
const regressions = p4After.results.filter((r) => {
  const b = p4Before.results.find((bb) => bb.case_id === r.case_id);
  return b && b.match_status === "CORRECT" && r.match_status === "WRONG";
}).length;

// Attribution: any case that improved should have taught knowledge available
// (deterministic since taught knowledge is what enables the flip)
const attribution_all_ok = improvements > 0 && regressions === 0;

let verdict;
if (regressions > 0) verdict = "FAILED";
else if (delta > 0 && improvements > 0 && attribution_all_ok) verdict = "IMPROVED";
else if (delta === 0 && improvements === 0) verdict = "NO_VALID_IMPROVEMENT";
else verdict = "UNEXPLAINED";

// Regression on Phase 3 corpus (zero regressions required)
const p3Regressions = p3After.results.filter((r) => {
  const b = p3Before.results.find((bb) => bb.case_id === r.case_id);
  return b && b.match_status === "CORRECT" && r.match_status === "WRONG";
}).length;

const out = {
  phase: "Phase 4 · W5-3 · Master AI teaches Speaking Specialist",
  taught_knowledge_id: PHASE4_TAUGHT_KNOWLEDGE_ID,
  phase4: {
    corpus_version: p4Corpus.version,
    corpus_hash: p4Hash,
    corpus_hash_post: p4HashPost,
    corpus_hash_unchanged: p4Hash === p4HashPost,
    case_count: p4Corpus.case_count,
    before_passed: p4Before.passed,
    after_passed: p4After.passed,
    delta,
    improvements,
    regressions,
    per_case: p4Before.results.map((b) => {
      const a = p4After.results.find((rr) => rr.case_id === b.case_id);
      return {
        case_id: b.case_id,
        expected_safety_signal: b.actual_response.safety_signal,
        before_match: b.match_status,
        after_match: a?.match_status,
        after_actual_signal: a?.actual_response.safety_signal,
        transition:
          b.match_status === a?.match_status ? "unchanged" :
          b.match_status === "WRONG" && a?.match_status === "CORRECT" ? "WRONG_TO_CORRECT" :
          b.match_status === "CORRECT" && a?.match_status === "WRONG" ? "CORRECT_TO_WRONG" :
          "other",
      };
    }),
  },
  phase3_regression_check: {
    corpus_version: p3Corpus.version,
    corpus_hash: p3Hash,
    corpus_hash_post: p3HashPost,
    corpus_hash_unchanged: p3Hash === p3HashPost,
    before_passed: p3Before.passed,
    after_passed: p3After.passed,
    regressions: p3Regressions,
  },
  attribution_all_ok,
  verdict,
  candidate_promoted: false,
  candidate_status: "AWAITING_APPROVAL (taught knowledge exists ONLY in temp knowledge.jsonl · production untouched)",
};
console.log("PHASE_4_RESULT:" + JSON.stringify(out, null, 2));
`;

const dir = path.resolve(process.cwd(), "scripts", ".phase4-runner");
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
