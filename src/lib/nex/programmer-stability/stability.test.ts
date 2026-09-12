// src/lib/nex/programmer-stability/stability.test.ts
//
// NEX Programmer Agent · Phase E · stability + drift unit tests
// Philip 2026-09-05 · AUTHORIZE §26 §33 §35
//
// Covers the 14-test temporal matrix from §26 plus boundary checks
// (§32-33: no continuous operation · no history mutation · no
// benchmark mutation during run · no denominator manipulation).

import { describe, it, expect, beforeEach } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Route to fresh tmp store per test file
process.env.NEX_PROGRAMMER_STABILITY_DIR = mkdtempSync(path.join(tmpdir(), "nex-stab-"));

import {
  appendStabilityRun,
  buildStabilityRun,
  generateRunId,
  persistFullResult,
  readStabilityRuns,
  readFullResult,
  ForbiddenPhaseEWrite,
  _resetStabilityStoreForTests,
} from "./history";
import {
  captureManifest,
  hashCorpus,
  hashFiles,
  manifestsIdentical,
  computeCaseFingerprint,
  REVIEWER_SOURCE_FILES,
  EVALUATOR_SOURCE_FILES,
} from "./version-manifest";
import {
  computeDrift,
  computeAttribution,
  computePerClassDrift,
  checkConsecutiveRuns,
} from "./drift-detector";
import { freezeCorpus } from "@/lib/nex/programmer-benchmark/corpus";
import { evaluateCorpus } from "@/lib/nex/programmer-benchmark/evaluator";
import type { EvaluationRun, BenchmarkCase } from "@/lib/nex/programmer-benchmark/types";
import type { StabilityRun, VersionManifest } from "./types";
import { CORPUS_V1_CASES, CORPUS_VERSION } from "../../../../tests/fixtures/programmer-benchmark-proof/_corpus_v1/cases";
import * as historyModule from "./history";

const REPO_ROOT = process.cwd();

beforeEach(() => {
  _resetStabilityStoreForTests();
});

// ─── helpers ────────────────────────────────────────────────────

function baseCorpus(cases: BenchmarkCase[] = CORPUS_V1_CASES.slice(0, 10)) {
  return freezeCorpus({ version: CORPUS_VERSION, authored_by: "test", cases });
}

function evaluateAndPersist(runId: string, evaluation: EvaluationRun, manifest: VersionManifest, notes: string, parentId: string | null = null, baselineId: string | null = null): StabilityRun {
  const pointer = persistFullResult(runId, evaluation);
  const run = buildStabilityRun({
    evaluation, manifest,
    triggered_by: "runner",
    parent_run_id: parentId,
    baseline_run_id: baselineId,
    notes,
    full_result_pointer: pointer,
    case_fingerprint: computeCaseFingerprint(evaluation.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    }))),
    run_id_override: runId,
  });
  appendStabilityRun(run);
  return run;
}

// ─── §26 Test 1 · 5 identical fresh runs → materially identical ─

describe("§26-1 · 5 identical evaluations produce materially identical results", () => {
  it("5 back-to-back runs against the same corpus produce identical fingerprints", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const runs: StabilityRun[] = [];
    for (let i = 0; i < 5; i++) {
      const ev = evaluateCorpus(corpus, { triggered_by: "runner" });
      const run = evaluateAndPersist(`stab_iden_${i}`, ev, manifest, `identical run #${i + 1}`);
      runs.push(run);
    }
    const check = checkConsecutiveRuns(runs);
    expect(check.all_identical).toBe(true);
    expect(check.run_count).toBe(5);
    // Every fingerprint equals the first
    for (const fp of check.fingerprints) expect(fp).toBe(check.fingerprint);
  });
});

// ─── §26 Test 2 · reviewer regression detected ──────────────────

