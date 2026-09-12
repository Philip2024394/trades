// src/lib/nex/programmer-benchmark/evaluator.ts
//
// NEX Programmer Agent · Phase D · deterministic evaluator
// Philip 2026-09-05 · AUTHORIZE · PHASE D
//
// Given a frozen corpus, runs each case through the Programmer
// review() function, compares actual verdict to expected verdict,
// and aggregates per-class + overall metrics.
//
// Discipline:
//   · Deterministic (same corpus + same reviewer → same results).
//   · Never modifies the corpus during evaluation.
//   · Preserves execution errors as EXECUTION_ERROR (§27) rather than
//     silently excluding cases.
//   · Never declares itself healthy — EvaluationRun.final_status=null.
//   · Reports per-class metrics · never hides weak classes behind
//     aggregate averages (§13).
//   · Threshold checker returns per-criterion pass/fail so a caller
//     can decide GREEN/YELLOW/RED without ambiguity.

import { review } from "@/lib/nex/programmer-review/reviewer";
import type {
  BenchmarkCase,
  BenchmarkCorpus,
  ClassMetrics,
  EvaluationResult,
  EvaluationRun,
  OverallMetrics,
  ThresholdCheck,
  Thresholds,
} from "./types";
import { DEFAULT_THRESHOLDS } from "./types";

// ─── Evaluate a single case ─────────────────────────────────────

export function evaluateCase(c: BenchmarkCase): EvaluationResult {
  const started = new Date().toISOString();
  try {
    const resp = review(c.request);
    const match: "CORRECT" | "WRONG" =
      resp.verdict === c.expected_verdict ? "CORRECT" : "WRONG";
    return {
      case_id: c.case_id,
      corpus_version: c.corpus_version,
      defect_class: c.defect_class,
      difficulty: c.difficulty,
      ground_truth: c.ground_truth,
      expected_verdict: c.expected_verdict,
      actual_verdict: resp.verdict,
      match_status: match,
      expected_finding_categories: c.expected_finding_categories,
      actual_finding_categories: resp.findings.map((f) => f.category),
      actual_finding_count: resp.findings.length,
      actual_confidence: resp.confidence,
      actual_review_id: resp.review_id,
      knowledge_used: resp.knowledge_used,
      reasoning_trace_length: resp.reasoning_trace.length,
      timestamp: started,
    };
  } catch (e) {
    const errMsg = (e as Error)?.message ?? String(e);
    return {
      case_id: c.case_id,
      corpus_version: c.corpus_version,
      defect_class: c.defect_class,
      difficulty: c.difficulty,
      ground_truth: c.ground_truth,
      expected_verdict: c.expected_verdict,
      actual_verdict: "UNCERTAIN", // placeholder · match_status carries the real signal
      match_status: "EXECUTION_ERROR",
      execution_error: errMsg.slice(0, 500),
      expected_finding_categories: c.expected_finding_categories,
      actual_finding_categories: [],
      actual_finding_count: 0,
      actual_confidence: "low",
      actual_review_id: `err_${c.case_id}`,
      knowledge_used: [],
      reasoning_trace_length: 0,
      timestamp: started,
    };
  }
}

// ─── Aggregate metrics ──────────────────────────────────────────

export function aggregatePerClass(results: EvaluationResult[]): ClassMetrics[] {
  const byClass = new Map<string, EvaluationResult[]>();
  for (const r of results) {
    const arr = byClass.get(r.defect_class) ?? [];
    arr.push(r);
    byClass.set(r.defect_class, arr);
  }
  const out: ClassMetrics[] = [];
  for (const [cls, arr] of byClass.entries()) {
    const total = arr.length;
    const correct = arr.filter((r) => r.match_status === "CORRECT").length;
    const wrong = arr.filter((r) => r.match_status === "WRONG").length;
    const execErr = arr.filter((r) => r.match_status === "EXECUTION_ERROR").length;
    // Catch rate = correct / (total - execErr) · execution errors excluded from denominator (§27)
    // Preserved as execution_error count for transparency.
    const denom = Math.max(1, total - execErr);
    out.push({
      defect_class: cls as ClassMetrics["defect_class"],
      total,
      correct,
      wrong,
      execution_error: execErr,
      catch_rate: correct / denom,
    });
  }
  // Sort by class name for deterministic output
  out.sort((a, b) => a.defect_class.localeCompare(b.defect_class));
  return out;
}

