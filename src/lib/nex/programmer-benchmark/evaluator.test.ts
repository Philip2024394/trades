// src/lib/nex/programmer-benchmark/evaluator.test.ts
//
// NEX Programmer Agent · Phase D · evaluator + adversarial-evaluator tests
// Philip 2026-09-05 · AUTHORIZE §33 §35
//
// Covers §33 adversarial-evaluator tests (10 required) plus verdict
// derivation, metric aggregation, threshold checks, and boundary
// integrity (§32 forbidden actions).

import { describe, it, expect } from "vitest";
import { freezeCorpus, snapshotCorpus, isCorpusFrozen, detectHardcodingLeaks } from "./corpus";
import {
  evaluateCase, evaluateCorpus, aggregatePerClass, aggregateOverall,
  checkThresholds, deriveEvaluationVerdict,
} from "./evaluator";
import { CORPUS_V1_CASES, CORPUS_VERSION } from "../../../../tests/fixtures/programmer-benchmark-proof/_corpus_v1/cases";
import type { BenchmarkCase, BenchmarkCorpus } from "./types";

// Helper: freeze a small subset for unit tests
function buildCorpus(cases: BenchmarkCase[]): BenchmarkCorpus {
  return freezeCorpus({ version: CORPUS_VERSION, authored_by: "test", cases });
}

// ─── freezeCorpus · immutability + invariants ────────────────────

describe("freezeCorpus · corpus is immutable after freeze (§22 §23)", () => {
  it("freezes the corpus and every case (§23)", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 3));
    expect(isCorpusFrozen(c)).toBe(true);
  });

  it("rejects duplicate case_ids", () => {
    const dup = { ...CORPUS_V1_CASES[0] };
    expect(() => freezeCorpus({
      version: CORPUS_VERSION, authored_by: "test",
      cases: [CORPUS_V1_CASES[0], dup],
    })).toThrow(/duplicate case_id/);
  });

  it("rejects mismatched corpus_version", () => {
    const wrong = { ...CORPUS_V1_CASES[0], corpus_version: "other-version" };
    expect(() => freezeCorpus({
      version: CORPUS_VERSION, authored_by: "test", cases: [wrong],
    })).toThrow(/corpus_version.*does not match/);
  });

  it("rejects case missing ground_truth_evidence (§5 §6)", () => {
    const noEvidence = { ...CORPUS_V1_CASES[0], ground_truth_evidence: [] };
    expect(() => freezeCorpus({
      version: CORPUS_VERSION, authored_by: "test", cases: [noEvidence],
    })).toThrow(/ground_truth_evidence/);
  });

  it("throws on empty case list", () => {
    expect(() => freezeCorpus({ version: CORPUS_VERSION, authored_by: "test", cases: [] })).toThrow(/non-empty/);
  });
});

// ─── snapshotCorpus · captures snapshot at run-start ─────────────

describe("snapshotCorpus · run-start snapshot", () => {
  it("returns version, frozen_at, case_ids, and classes", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 3));
    const snap = snapshotCorpus(c);
    expect(snap.version).toBe(CORPUS_VERSION);
    expect(snap.case_count).toBe(3);
    expect(snap.case_ids.length).toBe(3);
    expect(snap.defect_classes_covered.length).toBeGreaterThan(0);
  });
});

// ─── §33-1 · changing expected verdict changes evaluation outcome ─

describe("§33-1 · changing expected_verdict changes evaluation outcome", () => {
  it("case runs with mismatched expected verdict → match_status=WRONG", () => {
    const base = CORPUS_V1_CASES.find((c) => c.expected_verdict === "ACCEPT")!;
    const twisted: BenchmarkCase = { ...base, case_id: "bench_test_twist", expected_verdict: "REJECT" };
    const c = buildCorpus([twisted]);
    const run = evaluateCorpus(c);
    expect(run.results[0].match_status).toBe("WRONG");
  });
});

// ─── §33-2 · corrupt ground truth is detected (invariant validation) ─