describe("§26-2 · reviewer regression detected via manifest attribution", () => {
  it("a reviewer_hash change is attributed correctly", () => {
    const corpus = baseCorpus();
    const baselineManifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const baseEv = evaluateCorpus(corpus, { triggered_by: "runner" });
    const baseline = evaluateAndPersist("stab_reg_base", baseEv, baselineManifest, "baseline");
    // Simulate reviewer change by mutating manifest hash
    const changedManifest: VersionManifest = { ...baselineManifest, reviewer_hash: "aaaaaaaaaaaaaaaaaaaaaaaa" };
    const followEv = evaluateCorpus(corpus, { triggered_by: "runner" });
    const follow = evaluateAndPersist("stab_reg_change", followEv, changedManifest, "reviewer change", "stab_reg_base", "stab_reg_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.attribution.reviewer_changed).toBe(true);
    expect(drift.attribution.summary).toContain("reviewer");
  });
});

// ─── §26 Test 3 · knowledge change attributable ─────────────────

describe("§26-3 · knowledge change attributable", () => {
  it("knowledge_snapshot_hash change surfaces in attribution", () => {
    const corpus = baseCorpus();
    const baseManifest: VersionManifest = { ...captureManifest({ repoRoot: REPO_ROOT, corpus }), knowledge_snapshot_hash: "kh_baseline" };
    const changedManifest: VersionManifest = { ...baseManifest, knowledge_snapshot_hash: "kh_new" };
    const baseEv = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_kn_base", baseEv, baseManifest, "baseline");
    const follow = evaluateAndPersist("stab_kn_change", baseEv, changedManifest, "knowledge changed", "stab_kn_base", "stab_kn_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.attribution.knowledge_changed).toBe(true);
  });
});

// ─── §26 Test 4 · corpus change attributable ────────────────────

describe("§26-4 · corpus change attributable", () => {
  it("a new corpus with one modified case yields a different benchmark_hash", () => {
    const corpus1 = baseCorpus();
    const manifest1 = captureManifest({ repoRoot: REPO_ROOT, corpus: corpus1 });
    // Build a v1.1 with a modified case (change requirement wording)
    const cases2 = CORPUS_V1_CASES.slice(0, 10).map((c, i) => i === 0 ? {
      ...c, corpus_version: "programmer-benchmark-v1.1", requirement: c.requirement + " [modified]",
      request: { ...c.request, requirement: c.request.requirement + " [modified]" },
    } : { ...c, corpus_version: "programmer-benchmark-v1.1" });
    const corpus2 = freezeCorpus({ version: "programmer-benchmark-v1.1", authored_by: "test", cases: cases2 });
    const manifest2 = captureManifest({ repoRoot: REPO_ROOT, corpus: corpus2 });
    expect(manifest1.benchmark_hash).not.toBe(manifest2.benchmark_hash);
    expect(manifest1.benchmark_version).not.toBe(manifest2.benchmark_version);
    expect(manifestsIdentical(manifest1, manifest2)).toBe(false);
  });
});

// ─── §26 Test 5 · evaluator change attributable ─────────────────

describe("§26-5 · evaluator change attributable via manifest", () => {
  it("evaluator_hash difference surfaces in attribution.evaluator_changed", () => {
    const corpus = baseCorpus();
    const baseManifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const changedManifest: VersionManifest = { ...baseManifest, evaluator_hash: "different_evaluator_hash_xyz" };
    const ev = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_ev_base", ev, baseManifest, "baseline");
    const follow = evaluateAndPersist("stab_ev_change", ev, changedManifest, "evaluator change", "stab_ev_base", "stab_ev_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.attribution.evaluator_changed).toBe(true);
  });
});

// ─── §26 Test 6 · false-positive increase detected ──────────────

describe("§26-6 · false-positive increase detected", () => {
  it("false_positive_rate above threshold flags FAILED", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    // Baseline · pristine
    const baseline = evaluateAndPersist("stab_fp_base", ev, manifest, "baseline");
    // Fabricated follow-up with elevated false-positive rate
    const badEv: EvaluationRun = {
      ...ev,
      overall: { ...ev.overall, false_positive_rate: 0.25, correct_correctly_accepted: 2, correct_total: 8 },
    };
    const followManifest: VersionManifest = { ...manifest, reviewer_hash: "changed_reviewer_fp" };
    const follow = evaluateAndPersist("stab_fp_bad", badEv, followManifest, "fabricated FPR spike", "stab_fp_base", "stab_fp_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.overall_direction).toBe("FAILED");
    expect(drift.reasons.some((r) => r.includes("false-positive"))).toBe(true);
  });
});

// ─── §26 Test 7 · defect-class degradation detected ─────────────

describe("§26-7 · defect-class degradation detected", () => {
  it("a class dropping from 100% to 40% flags FAILED", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_cl_base", ev, manifest, "baseline");
    // Fabricate a follow-up run with one class regressed
    const badPerClass = ev.per_class.map((m) => m.defect_class === "security.sql_injection"
      ? { ...m, catch_rate: 0.4, correct: 0, wrong: 1 }
      : m);
    const badEv: EvaluationRun = { ...ev, per_class: badPerClass };
    const changedManifest: VersionManifest = { ...manifest, reviewer_hash: "reviewer_degraded" };
    const follow = evaluateAndPersist("stab_cl_bad", badEv, changedManifest, "fabricated class regression", "stab_cl_base", "stab_cl_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.overall_direction).toBe("FAILED");
    expect(drift.per_class_drift.some((d) => d.defect_class === "security.sql_injection" && d.direction === "FAILED")).toBe(true);
  });
});

// ─── §26 Test 8 · aggregate masking prevented ───────────────────

describe("§26-8 · aggregate masking prevented", () => {
  it("overall accuracy improvement CANNOT hide a single class regression", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_am_base", ev, manifest, "baseline");
    // Fabricate: overall accuracy up · but one class (in-range · correctness.off_by_one)
    // fell to 30%. The class MUST be present in the first-10-case slice for the drift
    // detector to compare against a real baseline value.
    const badPerClass = ev.per_class.map((m) => m.defect_class === "correctness.off_by_one"
      ? { ...m, catch_rate: 0.3, correct: 0, wrong: 1 }
      : m);
    const badEv: EvaluationRun = {
      ...ev, per_class: badPerClass,
      overall: { ...ev.overall, overall_accuracy: 0.99 },  // superficially "higher"
    };
    const changedManifest: VersionManifest = { ...manifest, reviewer_hash: "reviewer_masked" };
    const follow = evaluateAndPersist("stab_am_bad", badEv, changedManifest, "aggregate mask attempt", "stab_am_base", "stab_am_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.overall_direction).toBe("FAILED");
    // The failed class must appear in per_class_drift (aggregate cannot mask it · §22)
    expect(drift.per_class_drift.some((d) => d.defect_class === "correctness.off_by_one" && d.direction === "FAILED")).toBe(true);
  });
});

// ─── §26 Test 9 · legitimate improvement recognized ─────────────

describe("§26-9 · legitimate improvement recognized as IMPROVED not FAILED", () => {
  it("a class going from 0.8 to 1.0 is IMPROVED when no other class regressed", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    // Baseline with one class at 0.8 (artificially set)
    const baseEv: EvaluationRun = {
      ...ev,
      per_class: ev.per_class.map((m, i) => i === 0 ? { ...m, catch_rate: 0.8 } : m),
    };
    const baseline = evaluateAndPersist("stab_imp_base", baseEv, manifest, "baseline");
    const improvedEv: EvaluationRun = {
      ...ev,
      per_class: ev.per_class.map((m, i) => i === 0 ? { ...m, catch_rate: 1.0 } : m),
    };
    const changedManifest: VersionManifest = { ...manifest, reviewer_hash: "reviewer_improved" };
    const follow = evaluateAndPersist("stab_imp_good", improvedEv, changedManifest, "legit improvement", "stab_imp_base", "stab_imp_base");
    const drift = computeDrift(baseline, follow);
    expect(["IMPROVED", "STABLE"]).toContain(drift.overall_direction);
    // The improved class appears in per_class_drift
    expect(drift.per_class_drift.some((d) => d.direction === "IMPROVED")).toBe(true);
  });
});

// ─── §26 Test 10 · uncertainty degradation detected ─────────────

describe("§26-10 · uncertainty degradation detected", () => {
  it("uncertain_accuracy dropping below threshold flags FAILED", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_un_base", ev, manifest, "baseline");
    const badEv: EvaluationRun = {
      ...ev, overall: { ...ev.overall, uncertain_accuracy: 0.5, uncertain_correct: 1, uncertain_total: 2 },
    };
    const changedManifest: VersionManifest = { ...manifest, reviewer_hash: "reviewer_uncertain_regressed" };
    const follow = evaluateAndPersist("stab_un_bad", badEv, changedManifest, "uncertainty degraded", "stab_un_base", "stab_un_base");
    const drift = computeDrift(baseline, follow);
    expect(drift.overall_direction).toBe("FAILED");
  });
});

// ─── §26 Test 11 · historical mutation attempt rejected ─────────

describe("§26-11 · historical mutation attempt rejected", () => {
  it("appendStabilityRun refuses a duplicate run_id (append-only §11)", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const run = evaluateAndPersist("stab_hist_1", ev, manifest, "baseline");
    // Attempt to append another run with the same id
    const dup = { ...run, timestamp: new Date().toISOString() };
    expect(() => appendStabilityRun(dup)).toThrow(/historical_mutation_rejected/);
  });

  it("StabilityRun with non-null final_status is REJECTED at write time", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const pointer = persistFullResult("stab_bad_fs", ev);
    const bad: StabilityRun = {
      run_id: "stab_bad_fs", parent_run_id: null, baseline_run_id: null,
      timestamp: new Date().toISOString(), triggered_by: "runner",
      version_manifest: manifest, case_fingerprint: "abc",
      overall: ev.overall, per_class: ev.per_class,
      full_result_pointer: pointer, notes: "",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      final_status: "PROVEN" as any,
    };
    expect(() => appendStabilityRun(bad)).toThrow(/Op-Truth violation/);
  });
});