export function aggregateOverall(results: EvaluationResult[], cases: readonly BenchmarkCase[]): OverallMetrics {
  const total = results.length;
  const correct = results.filter((r) => r.match_status === "CORRECT").length;
  const wrong = results.filter((r) => r.match_status === "WRONG").length;
  const execErr = results.filter((r) => r.match_status === "EXECUTION_ERROR").length;

  const defectiveResults = results.filter((r) => r.ground_truth === "DEFECTIVE" || r.ground_truth === "INCOMPLETE");
  const defectiveCorrect = defectiveResults.filter((r) => r.match_status === "CORRECT").length;
  const defectiveTotal = defectiveResults.length;
  const defectiveCatchRate = defectiveTotal === 0 ? 0 : defectiveCorrect / defectiveTotal;

  const correctResults = results.filter((r) => r.ground_truth === "CORRECT");
  const correctCorrect = correctResults.filter((r) => r.match_status === "CORRECT").length;
  const correctTotal = correctResults.length;
  // False-positive rate = correct-code cases wrongly rejected
  // (ground_truth=CORRECT AND match=WRONG · reviewer said something bad)
  const falsePositive = correctResults.filter((r) => r.match_status === "WRONG").length;
  const falsePositiveRate = correctTotal === 0 ? 0 : falsePositive / correctTotal;

  const uncertainResults = results.filter((r) => r.ground_truth === "UNCERTAIN");
  const uncertainCorrect = uncertainResults.filter((r) => r.match_status === "CORRECT").length;
  const uncertainTotal = uncertainResults.length;
  const uncertainAccuracy = uncertainTotal === 0 ? 0 : uncertainCorrect / uncertainTotal;

  // Tests-pass-but-code-wrong bucket (opt-in via case flag)
  const tpbwCases = cases.filter((c) => c.tests_pass_but_code_wrong === true);
  const tpbwCaseIds = new Set(tpbwCases.map((c) => c.case_id));
  const tpbwResults = results.filter((r) => tpbwCaseIds.has(r.case_id));
  const tpbwCorrect = tpbwResults.filter((r) => r.match_status === "CORRECT").length;
  const tpbwTotal = tpbwResults.length;
  const tpbwCatchRate = tpbwTotal === 0 ? 0 : tpbwCorrect / tpbwTotal;

  return {
    total_cases: total,
    correct,
    wrong,
    execution_error: execErr,
    overall_accuracy: total === 0 ? 0 : correct / total,
    defective_correct: defectiveCorrect,
    defective_total: defectiveTotal,
    defective_catch_rate: defectiveCatchRate,
    correct_correctly_accepted: correctCorrect,
    correct_total: correctTotal,
    false_positive_rate: falsePositiveRate,
    uncertain_correct: uncertainCorrect,
    uncertain_total: uncertainTotal,
    uncertain_accuracy: uncertainAccuracy,
    tests_pass_but_code_wrong_correct: tpbwCorrect,
    tests_pass_but_code_wrong_total: tpbwTotal,
    tests_pass_but_code_wrong_catch_rate: tpbwCatchRate,
  };
}

// ─── Threshold checks (§14 · §35) ────────────────────────────────

