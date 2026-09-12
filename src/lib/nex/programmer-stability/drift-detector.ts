// src/lib/nex/programmer-stability/drift-detector.ts
//
// NEX Programmer Agent · Phase E · drift detection
// Philip 2026-09-05 · AUTHORIZE §8 §14 §15 §16 §22
//
// Compares a current stability run against a baseline. Produces a
// DriftReport with:
//   · per-class catch-rate drift (§14 · never hides class regression)
//   · false-positive drift (§15 · tracked independently)
//   · uncertainty drift (§16)
//   · verdict flips at case level
//   · attribution against version manifest (which dimension changed)
//   · overall direction: STABLE · IMPROVED · DEGRADED · FAILED · UNEXPLAINED
//
// CRITICAL DEFENSE (§22 · aggregate masking):
//   Overall improvement CANNOT hide a specific defect-class regression.
//   The report emits per-class drift explicitly · a single class dropping
//   below its Phase D threshold flags DEGRADED regardless of whether the
//   overall average went up.

import type { EvaluationRun } from "@/lib/nex/programmer-benchmark/types";
import { readFullResult } from "./history";
import type {
  ClassDrift,
  DriftAttribution,
  DriftDirection,
  DriftReport,
  StabilityRun,
  StabilityThresholds,
  VerdictFlip,
} from "./types";
import { DEFAULT_STABILITY_THRESHOLDS } from "./types";
import { manifestsIdentical } from "./version-manifest";

// ─── Attribution ────────────────────────────────────────────────

export function computeAttribution(baseline: StabilityRun, current: StabilityRun): DriftAttribution {
  const b = baseline.version_manifest;
  const c = current.version_manifest;
  const reviewer_changed = b.reviewer_hash !== c.reviewer_hash;
  const evaluator_changed = b.evaluator_hash !== c.evaluator_hash;
  const benchmark_changed = b.benchmark_hash !== c.benchmark_hash || b.benchmark_version !== c.benchmark_version;
  const knowledge_changed = b.knowledge_snapshot_hash !== c.knowledge_snapshot_hash;
  const environment_changed = b.environment_identifier !== c.environment_identifier;
  const changes: string[] = [];
  if (reviewer_changed) changes.push(`reviewer(${short(b.reviewer_hash)}→${short(c.reviewer_hash)})`);
  if (evaluator_changed) changes.push(`evaluator(${short(b.evaluator_hash)}→${short(c.evaluator_hash)})`);
  if (benchmark_changed) changes.push(`benchmark(${b.benchmark_version}@${short(b.benchmark_hash)}→${c.benchmark_version}@${short(c.benchmark_hash)})`);
  if (knowledge_changed) changes.push(`knowledge(${short(b.knowledge_snapshot_hash)}→${short(c.knowledge_snapshot_hash)})`);
  if (environment_changed) changes.push(`env(${b.environment_identifier}→${c.environment_identifier})`);
  return {
    reviewer_changed, evaluator_changed, benchmark_changed, knowledge_changed, environment_changed,
    summary: changes.length === 0 ? "no manifest change" : changes.join(" · "),
  };
}

function short(h: string): string { return h.slice(0, 8); }

// ─── Per-class drift ────────────────────────────────────────────

export function classDriftDirection(
  baseline_rate: number,
  current_rate: number,
  threshold: number,
  epsilon = 0.001,
): DriftDirection {
  if (Math.abs(current_rate - baseline_rate) < epsilon) return "STABLE";
  if (current_rate + epsilon < threshold && baseline_rate >= threshold) return "FAILED";
  if (current_rate < baseline_rate - epsilon) return "DEGRADED";
  return "IMPROVED";
}