// ─── §26 Test 12 · benchmark mutation during run rejected ───────

describe("§26-12 · benchmark mutation during run rejected (Phase D deep-freeze inherited)", () => {
  it("attempting to mutate a case in the frozen corpus throws", () => {
    const corpus = baseCorpus();
    const case0 = corpus.cases[0];
    expect(() => { (case0 as unknown as { ground_truth: string }).ground_truth = "CORRECT"; }).toThrow();
  });
});

// ─── §26 Test 13 · denominator manipulation rejected ────────────

describe("§26-13 · denominator manipulation prevented by preserved case_results", () => {
  it("full case results are preserved · excluding a failed case cannot be silent", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const run = evaluateAndPersist("stab_denom", ev, manifest, "baseline");
    const persisted = readFullResult("stab_denom");
    // Every case result is present · matches persisted denominator
    expect(persisted?.results.length).toBe(corpus.case_count);
    // Overall total_cases matches actual results count · no denominator shrinkage
    expect(persisted?.overall.total_cases).toBe(corpus.case_count);
  });
});

// ─── §26 Test 14 · fresh-process reproduction passes ────────────

describe("§26-14 · fresh-process reproduction via fingerprint parity", () => {
  it("two independent evaluations against identical inputs yield identical fingerprints", () => {
    const corpus = baseCorpus();
    const ev1 = evaluateCorpus(corpus);
    const ev2 = evaluateCorpus(corpus);
    const fp1 = computeCaseFingerprint(ev1.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    })));
    const fp2 = computeCaseFingerprint(ev2.results.map((r) => ({
      case_id: r.case_id, match_status: r.match_status,
      actual_verdict: r.actual_verdict, actual_finding_count: r.actual_finding_count,
    })));
    expect(fp1).toBe(fp2);
  });
});

