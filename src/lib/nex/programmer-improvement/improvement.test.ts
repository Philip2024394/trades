// src/lib/nex/programmer-improvement/improvement.test.ts
//
// NEX Programmer Agent · Phase F · unit tests
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §23 test requirements

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

import type {
  KnowledgeItem,
  SkillItem,
  ExperienceItem,
  Provenance,
} from "@/lib/nex/programmer-learning/types";
import type { ReviewRequest, ReviewResponse } from "@/lib/nex/programmer-review/types";
import type { EvaluationRun, OverallMetrics, ClassMetrics } from "@/lib/nex/programmer-benchmark/types";
import type { DriftReport, StabilityRun, VersionManifest } from "@/lib/nex/programmer-stability/types";

import {
  createCandidate,
  validateCandidate,
  isDuplicateCandidate,
  advanceLifecycle,
  isTerminal,
  candidateContentHash,
} from "./candidate";
import { decidePromotion, auditPromoterIndependence, type PromoterInput } from "./promoter";
import {
  appendCandidate,
  readCandidates,
  appendImprovementHistoryEntry,
  readImprovementHistory,
  persistFullImprovementRun,
  readFullImprovementRun,
  readCandidateVersionChain,
  programmerImprovementDir,
  _resetImprovementStoreForTests,
} from "./history";
import {
  DEFAULT_IMPROVEMENT_THRESHOLDS,
  CANDIDATE_LIFECYCLE_ORDER,
  CANDIDATE_FAILURE_STATUSES,
  isPromoted,
  type CandidateStatus,
  type ImprovementHistoryEntry,
  type ImprovementRun,
  type LearningCandidate,
  type PhaseFForbiddenAction,
} from "./types";

// ─── Fixtures ──────────────────────────────────────────────────

const provenance = (over: Partial<Provenance> = {}): Provenance => ({
  source: "test-fixture",
  source_type: "internal_artifact",
  authority_tier: "TIER_2",
  retrieved_at: "2026-09-06T00:00:00Z",
  evidence_pointer: "test/fixtures/evidence.txt",
  observed_by: "test_runner",
  ...over,
});

const knowledge = (over: Partial<KnowledgeItem> = {}): KnowledgeItem => ({
  knowledge_id: "K1",
  statement: "fs.readFileSync with a directory throws EISDIR",
  domain: "nodejs.fs",
  technology: "node",
  provenance: provenance(),
  verification_status: "VERIFIED",
  confidence: 0.9,
  content_hash: "hash-k1",
  created_at: "2026-09-06T00:00:00Z",
  ...over,
});

const skill = (over: Partial<SkillItem> = {}): SkillItem => ({
  skill_id: "S1",
  name: "diagnose Node fs EISDIR",
  domain: "nodejs.fs",
  description: "recognize EISDIR and diagnose",
  confidence: 0.8,
  promotion_state: "PRACTICED",
  created_at: "2026-09-06T00:00:00Z",
  ...over,
});

const experience = (over: Partial<ExperienceItem> = {}): ExperienceItem => ({
  experience_id: "E1",
  task: "verify EISDIR handling",
  initial_hypothesis: "fs.readFile silently returns null on directory",
  action_taken: "wrote a script that reads a directory",
  files_involved: ["tests/eisdir.mjs"],
  expected_result: "should throw",
  actual_result: "threw EISDIR",
  evidence: ["tests/eisdir.log"],
  outcome: "success",
  lessons: ["absence of exception is not evidence of success"],
  timestamp: "2026-09-06T00:00:00Z",
  provenance: provenance(),
  ...over,
});

const validCandidate = (over: Partial<Parameters<typeof createCandidate>[0]> = {}) => createCandidate({
  kind: "knowledge",
  source_event_id: "evt_1",
  what_was_learned: "EISDIR is thrown by fs.readFileSync on directories",
  affects_capability: "diagnose_fs_defect",
  proposed_knowledge: knowledge(),
  supporting_evidence: ["tests/eisdir.log"],
  provenance: provenance(),
  now: "2026-09-06T00:00:00Z",
  candidate_id_override: "cand_test_1",
  ...over,
});