export function computePerClassDrift(
  baseline: StabilityRun,
  current: StabilityRun,
  thresholds: StabilityThresholds = DEFAULT_STABILITY_THRESHOLDS,
): ClassDrift[] {
  const baselineByClass = new Map(baseline.per_class.map((m) => [m.defect_class, m]));
  const currentByClass = new Map(current.per_class.map((m) => [m.defect_class, m]));
  const allClasses = new Set([...baselineByClass.keys(), ...currentByClass.keys()]);
  const drift: ClassDrift[] = [];
  for (const cls of allClasses) {
    const b = baselineByClass.get(cls);
    const c = currentByClass.get(cls);
    const baseline_rate = b?.catch_rate ?? 0;
    const current_rate = c?.catch_rate ?? 0;
    const delta = current_rate - baseline_rate;
    const direction = classDriftDirection(baseline_rate, current_rate, thresholds.per_class_min_catch_rate);
    let reason = "";
    if (direction === "STABLE") reason = "no change";
    else if (direction === "FAILED") reason = `dropped below ${thresholds.per_class_min_catch_rate} threshold from a passing baseline`;
    else if (direction === "DEGRADED") reason = `decreased by ${(Math.abs(delta) * 100).toFixed(1)}%`;
    else if (direction === "IMPROVED") reason = `increased by ${(delta * 100).toFixed(1)}%`;
    if (!b) reason = "class absent from baseline · new coverage";
    if (!c) reason = "class absent from current · coverage regressed";
    drift.push({
      defect_class: cls,
      baseline_catch_rate: baseline_rate,
      current_catch_rate: current_rate,
      delta,
      direction,
      reason,
    });
  }
  drift.sort((a, b) => a.defect_class.localeCompare(b.defect_class));
  return drift;
}

// ─── Verdict flips at case level ────────────────────────────────

export function computeVerdictFlips(baseline: StabilityRun, current: StabilityRun): VerdictFlip[] {
  const baselineRun = readFullResult(baseline.run_id);
  const currentRun = readFullResult(current.run_id);
  if (!baselineRun || !currentRun) return [];
  const baselineById = new Map(baselineRun.results.map((r) => [r.case_id, r]));
  const flips: VerdictFlip[] = [];
  for (const c of currentRun.results) {
    const b = baselineById.get(c.case_id);
    if (!b) continue;
    if (b.actual_verdict !== c.actual_verdict) {
      // Regression = current is a "worse" outcome than baseline for the same case.
      // Uses expected_verdict as ground truth: current WRONG when baseline CORRECT.
      const baselineCorrect = b.match_status === "CORRECT";
      const currentCorrect = c.match_status === "CORRECT";
      const is_regression = baselineCorrect && !currentCorrect;
      flips.push({
        case_id: c.case_id,
        baseline_verdict: b.actual_verdict,
        current_verdict: c.actual_verdict,
        baseline_finding_count: b.actual_finding_count,
        current_finding_count: c.actual_finding_count,
        is_regression,
      });
    }
  }
  return flips;
}

// ─── Overall direction (aggregate-mask defence) ─────────────────

export function computeOverallDirection(
  perClassDrift: ClassDrift[],
  overallDelta: DriftReport["overall_delta"],
  thresholds: StabilityThresholds = DEFAULT_STABILITY_THRESHOLDS,
): { direction: DriftDirection; reasons: string[] } {
  const reasons: string[] = [];
  // Any FAILED per-class drift dominates · aggregate cannot hide it.
  const failedClasses = perClassDrift.filter((d) => d.direction === "FAILED");
  if (failedClasses.length > 0) {
    for (const f of failedClasses) reasons.push(`class regression FAILED: ${f.defect_class} · ${f.reason}`);
    return { direction: "FAILED", reasons };
  }
  // False-positive-rate above threshold → FAILED (independent tracking · §15)
  if (overallDelta.false_positive_rate > thresholds.max_false_positive_rate) {
    reasons.push(`false-positive rate ${(overallDelta.false_positive_rate * 100).toFixed(1)}% exceeds ${(thresholds.max_false_positive_rate * 100).toFixed(0)}%`);
    return { direction: "FAILED", reasons };
  }
  if (overallDelta.tests_pass_but_code_wrong_catch_rate < thresholds.tests_pass_but_code_wrong_min_catch_rate) {
    reasons.push(`tests-pass-wrong catch rate ${(overallDelta.tests_pass_but_code_wrong_catch_rate * 100).toFixed(1)}% below ${(thresholds.tests_pass_but_code_wrong_min_catch_rate * 100).toFixed(0)}%`);
    return { direction: "FAILED", reasons };
  }
  if (overallDelta.uncertain_accuracy < thresholds.min_uncertainty_accuracy && overallDelta.uncertain_accuracy > 0) {
    reasons.push(`uncertainty accuracy ${(overallDelta.uncertain_accuracy * 100).toFixed(1)}% below ${(thresholds.min_uncertainty_accuracy * 100).toFixed(0)}%`);
    return { direction: "FAILED", reasons };
  }
  // DEGRADED · any per-class drift below its own baseline (but still above threshold)
  const degraded = perClassDrift.filter((d) => d.direction === "DEGRADED");
  if (degraded.length > 0) {
    for (const d of degraded) reasons.push(`class DEGRADED: ${d.defect_class} · ${d.reason}`);
    return { direction: "DEGRADED", reasons };
  }
  // IMPROVED · any strict improvement AND no degradation
  const improved = perClassDrift.filter((d) => d.direction === "IMPROVED");
  if (improved.length > 0 && degraded.length === 0) {
    for (const i of improved) reasons.push(`class IMPROVED: ${i.defect_class} · ${i.reason}`);
    return { direction: "IMPROVED", reasons };
  }
  reasons.push("no material change · all classes STABLE");
  return { direction: "STABLE", reasons };
}

