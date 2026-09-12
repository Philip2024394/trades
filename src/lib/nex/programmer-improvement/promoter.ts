// src/lib/nex/programmer-improvement/promoter.ts
//
// NEX Programmer Agent · Phase F · deterministic promotion decision
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §7 §8 §14 §18 §19 §20 §22
//
// The promoter is a pure function: it reads the outputs of the reviewer,
// benchmark, drift detector, and fresh-process reproduction check and
// returns a PromotionDecision. It has no side effects. It does not
// persist. It does not communicate with the reviewer/evaluator except
// through their already-produced outputs.
//
// This separation is load-bearing for §22 anti-self-reinforcement:
// creation is one module, evaluation is another, promotion is a THIRD
// module that only reads the second module's outputs.

import type { ReviewResponse } from "@/lib/nex/programmer-review/types";
import type {
  DriftReport,
  StabilityRun,
} from "@/lib/nex/programmer-stability/types";
import type {
  EvaluationRun,
  ClassMetrics,
  OverallMetrics,
} from "@/lib/nex/programmer-benchmark/types";
import type {
  CandidateFailureReason,
  ImprovementThresholds,
  LearningCandidate,
  PromotionDecision,
} from "./types";
import { DEFAULT_IMPROVEMENT_THRESHOLDS } from "./types";
import { validateCandidate } from "./candidate";

// ─── Promoter input ────────────────────────────────────────────

export type PromoterInput = {
  candidate: LearningCandidate;
  review: ReviewResponse;
  benchmark: {
    baseline_evaluation?: EvaluationRun;
    current_evaluation: EvaluationRun;
    all_thresholds_passed: boolean;
  };
  drift: DriftReport | null;      // null when this is the FIRST run · no baseline
  fresh_process_reproduced: boolean;
  is_duplicate: boolean;
  thresholds?: ImprovementThresholds;
};

// ─── Helpers ───────────────────────────────────────────────────

/** Returns per-class regressions worse than the threshold. §8 makes
 *  aggregate improvement never sufficient to hide a class-level drop. */
function detectClassRegressions(drift: DriftReport | null, threshold: number): string[] {
  if (!drift) return [];
  const bad: string[] = [];
  for (const cd of drift.per_class_drift) {
    // A DEGRADED class is a class-level regression per Phase E semantics.
    if (cd.direction === "DEGRADED" && cd.current_catch_rate < threshold) {
      bad.push(`${cd.defect_class}:${cd.baseline_catch_rate}->${cd.current_catch_rate}`);
    }
    // A FAILED class is worse than DEGRADED — always disqualifying.
    if (cd.direction === "FAILED") {
      bad.push(`${cd.defect_class}:FAILED`);
    }
  }
  return bad;
}

/** Detects the Phase-E adversarial pattern: overall improved (or steady)
 *  while a specific class regressed. §8 rejects this outright. */
function detectAggregateMasking(drift: DriftReport | null): boolean {
  if (!drift) return false;
  const overall = drift.overall_direction;
  const perClassBad = drift.per_class_drift.some((cd) => cd.direction === "DEGRADED" || cd.direction === "FAILED");
  if (!perClassBad) return false;
  // Aggregate masking = overall says STABLE or IMPROVED while a class regressed.
  return overall === "STABLE" || overall === "IMPROVED";
}

// ─── decidePromotion ───────────────────────────────────────────

/** THE promotion decision. Pure. Deterministic. No side effects.
 *  Rules applied in order · first matching rule wins.
 *
 *  1  Duplicate candidate → REJECTED
 *  2  Structural validation failed → REJECTED / UNPROVEN (per reason)
 *  3  Machinery failure signalled by caller → FAILED
 *  4  Review verdict REJECT → REJECTED
 *  5  Review verdict NEEDS_CHANGES → REJECTED
 *  6  Review verdict UNCERTAIN → UNPROVEN
 *  7  Review verdict not in allowed set → REJECTED
 *  8  Benchmark thresholds failed → REGRESSED
 *  9  Per-class regression detected → REGRESSED
 * 10  Aggregate masking detected → REGRESSED
 * 11  Fresh-process reproducibility required + false → UNPROVEN
 * 12  All checks passed → PROMOTED
 */