const mockReview = (verdict: ReviewResponse["verdict"]): ReviewResponse => ({
  review_id: "rev_1",
  verdict,
  confidence: "high",
  findings: verdict === "REJECT" || verdict === "NEEDS_CHANGES"
    ? [{ finding_id: "f1", severity: "MATERIAL", category: "correctness", message: "m", rationale: "r", evidence_pointer: "p", affected_behavior: "b", recommended_correction: "c" }]
    : [],
  evidence_inspected: ["test/evidence.txt"],
  knowledge_used: [],
  reasoning_trace: ["t1"],
  reviewer_timestamp: "2026-09-06T00:00:00Z",
});

const zeroOverall = (): OverallMetrics => ({
  total_cases: 0, correct: 0, wrong: 0, execution_error: 0, overall_accuracy: 0,
  defective_correct: 0, defective_total: 0, defective_catch_rate: 0,
  correct_correctly_accepted: 0, correct_total: 0, false_positive_rate: 0,
  uncertain_correct: 0, uncertain_total: 0, uncertain_accuracy: 0,
  tests_pass_but_code_wrong_correct: 0, tests_pass_but_code_wrong_total: 0, tests_pass_but_code_wrong_catch_rate: 0,
});

const mockEvaluation = (): EvaluationRun => ({
  run_id: "eval_1",
  corpus_version: "programmer-benchmark-v1",
  started_at: "2026-09-06T00:00:00Z",
  completed_at: "2026-09-06T00:01:00Z",
  triggered_by: "manual",
  results: [],
  overall: zeroOverall(),
  per_class: [],
  final_status: null,
});

const promoterInput = (over: Partial<PromoterInput> = {}): PromoterInput => ({
  candidate: validCandidate(),
  review: mockReview("ACCEPT"),
  benchmark: {
    current_evaluation: mockEvaluation(),
    all_thresholds_passed: true,
  },
  drift: null,
  fresh_process_reproduced: true,
  is_duplicate: false,
  thresholds: DEFAULT_IMPROVEMENT_THRESHOLDS,
  ...over,
});

// ═════════════ §23.1 Learning candidate creation ═════════════

describe("createCandidate", () => {
  it("produces a deterministic content_hash for identical semantic content", () => {
    const a = validCandidate({ candidate_id_override: "a" });
    const b = validCandidate({ candidate_id_override: "b" });
    expect(a.content_hash).toBe(b.content_hash);
    expect(a.candidate_id).not.toBe(b.candidate_id);
  });
  it("attaches provenance and evidence", () => {
    const c = validCandidate();
    expect(c.provenance.source).toBe("test-fixture");
    expect(c.supporting_evidence.length).toBeGreaterThan(0);
  });
  it("populates candidate_id automatically", () => {
    const c = createCandidate({
      kind: "knowledge",
      source_event_id: "evt_1",
      what_was_learned: "x",
      affects_capability: "y",
      proposed_knowledge: knowledge(),
      supporting_evidence: ["e"],
      provenance: provenance(),
    });
    expect(c.candidate_id).toMatch(/^cand_/);
  });
});

// ═════════════ §23.2 Evidence requirement ═════════════

describe("validateCandidate · §6 evidence requirement", () => {
  it("rejects candidate without supporting_evidence", () => {
    const c = createCandidate({
      kind: "knowledge",
      source_event_id: "evt",
      what_was_learned: "x",
      affects_capability: "y",
      proposed_knowledge: knowledge(),
      supporting_evidence: [],
      provenance: provenance(),
    });
    const v = validateCandidate(c);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("insufficient_evidence");
  });
  it("rejects candidate without source_event_id AND without evidence", () => {
    const c = createCandidate({
      kind: "knowledge",
      source_event_id: null,
      what_was_learned: "x",
      affects_capability: "y",
      proposed_knowledge: knowledge(),
      supporting_evidence: [],
      provenance: provenance(),
    });
    const v = validateCandidate(c);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("no_source_evidence");
  });
  it("rejects kind/payload mismatch", () => {
    const c = createCandidate({
      kind: "skill",
      source_event_id: "evt",
      what_was_learned: "x",
      affects_capability: "y",
      proposed_knowledge: knowledge(),      // wrong · should be proposed_skill
      supporting_evidence: ["e"],
      provenance: provenance(),
    });
    const v = validateCandidate(c);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("kind_content_mismatch");
  });
  it("accepts a well-formed candidate", () => {
    const v = validateCandidate(validCandidate());
    expect(v.ok).toBe(true);
  });
});