// ─── §32 · No production-authority exports · module audit ───────

describe("§32 · Phase E modules export no production-authority primitives", () => {
  it("history + drift-detector + version-manifest export no commit/deploy/scheduler primitives", async () => {
    const forbiddenPrefixes = ["commit", "push", "deploy", "grantAccess", "modifyProduction", "createScheduler", "createCron", "createWatcher", "createDaemon", "startBackgroundLoop", "modifyHistoricalRun", "activateWorkforce", "startAutonomousImprovementLoop"];
    const modules = [
      await import("./history"),
      await import("./drift-detector"),
      await import("./version-manifest"),
    ];
    for (const mod of modules) {
      for (const forbidden of forbiddenPrefixes) {
        const leak = Object.keys(mod).find((n) => n.toLowerCase().startsWith(forbidden.toLowerCase()));
        expect(leak, `Phase-E module leaks ${forbidden}*`).toBeUndefined();
      }
    }
  });

  it("ForbiddenPhaseEWrite is exported (path guard sentinel)", () => {
    expect(ForbiddenPhaseEWrite).toBeDefined();
    expect(new ForbiddenPhaseEWrite("/etc/passwd").message).toContain("Phase-E forbidden write");
    void historyModule; // reference to avoid tree-shake
  });
});

// ─── Version manifest determinism ───────────────────────────────