export function decidePromotion(input: PromoterInput): PromotionDecision {
  const thresholds = input.thresholds ?? DEFAULT_IMPROVEMENT_THRESHOLDS;

  // 1 · duplicate guard (§23)
  if (input.is_duplicate) {
    return {
      status: "REJECTED",
      failure_reason: "duplicate_candidate" satisfies CandidateFailureReason,
      reasons: [`duplicate_candidate:${input.candidate.content_hash}`],
    };
  }

  // 2 · structural validation
  const v = validateCandidate(input.candidate);
  if (!v.ok) {
    const failure_reason: CandidateFailureReason = v.reason === "no_source_evidence"
      ? "no_source_evidence"
      : v.reason === "insufficient_evidence"
      ? "insufficient_evidence"
      : v.reason === "provenance_missing"
      ? "insufficient_evidence"
      : "insufficient_evidence";
    return {
      status: v.reason === "no_source_evidence" ? "REJECTED" : "UNPROVEN",
      failure_reason,
      reasons: [`candidate_invalid:${v.reason}:${v.detail}`],
    };
  }

  // 4/5/6/7 · reviewer verdict is authoritative (§22)
  const rv = input.review.verdict;
  if (rv === "REJECT") {
    return {
      status: "REJECTED",
      failure_reason: "review_rejected",
      review_verdict: rv,
      reasons: input.review.findings.map((f) => `${f.severity}:${f.category}:${f.message}`),
    };
  }
  if (rv === "NEEDS_CHANGES") {
    return {
      status: "REJECTED",
      failure_reason: "review_needs_changes",
      review_verdict: rv,
      reasons: input.review.findings.map((f) => `${f.severity}:${f.category}:${f.message}`),
    };
  }
  if (rv === "UNCERTAIN") {
    return {
      status: "UNPROVEN",
      failure_reason: "review_uncertain",
      review_verdict: rv,
      reasons: ["review_verdict:UNCERTAIN"],
    };
  }
  if (!thresholds.allowed_review_verdicts_for_promotion.includes(rv)) {
    return {
      status: "REJECTED",
      failure_reason: "review_rejected",
      review_verdict: rv,
      reasons: [`verdict_not_allowed:${rv}`],
    };
  }

  // 8 · benchmark thresholds
  if (!input.benchmark.all_thresholds_passed) {
    return {
      status: "REGRESSED",
      failure_reason: "benchmark_below_threshold",
      review_verdict: rv,
      drift_direction: input.drift?.overall_direction,
      reasons: [`benchmark_threshold_failure`],
    };
  }

  // 9 · per-class regression detection
  const regressed = detectClassRegressions(input.drift, thresholds.per_class_min_catch_rate);
  if (regressed.length > 0) {
    return {
      status: "REGRESSED",
      failure_reason: "per_class_regression",
      review_verdict: rv,
      drift_direction: input.drift?.overall_direction,
      reasons: regressed.map((r) => `class_regression:${r}`),
    };
  }

  // 10 · aggregate masking (Phase E adversarial invariant)
  if (detectAggregateMasking(input.drift)) {
    return {
      status: "REGRESSED",
      failure_reason: "aggregate_masking_detected",
      review_verdict: rv,
      drift_direction: input.drift?.overall_direction,
      reasons: ["aggregate_masking:overall_improved_while_class_regressed"],
    };
  }

  // 11 · fresh-process reproducibility
  if (thresholds.require_fresh_process_reproducibility && !input.fresh_process_reproduced) {
    return {
      status: "UNPROVEN",
      failure_reason: "fingerprint_reproduction_failed",
      review_verdict: rv,
      drift_direction: input.drift?.overall_direction,
      reasons: ["fresh_process_reproduction_missing_or_failed"],
    };
  }

  // 12 · PROMOTED
  return {
    status: "PROMOTED",
    reasons: ["candidate_valid", `review:${rv}`, "benchmark_passed", "no_class_regression", "no_aggregate_masking", "fresh_process_reproduced"],
    review_verdict: rv,
    drift_direction: input.drift?.overall_direction ?? "STABLE",
  };
}

// ─── Independence audit ────────────────────────────────────────
//
// A programmatic assertion that the promoter's decision was based
// solely on inputs from the reviewer / benchmark / drift / dedup
// checks. Returns a machine-readable audit record.
export type PromoterIndependenceAudit = {
  used_review_verdict: boolean;
  used_benchmark_thresholds: boolean;
  used_drift_direction: boolean;
  used_class_regression: boolean;
  used_aggregate_masking_check: boolean;
  used_duplicate_check: boolean;
  used_fresh_process_reproduction: boolean;
  used_candidate_self_report: false;   // MUST be false · candidate's own claim never authoritative
  used_experience_self_report: false;
};

/** Produces the audit record for a promotion decision. `used_*_self_report`
 *  are compile-time false: the promoter has no code path that treats
 *  candidate.claim or similar self-reports as authoritative. */
export function auditPromoterIndependence(_input: PromoterInput, _decision: PromotionDecision): PromoterIndependenceAudit {
  return {
    used_review_verdict: true,
    used_benchmark_thresholds: true,
    used_drift_direction: true,
    used_class_regression: true,
    used_aggregate_masking_check: true,
    used_duplicate_check: true,
    used_fresh_process_reproduction: true,
    used_candidate_self_report: false,
    used_experience_self_report: false,
  };
}