// ═════════════ §23.3 Candidate lifecycle ═════════════

describe("advanceLifecycle · §9 state machine", () => {
  it("forbids OBSERVED → PROMOTED shortcut", () => {
    const r = advanceLifecycle("OBSERVED", "PROMOTED");
    expect(r.ok).toBe(false);
  });
  it("allows OBSERVED → CANDIDATE", () => {
    expect(advanceLifecycle("OBSERVED", "CANDIDATE").ok).toBe(true);
  });
  it("allows STABLE → PROMOTED", () => {
    expect(advanceLifecycle("STABLE", "PROMOTED").ok).toBe(true);
  });
  it("forbids CANDIDATE → PROMOTED skip", () => {
    expect(advanceLifecycle("CANDIDATE", "PROMOTED").ok).toBe(false);
  });
  it("permits transition to failure states from any active state", () => {
    for (const from of CANDIDATE_LIFECYCLE_ORDER.slice(0, 6)) {
      for (const failure of CANDIDATE_FAILURE_STATUSES) {
        expect(advanceLifecycle(from, failure).ok).toBe(true);
      }
    }
  });
  it("forbids transitions from terminal states", () => {
    for (const t of ["PROMOTED", ...CANDIDATE_FAILURE_STATUSES] as CandidateStatus[]) {
      expect(advanceLifecycle(t, "OBSERVED").ok).toBe(false);
    }
  });
  it("isTerminal marks PROMOTED and failure states as terminal", () => {
    expect(isTerminal("PROMOTED")).toBe(true);
    expect(isTerminal("REJECTED")).toBe(true);
    expect(isTerminal("STABLE")).toBe(false);
  });
});

// ═════════════ §23.4/5/6 Knowledge / Skill / Experience promotion ═════════════

describe("decidePromotion · knowledge/skill/experience shape", () => {
  it("promotes valid knowledge candidate with clean review + threshold + fresh-proc", () => {
    const d = decidePromotion(promoterInput());
    expect(d.status).toBe("PROMOTED");
  });
  it("promotes valid skill candidate", () => {
    const skillCandidate = createCandidate({
      kind: "skill",
      source_event_id: "evt",
      what_was_learned: "x",
      affects_capability: "y",
      proposed_skill: skill(),
      supporting_evidence: ["e"],
      provenance: provenance(),
      candidate_id_override: "s1",
    });
    const d = decidePromotion(promoterInput({ candidate: skillCandidate }));
    expect(d.status).toBe("PROMOTED");
  });
  it("promotes valid experience candidate", () => {
    const expCandidate = createCandidate({
      kind: "experience",
      source_event_id: "evt",
      what_was_learned: "x",
      affects_capability: "y",
      proposed_experience: experience(),
      supporting_evidence: ["e"],
      provenance: provenance(),
      candidate_id_override: "e1",
    });
    const d = decidePromotion(promoterInput({ candidate: expCandidate }));
    expect(d.status).toBe("PROMOTED");
  });
});

// ═════════════ §23.7 Failed learning ═════════════

describe("decidePromotion · failure states are first-class", () => {
  it("REJECT review → REJECTED", () => {
    const d = decidePromotion(promoterInput({ review: mockReview("REJECT") }));
    expect(d.status).toBe("REJECTED");
    if (d.status === "REJECTED") expect(d.failure_reason).toBe("review_rejected");
  });
  it("NEEDS_CHANGES → REJECTED", () => {
    const d = decidePromotion(promoterInput({ review: mockReview("NEEDS_CHANGES") }));
    expect(d.status).toBe("REJECTED");
  });
  it("UNCERTAIN → UNPROVEN (§14)", () => {
    const d = decidePromotion(promoterInput({ review: mockReview("UNCERTAIN") }));
    expect(d.status).toBe("UNPROVEN");
  });
  it("benchmark below threshold → REGRESSED", () => {
    const d = decidePromotion(promoterInput({
      benchmark: { current_evaluation: mockEvaluation(), all_thresholds_passed: false },
    }));
    expect(d.status).toBe("REGRESSED");
  });
});

