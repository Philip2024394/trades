#!/usr/bin/env node
// scripts/nex-m2-verify-k-c1.mjs
//
// MILESTONE 2 VERIFICATION · K_c1 · Founder BEGIN 2026-09-08
//
// Confirms whether K_c1 (fs.readFileSync EISDIR knowledge) materially
// improves reviewer performance on real nodejs.fs code-review cases.
//
// DISCIPLINE (per Milestone 1 vs 2 doctrine 2026-09-08):
//   · NOT measurement theatre · realistic representative cases
//   · Env-isolated harness (NEX_PROGRAMMER_LEARNING_DIR to OS temp)
//   · Production knowledge.jsonl NEVER read/written by this harness
//   · A/B: BEFORE knowledge injection · AFTER K_c1 injection
//   · Same reviewer code · same corpus · only variable = knowledge presence
//   · Score against 5 Milestone 2 criteria honestly
//   · No synthesis of favourable results

import { spawn } from "node:child_process";
import { writeFileSync, existsSync, mkdirSync, unlinkSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const inner = String.raw`
import { mkdirSync, writeFileSync, existsSync, appendFileSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import path from "node:path";
import { review } from "@/lib/nex/programmer-review/reviewer";
import type { ReviewRequest, ReviewResponse } from "@/lib/nex/programmer-review/types";

function sha256File(p: string): string | null {
  if (!existsSync(p)) return null;
  return createHash("sha256").update(readFileSync(p)).digest("hex");
}

// ─── 3 realistic nodejs.fs review cases (representative · not staged) ─

const K_C1_KNOWLEDGE = {
  knowledge_id: "K_c1",
  statement: "fs.readFileSync(directoryPath) throws EISDIR",
  domain: "nodejs.fs",
  technology: "node",
  provenance: {
    source: "node-fs-docs",
    source_type: "external_documentation" as const,
    source_url: "https://nodejs.org/api/fs.html",
    authority_tier: "TIER_1" as const,
    retrieved_at: "2026-09-05T21:27:40.297Z",
    evidence_pointer: "https://nodejs.org/api/fs.html",
    observed_by: "human" as const,
  },
  verification_status: "VERIFIED" as const,
  confidence: 0.95,
  content_hash: "K_c1_hash",
  created_at: "2026-09-05T21:27:40.297Z",
};

// Realistic case 1: Node.js fs code that reads a user-supplied path · MUST handle EISDIR
const CASE_1: ReviewRequest = {
  review_id: "m2_case_1_fs_readfilesync_user_path",
  requirement: "Load file at user-supplied path and return contents. Must handle the case where path is a directory (fs error).",
  requirement_details: {
    edge_cases_required: ["path is a directory", "path does not exist", "empty file"],
    edge_cases_covered: ["path does not exist", "empty file"],  // MISSING: directory case
    security_requirements: [],
    security_violations_observed: [],
  },
  implementation: {
    summary: "Uses fs.readFileSync to read path. Wraps in try/catch. Returns null on ENOENT, otherwise returns contents.",
    claim: "Handles missing files gracefully. Reads text files reliably.",
    files: ["src/lib/loadFile.ts"],
    claimed_by: "claude",
  },
  tests: {
    passed: 3,
    failed: 0,
    summary: "Tested with existing file, missing file (ENOENT), and empty file. Returns null on missing, contents otherwise.",
    files: ["src/lib/loadFile.test.ts"],
    known_gaps: [],
  },
  runtime_evidence: [],
  relevant_knowledge_ids: [],       // will be filled per-A/B run
  reviewer_timestamp: new Date().toISOString(),
};

// Realistic case 2: Node.js fs code that already handles EISDIR explicitly (should not be flagged)
const CASE_2: ReviewRequest = {
  review_id: "m2_case_2_fs_readfilesync_handles_eisdir",
  requirement: "Read file at path; return null for ENOENT and for EISDIR (path is directory).",
  requirement_details: {
    edge_cases_required: ["path is a directory", "path does not exist"],
    edge_cases_covered: ["path is a directory", "path does not exist"],
    security_requirements: [],
    security_violations_observed: [],
  },
  implementation: {
    summary: "fs.readFileSync inside try/catch. On EISDIR (directory path) returns null. On ENOENT returns null. Otherwise returns contents.",
    claim: "Handles both missing-file and directory-path cases correctly per nodejs fs semantics.",
    files: ["src/lib/loadFile2.ts"],
    claimed_by: "claude",
  },
  tests: {
    passed: 4,
    failed: 0,
    summary: "Tested with file, missing file (ENOENT), directory (EISDIR throws), and empty file. All cases return expected results.",
    files: ["src/lib/loadFile2.test.ts"],
    known_gaps: [],
  },
  runtime_evidence: [],
  relevant_knowledge_ids: [],
  reviewer_timestamp: new Date().toISOString(),
};

// Realistic case 3: Non-nodejs.fs domain · control · knowledge should NOT influence
const CASE_3: ReviewRequest = {
  review_id: "m2_case_3_control_react_button",
  requirement: "React button component must call onClick handler when pressed and be keyboard-accessible.",
  requirement_details: {
    edge_cases_required: ["keyboard press", "double click"],
    edge_cases_covered: ["keyboard press", "double click"],
    security_requirements: [],
    security_violations_observed: [],
  },
  implementation: {
    summary: "Renders a native button element with type='button', onClick prop wired, and role/aria attributes set for a11y.",
    claim: "Fully accessible button with click and keyboard handling.",
    files: ["src/components/Button.tsx"],
    claimed_by: "claude",
  },
  tests: {
    passed: 5,
    failed: 0,
    summary: "Tested click handler, Enter key press, Space key press, disabled state, and double-click debouncing. All passed.",
    files: ["src/components/Button.test.tsx"],
    known_gaps: [],
  },
  runtime_evidence: [],
  relevant_knowledge_ids: [],
  reviewer_timestamp: new Date().toISOString(),
};

const CASES = [CASE_1, CASE_2, CASE_3];

// ─── Env-isolated harness · production ledger never touched ─────

const productionKnowledgePath = path.resolve(process.cwd(), "data", "programmer-learning", "knowledge.jsonl");
const productionKnowledgeHashPre = sha256File(productionKnowledgePath);

const beforeDir = "" + tmpdir() + path.sep + "nex-m2-before-" + Math.random().toString(36).slice(2, 10);
const afterDir  = "" + tmpdir() + path.sep + "nex-m2-after-"  + Math.random().toString(36).slice(2, 10);
mkdirSync(beforeDir, { recursive: true });
mkdirSync(afterDir, { recursive: true });

// BEFORE store: empty knowledge · no injection · NEX_PROGRAMMER_LEARNING_DIR points here
// AFTER store: K_c1 injected · NEX_PROGRAMMER_LEARNING_DIR points here
writeFileSync(path.join(afterDir, "knowledge.jsonl"), JSON.stringify(K_C1_KNOWLEDGE) + "\n", "utf8");

function runReviewWithStore(dir: string, req: ReviewRequest, knowledgeIds: string[]): ReviewResponse {
  const prior = process.env.NEX_PROGRAMMER_LEARNING_DIR;
  process.env.NEX_PROGRAMMER_LEARNING_DIR = dir;
  try {
    const withIds = { ...req, relevant_knowledge_ids: knowledgeIds };
    return review(withIds);
  } finally {
    if (prior === undefined) delete process.env.NEX_PROGRAMMER_LEARNING_DIR;
    else process.env.NEX_PROGRAMMER_LEARNING_DIR = prior;
  }
}

// ─── Run BEFORE (no knowledge) and AFTER (K_c1 available and requested) ─

interface CaseResult {
  case_id: string;
  before: { verdict: string; findings_count: number; knowledge_used: string[]; findings_r6: number };
  after:  { verdict: string; findings_count: number; knowledge_used: string[]; findings_r6: number };
  delta: {
    verdict_changed: boolean;
    findings_added: number;
    k_c1_retrieved: boolean;
    k_c1_influential: boolean;
  };
}

const results: CaseResult[] = [];

for (const c of CASES) {
  const before = runReviewWithStore(beforeDir, c, []);
  // Only pass K_c1 as relevant knowledge for cases in nodejs.fs domain
  const isNodejsDomain = /nodejs|node\.?js|fs\.readfilesync|readfilesync/i.test(c.requirement + " " + c.implementation.summary);
  const knowledgeIdsForAfter = isNodejsDomain ? ["K_c1"] : ["K_c1"]; // Always pass · reviewer's gates decide
  const after = runReviewWithStore(afterDir, c, knowledgeIdsForAfter);

  const r6Before = before.findings.filter((f) => f.finding_id.startsWith("kf")).length;
  const r6After = after.findings.filter((f) => f.finding_id.startsWith("kf")).length;

  results.push({
    case_id: c.review_id,
    before: {
      verdict: before.verdict,
      findings_count: before.findings.length,
      knowledge_used: before.knowledge_used,
      findings_r6: r6Before,
    },
    after: {
      verdict: after.verdict,
      findings_count: after.findings.length,
      knowledge_used: after.knowledge_used,
      findings_r6: r6After,
    },
    delta: {
      verdict_changed: before.verdict !== after.verdict,
      findings_added: after.findings.length - before.findings.length,
      k_c1_retrieved: after.knowledge_used.includes("K_c1"),
      k_c1_influential: (r6After - r6Before) > 0,
    },
  });
}

// ─── Production ledger byte-integrity check ─────────────────────
const productionKnowledgeHashPost = sha256File(productionKnowledgePath);
const productionIsolated = productionKnowledgeHashPre === productionKnowledgeHashPost;

// ─── Milestone 2 · 5-criteria scoring ───────────────────────────

const anyRetrieved = results.some((r) => r.delta.k_c1_retrieved);
const anyRelevant = results.some((r) => r.after.knowledge_used.includes("K_c1"));
const anyInfluential = results.some((r) => r.delta.k_c1_influential);
const anyAccuracyPositive = results.some((r) => r.delta.verdict_changed && r.delta.findings_added > 0);
const controlCaseUnchanged = results.find((r) => r.case_id.includes("control"))
  ? !results.find((r) => r.case_id.includes("control"))!.delta.k_c1_influential
  : true;
const regressionNeutral = controlCaseUnchanged && !results.some((r) =>
  r.case_id.includes("control") && r.delta.verdict_changed
);

const milestone2 = {
  criterion_1_retrieved: anyRetrieved,
  criterion_2_relevant: anyRelevant,
  criterion_3_influential: anyInfluential,
  criterion_4_accuracy_positive: anyAccuracyPositive,
  criterion_5_regression_neutral: regressionNeutral,
  all_5_pass: anyRetrieved && anyRelevant && anyInfluential && anyAccuracyPositive && regressionNeutral,
};

const verdict =
  milestone2.all_5_pass ? "🟢 GREEN — Milestone 2 EARNED"
  : (anyRetrieved && anyRelevant && !anyInfluential) ? "🟡 PARTIAL — infrastructure works · K_c1 shape does not yet trigger R6"
  : (anyRetrieved && !anyRelevant) ? "🟡 PARTIAL — retrieved but not relevant"
  : "⏳ NOT YET — mechanism did not fire";

console.log("");
console.log("=========================================================");
console.log(" MILESTONE 2 VERIFICATION · K_c1");
console.log("=========================================================");
console.log("");
console.log("PRODUCTION ISOLATION:");
console.log("  knowledge.jsonl pre  : " + (productionKnowledgeHashPre ?? "(absent)"));
console.log("  knowledge.jsonl post : " + (productionKnowledgeHashPost ?? "(absent)"));
console.log("  ISOLATED (byte-exact): " + productionIsolated);
console.log("");
console.log("A/B CASE RESULTS:");
for (const r of results) {
  console.log("  · " + r.case_id);
  console.log("      BEFORE: verdict=" + r.before.verdict + " findings=" + r.before.findings_count + " k_used=" + JSON.stringify(r.before.knowledge_used) + " r6=" + r.before.findings_r6);
  console.log("      AFTER : verdict=" + r.after.verdict  + " findings=" + r.after.findings_count  + " k_used=" + JSON.stringify(r.after.knowledge_used)  + " r6=" + r.after.findings_r6);
  console.log("      DELTA : verdict_changed=" + r.delta.verdict_changed + " findings_added=" + r.delta.findings_added + " k_c1_retrieved=" + r.delta.k_c1_retrieved + " k_c1_influential=" + r.delta.k_c1_influential);
}
console.log("");
console.log("MILESTONE 2 · 5-CRITERIA SCORE:");
console.log("  1. RETRIEVED           : " + (milestone2.criterion_1_retrieved ? "✅ YES" : "❌ NO"));
console.log("  2. RELEVANT            : " + (milestone2.criterion_2_relevant ? "✅ YES" : "❌ NO"));
console.log("  3. INFLUENTIAL         : " + (milestone2.criterion_3_influential ? "✅ YES" : "❌ NO"));
console.log("  4. ACCURACY-POSITIVE   : " + (milestone2.criterion_4_accuracy_positive ? "✅ YES" : "❌ NO"));
console.log("  5. REGRESSION-NEUTRAL  : " + (milestone2.criterion_5_regression_neutral ? "✅ YES" : "❌ NO"));
console.log("");
console.log("VERDICT: " + verdict);
console.log("");

console.log("M2_VERIFICATION_SUMMARY:" + JSON.stringify({
  production_isolated: productionIsolated,
  results,
  milestone2,
  verdict,
}));
`;

const dir = path.resolve(process.cwd(), "scripts", ".m2-runner");
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