// ─── Public entry point ─────────────────────────────────────────

export function computeDrift(
  baseline: StabilityRun,
  current: StabilityRun,
  thresholds: StabilityThresholds = DEFAULT_STABILITY_THRESHOLDS,
): DriftReport {
  const attribution = computeAttribution(baseline, current);
  const perClassDrift = computePerClassDrift(baseline, current, thresholds);
  const verdictFlips = computeVerdictFlips(baseline, current);

  const overall_delta = {
    defective_catch_rate: current.overall.defective_catch_rate - baseline.overall.defective_catch_rate,
    false_positive_rate: current.overall.false_positive_rate,
    tests_pass_but_code_wrong_catch_rate: current.overall.tests_pass_but_code_wrong_catch_rate,
    uncertain_accuracy: current.overall.uncertain_accuracy,
  };

  const { direction, reasons } = computeOverallDirection(perClassDrift, overall_delta, thresholds);

  // Fingerprint check for identical-config runs (§26 test 1)
  const fingerprintsIdentical = baseline.case_fingerprint === current.case_fingerprint;
  const identicalConfig = manifestsIdentical(baseline.version_manifest, current.version_manifest);
  if (identicalConfig && !fingerprintsIdentical && thresholds.identical_runs_require_identical_fingerprint) {
    reasons.push(`identical-config runs produced DIFFERENT fingerprints · non-determinism suspected`);
  }
  // If nothing in the manifest changed but results differ → UNEXPLAINED
  const anyChangeAttributable = attribution.reviewer_changed || attribution.evaluator_changed
    || attribution.benchmark_changed || attribution.knowledge_changed || attribution.environment_changed;
  const anyResultDelta = perClassDrift.some((d) => d.direction !== "STABLE") || verdictFlips.length > 0;
  const finalDirection: DriftDirection =
    !anyChangeAttributable && anyResultDelta ? "UNEXPLAINED" : direction;
  if (finalDirection === "UNEXPLAINED") {
    reasons.push("result delta observed but manifest is unchanged · UNEXPLAINED · investigate non-determinism or hidden state");
  }

  return {
    baseline_run_id: baseline.run_id,
    current_run_id: current.run_id,
    attribution,
    fingerprints_identical: fingerprintsIdentical,
    overall_direction: finalDirection,
    overall_delta,
    per_class_drift: perClassDrift,
    verdict_flips: verdictFlips,
    reasons,
  };
}

// ─── Convenience · consecutive 5-run stability check ────────────

export type ConsecutiveRunsResult = {
  fingerprint: string;
  all_identical: boolean;
  run_count: number;
  fingerprints: string[];
};

/** Given a list of stability runs assumed to have identical manifests,
 *  check whether all fingerprints match. */
export function checkConsecutiveRuns(runs: StabilityRun[]): ConsecutiveRunsResult {
  if (runs.length === 0) return { fingerprint: "", all_identical: true, run_count: 0, fingerprints: [] };
  const first = runs[0].case_fingerprint;
  const all_identical = runs.every((r) => r.case_fingerprint === first);
  return {
    fingerprint: first,
    all_identical,
    run_count: runs.length,
    fingerprints: runs.map((r) => r.case_fingerprint),
  };
}

// suppress unused-import warning · EvaluationRun re-exported for type consumers
export type { EvaluationRun };