// ═════════════ §23.10/11 Regression rejection + per-class ═════════════

describe("decidePromotion · per-class regression (§8) + aggregate masking", () => {
  const driftWithClassRegression = (overall: DriftReport["overall_direction"]): DriftReport => ({
    baseline_run_id: "b", current_run_id: "c",
    attribution: { reviewer_changed: false, evaluator_changed: false, benchmark_changed: false, knowledge_changed: false, environment_changed: false, summary: "" },
    fingerprints_identical: false,
    overall_direction: overall,
    overall_delta: { defective_catch_rate: 0, false_positive_rate: 0, tests_pass_but_code_wrong_catch_rate: 0, uncertain_accuracy: 0 },
    per_class_drift: [{
      defect_class: "security.sql_injection",
      baseline_catch_rate: 1.0,
      current_catch_rate: 0.40,
      delta: -0.60,
      direction: "DEGRADED",
      reason: "class regression",
    }],
    verdict_flips: [],
    reasons: [],
  });

  it("per-class DEGRADED with rate < threshold → REGRESSED (per_class_regression)", () => {
    const d = decidePromotion(promoterInput({ drift: driftWithClassRegression("DEGRADED") }));
    expect(d.status).toBe("REGRESSED");
    if (d.status === "REGRESSED") expect(d.failure_reason).toBe("per_class_regression");
  });

  it("aggregate masking (§8) · overall STABLE while class DEGRADED → REGRESSED", () => {
    const d = decidePromotion(promoterInput({ drift: driftWithClassRegression("STABLE") }));
    expect(d.status).toBe("REGRESSED");
    if (d.status === "REGRESSED") {
      expect(d.failure_reason === "per_class_regression" || d.failure_reason === "aggregate_masking_detected").toBe(true);
    }
  });

  it("aggregate masking · overall IMPROVED while class DEGRADED → REGRESSED", () => {
    const d = decidePromotion(promoterInput({ drift: driftWithClassRegression("IMPROVED") }));
    expect(d.status).toBe("REGRESSED");
  });
});

// ═════════════ §23.13 Fresh-process reproduction requirement ═════════════

describe("decidePromotion · §15 fresh-process reproducibility", () => {
  it("required + not reproduced → UNPROVEN", () => {
    const d = decidePromotion(promoterInput({ fresh_process_reproduced: false }));
    expect(d.status).toBe("UNPROVEN");
    if (d.status === "UNPROVEN") expect(d.failure_reason).toBe("fingerprint_reproduction_failed");
  });
  it("required + reproduced → PROMOTED (all other checks pass)", () => {
    const d = decidePromotion(promoterInput({ fresh_process_reproduced: true }));
    expect(d.status).toBe("PROMOTED");
  });
});

// ═════════════ §23.15 Duplicate protection ═════════════

describe("isDuplicateCandidate + decidePromotion duplicate guard (§23)", () => {
  it("detects a duplicate by content hash", () => {
    const c1 = validCandidate({ candidate_id_override: "a" });
    const c2 = validCandidate({ candidate_id_override: "b" });
    expect(isDuplicateCandidate(c2, [c1])).toBe(true);
  });
  it("does not flag a distinct-content candidate as duplicate", () => {
    const c1 = validCandidate({ candidate_id_override: "a" });
    const c2 = createCandidate({
      kind: "knowledge",
      source_event_id: "evt",
      what_was_learned: "different fact",
      affects_capability: "y",
      proposed_knowledge: knowledge({ statement: "different statement" }),
      supporting_evidence: ["e"],
      provenance: provenance(),
      candidate_id_override: "b",
    });
    expect(isDuplicateCandidate(c2, [c1])).toBe(false);
  });
  it("promoter rejects duplicates outright", () => {
    const d = decidePromotion(promoterInput({ is_duplicate: true }));
    expect(d.status).toBe("REJECTED");
    if (d.status === "REJECTED") expect(d.failure_reason).toBe("duplicate_candidate");
  });
});

// ═════════════ §22 Anti-self-reinforcement (independence audit) ═════════════