describe("§33-2 · corrupt ground truth (missing evidence) is detected at freeze time", () => {
  it("case without ground_truth_evidence rejected at freezeCorpus", () => {
    const c = { ...CORPUS_V1_CASES[0], ground_truth_evidence: [] };
    expect(() => freezeCorpus({ version: CORPUS_VERSION, authored_by: "t", cases: [c] })).toThrow();
  });
});

// ─── §33-3 · missing ground truth is not treated as correct ──────

describe("§33-3 · missing ground truth is NOT silently treated as CORRECT", () => {
  it("case with defective ground_truth but reviewer returns ACCEPT → match_status=WRONG (not silently CORRECT)", () => {
    // Fabricate a case where the reviewer would ACCEPT but ground truth says DEFECTIVE
    const base = CORPUS_V1_CASES.find((c) => c.expected_verdict === "ACCEPT")!;
    const twisted: BenchmarkCase = {
      ...base,
      case_id: "bench_test_gt_wrong",
      ground_truth: "DEFECTIVE",
      expected_verdict: "REJECT",
    };
    const c = buildCorpus([twisted]);
    const run = evaluateCorpus(c);
    // Reviewer returns ACCEPT · expected REJECT → WRONG · not silently promoted to CORRECT
    expect(run.results[0].actual_verdict).toBe("ACCEPT");
    expect(run.results[0].match_status).toBe("WRONG");
  });
});

// ─── §33-4 · execution errors are preserved ─────────────────────

describe("§33-4 · execution errors preserved as EXECUTION_ERROR (§27)", () => {
  it("execution error surfaces as match_status=EXECUTION_ERROR with error message", () => {
    // Build a FRESH (unfrozen) case with a poison getter on request.tests
    // so we can trigger the reviewer's exception path. Deep-frozen cases
    // from the corpus cannot be mutated · this is by design (§33-7) ·
    // so this test synthesises a hostile case directly.
    const badRequest = {
      case_id: "bench_test_exec_err",
      corpus_version: CORPUS_VERSION,
      defect_class: "correctness.off_by_one" as const,
      difficulty: "FOUNDATIONAL" as const,
      requirement: "test",
      request: {
        review_id: "rev_synth",
        requirement: "test",
        implementation: { id: "i", files: [], summary: "test summary", claim: "test claim", claimed_by: "claude" as const },
        // Poison: tests getter throws
        get tests() { throw new Error("simulated evaluator execution error"); },
        runtime_evidence: [],
        requirement_details: {
          edge_cases_required: [], edge_cases_covered: [],
          security_requirements: [], security_violations_observed: [],
        },
      } as unknown as BenchmarkCase["request"],
      ground_truth: "DEFECTIVE" as const,
      expected_verdict: "REJECT" as const,
      ground_truth_evidence: [{ method: "static_check" as const, description: "synthetic", pointer: "synth" }],
      provenance: "test",
    };
    const result = evaluateCase(badRequest);
    expect(result.match_status).toBe("EXECUTION_ERROR");
    expect(result.execution_error).toContain("simulated evaluator execution error");
  });

  it("catch_rate denominator excludes EXECUTION_ERROR (§27 · no silent exclusion of failed cases)", () => {
    const okResult = { match_status: "CORRECT" as const, defect_class: "security.sql_injection" as const };
    const errResult = { match_status: "EXECUTION_ERROR" as const, defect_class: "security.sql_injection" as const };
    // Full 4-field mock only including what aggregatePerClass uses
    const results = [
      { case_id: "a", corpus_version: "v", defect_class: "security.sql_injection", difficulty: "FOUNDATIONAL", ground_truth: "DEFECTIVE", expected_verdict: "REJECT", actual_verdict: "REJECT", match_status: "CORRECT", expected_finding_categories: [], actual_finding_categories: [], actual_finding_count: 0, actual_confidence: "high", actual_review_id: "r1", knowledge_used: [], reasoning_trace_length: 0, timestamp: "t" },
      { case_id: "b", corpus_version: "v", defect_class: "security.sql_injection", difficulty: "FOUNDATIONAL", ground_truth: "DEFECTIVE", expected_verdict: "REJECT", actual_verdict: "UNCERTAIN", match_status: "EXECUTION_ERROR", expected_finding_categories: [], actual_finding_categories: [], actual_finding_count: 0, actual_confidence: "low", actual_review_id: "r2", knowledge_used: [], reasoning_trace_length: 0, timestamp: "t" },
    ] as unknown as ReturnType<typeof evaluateCase>[];
    const perClass = aggregatePerClass(results);
    expect(perClass[0].total).toBe(2);
    expect(perClass[0].execution_error).toBe(1);
    // catch_rate = correct / (total - execErr) = 1 / (2 - 1) = 1.0
    expect(perClass[0].catch_rate).toBeCloseTo(1.0, 5);
    // But execution_error is preserved (not swept under the rug)
    void okResult; void errResult;
  });
});