export function checkThresholds(
  overall: OverallMetrics,
  perClass: ClassMetrics[],
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): ThresholdCheck[] {
  const checks: ThresholdCheck[] = [];

  // Per-class catch rate on sufficiently-represented classes (defective/incomplete only)
  for (const cls of perClass) {
    const isControl = cls.defect_class.startsWith("control.");
    if (isControl) continue;
    if (cls.total < thresholds.min_class_sample_for_threshold) {
      checks.push({
        criterion: `class:${cls.defect_class}:sample_size`,
        measured: cls.total,
        threshold: thresholds.min_class_sample_for_threshold,
        passed: false,
        detail: `INFO · class has ${cls.total} sample(s), below ${thresholds.min_class_sample_for_threshold} threshold; excluded from catch-rate check.`,
      });
      continue;
    }
    checks.push({
      criterion: `class:${cls.defect_class}:catch_rate`,
      measured: cls.catch_rate,
      threshold: thresholds.per_class_min_catch_rate,
      passed: cls.catch_rate >= thresholds.per_class_min_catch_rate,
      detail: `${cls.correct}/${cls.total - cls.execution_error} correct (${(cls.catch_rate * 100).toFixed(1)}%)`,
    });
  }

  // Tests-pass-but-code-wrong catch rate
  if (overall.tests_pass_but_code_wrong_total > 0) {
    checks.push({
      criterion: "tests_pass_but_code_wrong:catch_rate",
      measured: overall.tests_pass_but_code_wrong_catch_rate,
      threshold: thresholds.tests_pass_but_code_wrong_min_catch_rate,
      passed: overall.tests_pass_but_code_wrong_catch_rate >= thresholds.tests_pass_but_code_wrong_min_catch_rate,
      detail: `${overall.tests_pass_but_code_wrong_correct}/${overall.tests_pass_but_code_wrong_total} correct (${(overall.tests_pass_but_code_wrong_catch_rate * 100).toFixed(1)}%)`,
    });
  }

  // False-positive rate
  if (overall.correct_total > 0) {
    checks.push({
      criterion: "false_positive_rate:max",
      measured: overall.false_positive_rate,
      threshold: thresholds.max_false_positive_rate,
      passed: overall.false_positive_rate <= thresholds.max_false_positive_rate,
      detail: `${overall.correct_total - overall.correct_correctly_accepted}/${overall.correct_total} correct-code cases wrongly flagged (${(overall.false_positive_rate * 100).toFixed(1)}%)`,
    });
  }

  // Uncertainty accuracy
  if (overall.uncertain_total > 0) {
    checks.push({
      criterion: "uncertainty_accuracy:min",
      measured: overall.uncertain_accuracy,
      threshold: thresholds.min_uncertainty_accuracy,
      passed: overall.uncertain_accuracy >= thresholds.min_uncertainty_accuracy,
      detail: `${overall.uncertain_correct}/${overall.uncertain_total} uncertain cases correctly recognized (${(overall.uncertain_accuracy * 100).toFixed(1)}%)`,
    });
  }

  return checks;
}

// ─── Full evaluation run ────────────────────────────────────────

let _rid = 0;
function nextRunId(): string {
  _rid += 1;
  return `run_phase_d_${Date.now().toString(36)}_${_rid}`;
}

export function evaluateCorpus(corpus: BenchmarkCorpus, opts: { triggered_by?: "manual" | "runner" } = {}): EvaluationRun {
  const startedAt = new Date().toISOString();
  const results: EvaluationResult[] = [];
  for (const c of corpus.cases) {
    results.push(evaluateCase(c));
  }
  const overall = aggregateOverall(results, corpus.cases);
  const perClass = aggregatePerClass(results);
  return {
    run_id: nextRunId(),
    corpus_version: corpus.version,
    started_at: startedAt,
    completed_at: new Date().toISOString(),
    triggered_by: opts.triggered_by ?? "manual",
    results,
    overall,
    per_class: perClass,
    final_status: null,
  };
}

// ─── Threshold verdict helper ───────────────────────────────────

export type VerdictAggregate = "GREEN" | "YELLOW" | "RED";

/** Derive GREEN/YELLOW/RED from threshold checks. Never hides weak
 *  classes — a single failed critical criterion drops to YELLOW at
 *  minimum. YELLOW when some checks are informational-only (small
 *  sample); RED when a substantive threshold fails. */
export function deriveEvaluationVerdict(checks: ThresholdCheck[]): {
  verdict: VerdictAggregate;
  reasons: string[];
} {
  const reasons: string[] = [];
  let hasFailedCritical = false;
  let hasFailedInfoOnly = false;
  for (const c of checks) {
    if (c.passed) continue;
    if (c.criterion.endsWith(":sample_size")) {
      hasFailedInfoOnly = true;
      reasons.push(`INFO · ${c.criterion} · ${c.detail}`);
    } else {
      hasFailedCritical = true;
      reasons.push(`FAIL · ${c.criterion} · measured=${c.measured.toFixed(3)} · threshold=${c.threshold} · ${c.detail}`);
    }
  }
  if (hasFailedCritical) return { verdict: "RED", reasons };
  if (hasFailedInfoOnly) return { verdict: "YELLOW", reasons };
  return { verdict: "GREEN", reasons: reasons.length ? reasons : ["all thresholds passed"] };
}