describe("auditPromoterIndependence · §22", () => {
  it("candidate_self_report is NEVER used", () => {
    const input = promoterInput();
    const a = auditPromoterIndependence(input, decidePromotion(input));
    expect(a.used_candidate_self_report).toBe(false);
    expect(a.used_experience_self_report).toBe(false);
  });
  it("uses all independent signals", () => {
    const a = auditPromoterIndependence(promoterInput(), decidePromotion(promoterInput()));
    expect(a.used_review_verdict).toBe(true);
    expect(a.used_benchmark_thresholds).toBe(true);
    expect(a.used_fresh_process_reproduction).toBe(true);
    expect(a.used_duplicate_check).toBe(true);
  });
});

// ═════════════ §23.14 Attribution + history preservation ═════════════

describe("history · append-only + version chain (§16)", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "phase-f-history-"));
    process.env.NEX_PROGRAMMER_IMPROVEMENT_DIR = tmpDir;
    _resetImprovementStoreForTests();
  });

  it("readCandidates on empty store returns []", () => {
    expect(readCandidates()).toEqual([]);
  });

  it("appendCandidate persists · rejects duplicate id", () => {
    const c = validCandidate();
    appendCandidate(c);
    expect(readCandidates().length).toBe(1);
    expect(() => appendCandidate(c)).toThrow(/historical_mutation_rejected/);
  });

  it("appendImprovementHistoryEntry rejects duplicate run_id", () => {
    const entry: ImprovementHistoryEntry = {
      run_id: "improve_r1",
      candidate_id: "cand_1",
      candidate_kind: "knowledge",
      started_at: "2026-09-06T00:00:00Z",
      completed_at: "2026-09-06T00:01:00Z",
      terminal_status: "PROMOTED",
      notes: "test",
      final_status: null,
    };
    appendImprovementHistoryEntry(entry);
    expect(() => appendImprovementHistoryEntry(entry)).toThrow(/historical_mutation_rejected/);
  });

  it("history rejects final_status != null (Op-Truth §OP.5)", () => {
    const entry = {
      run_id: "r1", candidate_id: "c1", candidate_kind: "knowledge",
      started_at: "s", completed_at: "e", terminal_status: "PROMOTED",
      notes: "", final_status: "SUCCESS" as never,
    };
    expect(() => appendImprovementHistoryEntry(entry as unknown as ImprovementHistoryEntry)).toThrow(/Op-Truth/);
  });

  it("readCandidateVersionChain filters by candidate_id", () => {
    appendImprovementHistoryEntry({
      run_id: "r1", candidate_id: "cA", candidate_kind: "knowledge",
      started_at: "s", completed_at: "e", terminal_status: "REJECTED",
      notes: "", final_status: null,
    });
    appendImprovementHistoryEntry({
      run_id: "r2", candidate_id: "cA", candidate_kind: "knowledge",
      started_at: "s2", completed_at: "e2", terminal_status: "PROMOTED",
      notes: "", final_status: null,
    });
    appendImprovementHistoryEntry({
      run_id: "r3", candidate_id: "cB", candidate_kind: "skill",
      started_at: "s3", completed_at: "e3", terminal_status: "PROMOTED",
      notes: "", final_status: null,
    });
    expect(readCandidateVersionChain("cA").length).toBe(2);
    expect(readCandidateVersionChain("cB").length).toBe(1);
  });

  it("rejected candidates remain in the history log (§16 failure visibility)", () => {
    appendImprovementHistoryEntry({
      run_id: "r_fail", candidate_id: "cX", candidate_kind: "knowledge",
      started_at: "s", completed_at: "e", terminal_status: "REJECTED",
      notes: "review_rejected", final_status: null,
    });
    const chain = readCandidateVersionChain("cX");
    expect(chain[0].terminal_status).toBe("REJECTED");
  });

  it("persistFullImprovementRun rejects final_status != null", () => {
    const run: ImprovementRun = {
      run_id: "r_bad", candidate_id: "c", candidate_kind: "knowledge",
      started_at: "s", completed_at: "e", triggered_by: "test",
      status_trace: [], terminal_status: "PROMOTED",
      manifest_at_start: {} as VersionManifest, manifest_at_end: {} as VersionManifest,
      notes: "", final_status: "SUCCESS" as never,
    };
    expect(() => persistFullImprovementRun(run)).toThrow(/Op-Truth/);
  });

  it("path traversal is refused (Phase-F write guard)", () => {
    // Attempt to write outside the improvement dir via a crafted candidate id
    // (the guard is in pathFor · exercised indirectly through appendCandidate)
    const runOutside: ImprovementRun = {
      run_id: "../../etc/passwd", candidate_id: "c", candidate_kind: "knowledge",
      started_at: "s", completed_at: "e", triggered_by: "test",
      status_trace: [], terminal_status: "PROMOTED",
      manifest_at_start: {} as VersionManifest, manifest_at_end: {} as VersionManifest,
      notes: "", final_status: null,
    };
    expect(() => persistFullImprovementRun(runOutside)).toThrow(/forbidden|traversal|Phase-F/i);
  });
});