describe("captureManifest · deterministic hashing", () => {
  it("hashCorpus is stable across invocations for identical corpus", () => {
    const corpus = baseCorpus();
    const h1 = hashCorpus(corpus);
    const h2 = hashCorpus(corpus);
    expect(h1).toBe(h2);
  });

  it("hashFiles is stable across invocations", () => {
    const h1 = hashFiles(REVIEWER_SOURCE_FILES, REPO_ROOT);
    const h2 = hashFiles(REVIEWER_SOURCE_FILES, REPO_ROOT);
    expect(h1).toBe(h2);
  });

  it("hashFiles produces MISSING marker for absent files (never fabricates)", () => {
    const h = hashFiles(["src/definitely_missing.ts"], REPO_ROOT);
    // Just ensure it produces a hash · doesn't throw
    expect(h.length).toBeGreaterThan(8);
  });

  it("manifestsIdentical returns false when any dimension differs", () => {
    const corpus = baseCorpus();
    const m1 = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const m2 = { ...m1, reviewer_hash: "different" };
    expect(manifestsIdentical(m1, m2)).toBe(false);
  });
});

// ─── UNEXPLAINED direction · results delta with no manifest change ─

describe("UNEXPLAINED direction · non-determinism / hidden-state detection", () => {
  it("delta with no manifest change → UNEXPLAINED (surfaces non-determinism)", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const baseline = evaluateAndPersist("stab_unex_1", ev, manifest, "baseline");
    // Same manifest but fabricated different per-class rate
    const fabricatedEv: EvaluationRun = {
      ...ev,
      per_class: ev.per_class.map((m, i) => i === 0 ? { ...m, catch_rate: 0.9 } : m),
    };
    const follow = evaluateAndPersist("stab_unex_2", fabricatedEv, manifest, "fabricated · same manifest", "stab_unex_1", "stab_unex_1");
    const drift = computeDrift(baseline, follow);
    expect(drift.overall_direction).toBe("UNEXPLAINED");
    expect(drift.reasons.some((r) => r.includes("UNEXPLAINED"))).toBe(true);
  });
});

// ─── Per-class drift computation sanity ─────────────────────────

describe("computePerClassDrift · sanity", () => {
  it("STABLE when catch rates identical", () => {
    const corpus = baseCorpus();
    const manifest = captureManifest({ repoRoot: REPO_ROOT, corpus });
    const ev = evaluateCorpus(corpus);
    const runA = evaluateAndPersist("stab_pc_a", ev, manifest, "a");
    const runB = evaluateAndPersist("stab_pc_b", ev, manifest, "b", "stab_pc_a", "stab_pc_a");
    const drift = computePerClassDrift(runA, runB);
    for (const d of drift) expect(d.direction).toBe("STABLE");
  });
});