// ─── §33-5 · duplicate cases are detected ───────────────────────

describe("§33-5 · duplicate cases detected", () => {
  it("freezeCorpus rejects the second occurrence of any case_id", () => {
    const base = CORPUS_V1_CASES[0];
    expect(() => freezeCorpus({
      version: CORPUS_VERSION, authored_by: "t",
      cases: [base, { ...base }],
    })).toThrow(/duplicate case_id/);
  });
});

// ─── §33-6 · corpus version preserved through evaluation ─────────

describe("§33-6 · corpus_version preserved on every result", () => {
  it("every EvaluationResult carries corpus_version === corpus.version", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 5));
    const run = evaluateCorpus(c);
    for (const r of run.results) expect(r.corpus_version).toBe(CORPUS_VERSION);
    expect(run.corpus_version).toBe(CORPUS_VERSION);
  });
});

// ─── §33-7 · Programmer cannot modify ground truth ──────────────

describe("§33-7 · reviewer cannot mutate ground truth (deep-freeze contract)", () => {
  it("attempting to mutate a case's ground_truth throws in strict mode", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 1));
    const case0 = c.cases[0];
    expect(() => { (case0 as unknown as { ground_truth: string }).ground_truth = "CORRECT"; }).toThrow();
  });

  it("attempting to mutate a nested request field throws", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 1));
    const case0 = c.cases[0];
    expect(() => { (case0.request.implementation as unknown as { claim: string }).claim = "modified"; }).toThrow();
  });
});

// ─── §33-8 · Programmer cannot modify the corpus during evaluation ─

describe("§33-8 · corpus is immutable during evaluation", () => {
  it("evaluateCorpus does not add/remove cases", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 5));
    const beforeCount = c.case_count;
    const beforeIds = c.cases.map((x) => x.case_id).join(",");
    evaluateCorpus(c);
    // Post-run · corpus unchanged
    expect(c.case_count).toBe(beforeCount);
    expect(c.cases.map((x) => x.case_id).join(",")).toBe(beforeIds);
  });
});

// ─── §33-9 · benchmark-specific hardcoding detectable ───────────

describe("§33-9 · detectHardcodingLeaks catches suspicious cheat cues", () => {
  it("detects case_id appearing inside request text", () => {
    const base = CORPUS_V1_CASES[0];
    const leaky: BenchmarkCase = {
      ...base,
      case_id: "bench_test_leak",
      requirement: base.requirement + " (bench_test_leak)",
      request: {
        ...base.request,
        requirement: base.requirement + " (bench_test_leak)",
      },
    };
    const c = buildCorpus([leaky]);
    const leaks = detectHardcodingLeaks(c);
    expect(leaks.some((l) => l.includes("bench_test_leak"))).toBe(true);
  });

  it("detects expected_verdict appearing inside request text", () => {
    const base = CORPUS_V1_CASES.find((c) => c.expected_verdict === "REJECT")!;
    const leaky: BenchmarkCase = {
      ...base,
      case_id: "bench_test_verdict_leak",
      request: {
        ...base.request,
        implementation: { ...base.request.implementation, summary: base.request.implementation.summary + " REJECT" },
      },
    };
    const c = buildCorpus([leaky]);
    const leaks = detectHardcodingLeaks(c);
    expect(leaks.some((l) => l.includes("expected_verdict"))).toBe(true);
  });

  it("clean corpus produces zero leaks", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 10));
    const leaks = detectHardcodingLeaks(c);
    expect(leaks).toEqual([]);
  });
});