// ═════════════ §23.17 Corrupted learning record ═════════════

describe("history · malformed lines are skipped", () => {
  let tmpDir: string;
  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "phase-f-corrupt-"));
    process.env.NEX_PROGRAMMER_IMPROVEMENT_DIR = tmpDir;
    _resetImprovementStoreForTests();
  });

  it("continues reading after a corrupted line in candidates.jsonl", () => {
    const c1 = validCandidate({ candidate_id_override: "a" });
    appendCandidate(c1);
    // Inject a corrupt line directly
    const abs = path.join(tmpDir, "candidates.jsonl");
    const raw = readFileSync(abs, "utf8");
    require("node:fs").writeFileSync(abs, raw + "{not json\n" + JSON.stringify({ ...c1, candidate_id: "b" }) + "\n", "utf8");
    const all = readCandidates();
    // Should include the two valid entries and skip the malformed line
    expect(all.map((c) => c.candidate_id).sort()).toEqual(["a", "b"]);
  });
});

// ═════════════ §23.18 No production authority (§10 §11 §22 §32) ═════════════

describe("Phase-F module surface · no production authority (§10 §11 §22 §32)", () => {
  it("no exported symbol name suggests commit/deploy/DB/authority/scheduler", async () => {
    // We enumerate exported names from every Phase-F module and assert
    // none match the forbidden-prefix patterns declared in the type union.
    const modules: Record<string, unknown> = {
      candidate: await import("./candidate"),
      "evaluator-adapter": await import("./evaluator-adapter"),
      promoter: await import("./promoter"),
      history: await import("./history"),
      loop: await import("./loop"),
      types: await import("./types"),
    };
    const forbidden: (keyof PhaseFForbiddenAction | string)[] = [
      "commit", "deploy", "grantAccess", "createAccount",
      "modifyProduction", "alterDatabaseSchema", "mutateProductionDatabase",
      "createScheduler", "createCron", "createWatcher", "createDaemon",
      "startBackgroundLoop", "start24x7Loop",
      "modifyAccommodationData", "callAccommodationAdapter", "activateAccommodationWorkforce",
      "selfValidateWithoutIndependentReviewer",
      "promoteWithoutBenchmark", "promoteWithoutStabilityCheck",
    ];
    for (const [name, mod] of Object.entries(modules)) {
      const keys = Object.keys(mod as Record<string, unknown>);
      for (const k of keys) {
        for (const bad of forbidden) {
          expect(k.toLowerCase(), `${name}.${k} matches forbidden prefix "${bad}"`).not.toContain(bad.toLowerCase());
        }
      }
    }
  });

  it("no timer / cron / watcher primitive is imported by loop.ts", async () => {
    const src = readFileSync(path.join(__dirname, "loop.ts"), "utf8");
    expect(src).not.toMatch(/setInterval\s*\(/);
    expect(src).not.toMatch(/setTimeout\s*\(\s*[^,]+,\s*\d+/);
    expect(src).not.toMatch(/node-cron|node-schedule/);
    expect(src).not.toMatch(/fs\.watch\(/);
  });
});

// ═════════════ §23.16 Repeated improvement cycles ═════════════

describe("promoter is deterministic on repeated input", () => {
  it("same input yields same decision", () => {
    const input = promoterInput();
    const d1 = decidePromotion(input);
    const d2 = decidePromotion(input);
    expect(d1).toEqual(d2);
  });
});

// ─── __filename shim for the writer test above ────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