// ─── §33-10 · aggregate metrics cannot hide a failed defect class ─

describe("§33-10 · per-class metrics prevent aggregate masking", () => {
  it("aggregation reports catch_rate PER CLASS · not just overall", () => {
    const c = buildCorpus(CORPUS_V1_CASES);
    const run = evaluateCorpus(c);
    // Every class must appear in per_class metrics
    const classesInResults = new Set(run.results.map((r) => r.defect_class));
    const classesInPerClass = new Set(run.per_class.map((m) => m.defect_class));
    for (const cls of classesInResults) expect(classesInPerClass.has(cls)).toBe(true);
    // At least one non-control class must have samples (non-masking check)
    const defectiveClasses = run.per_class.filter((m) => !m.defect_class.startsWith("control."));
    expect(defectiveClasses.length).toBeGreaterThan(0);
  });

  it("threshold checker emits a per-class check for every sufficiently-sampled class · never hides a weak class in the average", () => {
    const c = buildCorpus(CORPUS_V1_CASES);
    const run = evaluateCorpus(c);
    const checks = checkThresholds(run.overall, run.per_class);
    const perClassChecks = checks.filter((ch) => ch.criterion.startsWith("class:") && ch.criterion.endsWith(":catch_rate"));
    // At least one per-class check should exist (unless all classes are undersampled · which the fixture design prevents)
    expect(perClassChecks.length).toBeGreaterThan(0);
  });
});

// ─── §32 · no production-authority exports (module audit) ───────

describe("§32 · Phase D modules export no production-authority primitives", () => {
  it("evaluator + corpus modules export nothing that begins with commit/deploy/grantAccess/etc.", async () => {
    const forbiddenPrefixes = ["commit", "push", "deploy", "grantAccess", "modifyProduction", "modifyCorpus", "modifyReviewer", "scheduleRecurring", "startWatcher", "createWorkforce"];
    const modules = [
      await import("./evaluator"),
      await import("./corpus"),
    ];
    for (const mod of modules) {
      for (const forbidden of forbiddenPrefixes) {
        const leak = Object.keys(mod).find((n) => n.toLowerCase().startsWith(forbidden.toLowerCase()));
        expect(leak, `module leaks ${forbidden}*`).toBeUndefined();
      }
    }
  });
});

// ─── Deriving GREEN/YELLOW/RED verdict from checks ──────────────

describe("deriveEvaluationVerdict · aggregation of threshold checks", () => {
  it("all checks pass → GREEN", () => {
    const v = deriveEvaluationVerdict([{ criterion: "x", measured: 0.9, threshold: 0.8, passed: true, detail: "" }]);
    expect(v.verdict).toBe("GREEN");
  });
  it("critical check fails → RED", () => {
    const v = deriveEvaluationVerdict([{ criterion: "class:x:catch_rate", measured: 0.5, threshold: 0.8, passed: false, detail: "" }]);
    expect(v.verdict).toBe("RED");
  });
  it("only info-only fails (sample_size) → YELLOW", () => {
    const v = deriveEvaluationVerdict([{ criterion: "class:x:sample_size", measured: 1, threshold: 2, passed: false, detail: "" }]);
    expect(v.verdict).toBe("YELLOW");
  });
});

// ─── Sanity · aggregation math on hand-built results ─────────────

describe("aggregation math", () => {
  it("false_positive_rate on empty correct_total is 0 not NaN", () => {
    const overall = aggregateOverall([], []);
    expect(overall.false_positive_rate).toBe(0);
    expect(overall.correct_total).toBe(0);
  });

  it("overall_accuracy computed as correct/total", () => {
    const c = buildCorpus(CORPUS_V1_CASES.slice(0, 10));
    const run = evaluateCorpus(c);
    const expectedAcc = run.overall.correct / run.overall.total_cases;
    expect(run.overall.overall_accuracy).toBeCloseTo(expectedAcc, 5);
  });
});
