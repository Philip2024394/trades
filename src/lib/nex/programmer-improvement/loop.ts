// src/lib/nex/programmer-improvement/loop.ts
//
// NEX Programmer Agent · Phase F · bounded continuous-improvement loop
// Philip 2026-09-06 · AUTHORIZE · PHASE F · §5 §11 §12 §13 §21
//
// The loop composes candidate + evaluator-adapter + promoter + history
// into a single deterministic pipeline. It is BOUNDED · STOPPABLE ·
// OBSERVABLE. There is NO setInterval / setTimeout / cron / watcher /
// daemon anywhere in this file · a Phase-F audit test enforces that.
//
// Callers control cadence explicitly. `runImprovementCycle` executes
// EXACTLY ONE candidate end-to-end; `runImprovementBatch` executes N
// candidates sequentially with a hard cap. Neither returns until every
// requested candidate has terminated.

import type { BenchmarkCorpus } from "@/lib/nex/programmer-benchmark/types";
import type { ReviewRequest } from "@/lib/nex/programmer-review/types";
import type {
  ImprovementRun,
  ImprovementHistoryEntry,
  LearningCandidate,
  CandidateStatus,
  ImprovementThresholds,
} from "./types";
import { CANDIDATE_FAILURE_STATUSES } from "./types";
import { advanceLifecycle, isDuplicateCandidate } from "./candidate";
import {
  runReview,
  runBenchmark,
  buildStabilityRunFromEvaluation,
  runDrift,
  verifyFreshProcessReproduction,
} from "./evaluator-adapter";
import {
  decidePromotion,
  type PromoterInput,
} from "./promoter";
import {
  appendCandidate,
  appendImprovementHistoryEntry,
  generateImprovementRunId,
  persistFullImprovementRun,
  readCandidates,
} from "./history";
import type { StabilityRun } from "@/lib/nex/programmer-stability/types";

// ─── Loop inputs ───────────────────────────────────────────────

export type ImprovementCycleInput = {
  candidate: LearningCandidate;
  review_request: ReviewRequest;
  corpus: BenchmarkCorpus;
  /** The baseline stability run this cycle compares against. When null,
   *  no drift analysis is performed and the promoter treats drift as
   *  "no baseline" (first-run allowance). Note: fresh_process_reproduced
   *  is still required unless explicitly disabled in thresholds. */
  baseline: StabilityRun | null;
  /** How to verify fresh-process reproducibility. When absent, the
   *  promoter will UNPROVEN the candidate because of §15. */
  fresh_process_verification: {
    expected_fingerprint: string;
    runner_script: string;
    env?: Record<string, string>;
    timeout_ms?: number;
  } | null;
  thresholds?: ImprovementThresholds;
  repo_root: string;
  knowledge_snapshot_hash?: string;
  /** Set to false to skip persistence · used by pure-function tests. */
  persist?: boolean;
  now?: () => string;
  triggered_by?: ImprovementRun["triggered_by"];
  /** Optional list of priors for duplicate detection. When absent,
   *  the loop reads them from the persistent store. */
  priors_for_duplicate_check?: readonly LearningCandidate[];
};

// ─── The pipeline ──────────────────────────────────────────────

/** Execute ONE candidate end-to-end. Returns the ImprovementRun.
 *  Never mutates the candidate. Never persists production data. */
export function runImprovementCycle(input: ImprovementCycleInput): ImprovementRun {
  const now = input.now ?? (() => new Date().toISOString());
  const startedAt = now();
  const runId = generateImprovementRunId();
  const persist = input.persist !== false;
  const triggered_by = input.triggered_by ?? "manual";

  // ─── Duplicate check (§23) ─────────────────────────────────
  const priors = input.priors_for_duplicate_check ?? (persist ? readCandidates() : []);
  const duplicate = isDuplicateCandidate(input.candidate, priors);

  // ─── Candidate persistence (append-only) ───────────────────
  if (persist && !duplicate) {
    try { appendCandidate(input.candidate); }
    catch { /* history layer handles duplicate rejection · never crash pipeline */ }
  }

  const status_trace: ImprovementRun["status_trace"] = [];
  const traceTo = (from: CandidateStatus, to: CandidateStatus, note?: string) => {
    const t = advanceLifecycle(from, to);
    if (!t.ok) return { ok: false as const, reason: t.reason };
    (status_trace as { from: CandidateStatus; to: CandidateStatus; at: string; note?: string }[]).push({ from, to, at: now(), note });
    return { ok: true as const };
  };

  let current: CandidateStatus = "OBSERVED";
  const terminal = (
    final: CandidateStatus,
    note: string,
    partial: Partial<ImprovementRun>,
  ): ImprovementRun => {
    const t = advanceLifecycle(current, final);
    // Failure transitions are always legal; we still record the trace.
    (status_trace as { from: CandidateStatus; to: CandidateStatus; at: string; note?: string }[]).push({
      from: current, to: final, at: now(), note: `terminal:${note}`,
    });
    const completed_at = now();
    // The manifest_at_start and manifest_at_end need capture even in
    // early-terminal paths. We only capture them when the corpus is
    // available · corpus is required as input so always present.
    const manifest_at_start = partial.manifest_at_start ?? partial.manifest_at_end ?? _placeholderManifest();
    const manifest_at_end = partial.manifest_at_end ?? manifest_at_start;
    const run: ImprovementRun = {
      run_id: runId,
      candidate_id: input.candidate.candidate_id,
      candidate_kind: input.candidate.kind,
      started_at: startedAt,
      completed_at,
      triggered_by,
      status_trace,
      terminal_status: final,
      manifest_at_start,
      manifest_at_end,
      benchmark_run_pointer: partial.benchmark_run_pointer,
      review_response: partial.review_response,
      drift_report: partial.drift_report,
      fresh_process_reproduced: partial.fresh_process_reproduced,
      promotion_decision: partial.promotion_decision,
      notes: note,
      final_status: null,
    };
    if (persist) {
      try { persistFullImprovementRun(run); } catch { /* swallow persistence · run still returned */ }
      const entry: ImprovementHistoryEntry = {
        run_id: run.run_id,
        candidate_id: run.candidate_id,
        candidate_kind: run.candidate_kind,
        started_at: run.started_at,
        completed_at: run.completed_at,
        terminal_status: run.terminal_status,
        notes: run.notes,
        final_status: null,
        drift_summary: run.drift_report ? {
          fingerprint_identical: run.drift_report.fingerprints_identical,
          overall_direction: run.drift_report.overall_direction,
        } : undefined,
        promotion_status: run.promotion_decision?.status,
      };
      try { appendImprovementHistoryEntry(entry); } catch { /* swallow · run still returned */ }
    }
    return run;
  };

  // Early duplicate terminal (§23) — promoter would also reject, but we
  // short-circuit to avoid pointless benchmark + review work.
  if (duplicate) {
    const decision = decidePromotion({
      candidate: input.candidate,
      review: { review_id: "n/a", verdict: "UNCERTAIN", confidence: "low", findings: [], evidence_inspected: [], knowledge_used: [], reasoning_trace: [], reviewer_timestamp: startedAt },
      benchmark: { current_evaluation: { run_id: "n/a", corpus_version: input.corpus.version, started_at: startedAt, completed_at: startedAt, triggered_by: "manual", results: [], overall: _zeroOverall(), per_class: [], final_status: null }, all_thresholds_passed: false },
      drift: null,
      fresh_process_reproduced: false,
      is_duplicate: true,
      thresholds: input.thresholds,
    });
    return terminal("REJECTED", `duplicate_candidate:${input.candidate.content_hash}`, {
      promotion_decision: decision,
    });
  }

  // ─── EVALUATING (benchmark) ────────────────────────────────
  const t1 = traceTo(current, "CANDIDATE");
  if (!t1.ok) return terminal("FAILED", `machinery_failure:${t1.reason}`, {});
  current = "CANDIDATE";

  const t2 = traceTo(current, "EVALUATING");
  if (!t2.ok) return terminal("FAILED", `machinery_failure:${t2.reason}`, {});
  current = "EVALUATING";

  let currentStabilityRun: StabilityRun;
  let benchmarkAllPassed: boolean;
  try {
    const b = runBenchmark({ corpus: input.corpus, triggered_by: "runner", thresholds: undefined });
    benchmarkAllPassed = b.all_thresholds_passed;
    currentStabilityRun = buildStabilityRunFromEvaluation({
      evaluation: b.evaluation,
      corpus: input.corpus,
      knowledge_snapshot_hash: input.knowledge_snapshot_hash,
      repo_root: input.repo_root,
      triggered_by: "runner",
      parent_run_id: input.baseline?.run_id ?? null,
      baseline_run_id: input.baseline?.run_id ?? null,
      full_result_pointer: "",
    });
  } catch (err) {
    return terminal("FAILED", `benchmark_machinery_failure:${(err as Error).message}`, {});
  }

  // ─── REVIEWED (Phase C independent reviewer) ───────────────
  const t3 = traceTo(current, "REVIEWED");
  if (!t3.ok) return terminal("FAILED", `machinery_failure:${t3.reason}`, {});
  current = "REVIEWED";

  let reviewResponse;
  try { reviewResponse = runReview(input.review_request); }
  catch (err) {
    return terminal("FAILED", `review_machinery_failure:${(err as Error).message}`, {
      manifest_at_start: currentStabilityRun.version_manifest,
      manifest_at_end: currentStabilityRun.version_manifest,
    });
  }

  // ─── BENCHMARKED ─────────────────────────────────────────
  const t4 = traceTo(current, "BENCHMARKED");
  if (!t4.ok) return terminal("FAILED", `machinery_failure:${t4.reason}`, {});
  current = "BENCHMARKED";

  // ─── STABLE (drift + fresh-process) ──────────────────────
  const t5 = traceTo(current, "STABLE");
  if (!t5.ok) return terminal("FAILED", `machinery_failure:${t5.reason}`, {});
  current = "STABLE";

  const driftReport = input.baseline ? runDrift(input.baseline, currentStabilityRun) : null;

  let freshProcessReproduced = false;
  if (input.fresh_process_verification) {
    try {
      const r = verifyFreshProcessReproduction({
        expected_fingerprint: input.fresh_process_verification.expected_fingerprint,
        runner_script: input.fresh_process_verification.runner_script,
        env: input.fresh_process_verification.env,
        timeout_ms: input.fresh_process_verification.timeout_ms,
      });
      freshProcessReproduced = r.reproduced;
    } catch {
      freshProcessReproduced = false;
    }
  }

  // ─── Promoter (pure function) ────────────────────────────
  const promoterInput: PromoterInput = {
    candidate: input.candidate,
    review: reviewResponse,
    benchmark: {
      baseline_evaluation: undefined,
      current_evaluation: {
        run_id: "n/a",
        corpus_version: input.corpus.version,
        started_at: startedAt,
        completed_at: now(),
        triggered_by: "runner",
        results: [],
        overall: currentStabilityRun.overall,
        per_class: currentStabilityRun.per_class,
        final_status: null,
      },
      all_thresholds_passed: benchmarkAllPassed,
    },
    drift: driftReport,
    fresh_process_reproduced: freshProcessReproduced,
    is_duplicate: false,
    thresholds: input.thresholds,
  };
  const decision = decidePromotion(promoterInput);

  if (decision.status === "PROMOTED") {
    return terminal("PROMOTED", "promoter:PROMOTED", {
      manifest_at_start: currentStabilityRun.version_manifest,
      manifest_at_end: currentStabilityRun.version_manifest,
      review_response: reviewResponse,
      drift_report: driftReport ?? undefined,
      fresh_process_reproduced: freshProcessReproduced,
      promotion_decision: decision,
    });
  }

  // Any other decision status is a terminal-failure state.
  const finalStatus: CandidateStatus =
    decision.status === "REJECTED" ? "REJECTED"
    : decision.status === "REGRESSED" ? "REGRESSED"
    : decision.status === "UNPROVEN" ? "UNPROVEN"
    : decision.status === "CONFLICTED" ? "CONFLICTED"
    : "FAILED";

  return terminal(finalStatus, `promoter:${decision.status}:${decision.reasons.join(",")}`.slice(0, 500), {
    manifest_at_start: currentStabilityRun.version_manifest,
    manifest_at_end: currentStabilityRun.version_manifest,
    review_response: reviewResponse,
    drift_report: driftReport ?? undefined,
    fresh_process_reproduced: freshProcessReproduced,
    promotion_decision: decision,
  });
}

// ─── Batch runner ──────────────────────────────────────────────

export type BatchInput = {
  cycles: readonly ImprovementCycleInput[];
  /** Hard maximum, enforced. Even if `cycles.length > max_cycles`, we
   *  execute only the first `max_cycles` entries. Defence against
   *  runaway loops (§12 §24). */
  max_cycles?: number;
};

export function runImprovementBatch(input: BatchInput): { runs: ImprovementRun[]; truncated: boolean } {
  const cap = Math.max(1, input.max_cycles ?? 8);
  const requested = input.cycles.length;
  const slice = input.cycles.slice(0, cap);
  const runs = slice.map((cycle) => runImprovementCycle(cycle));
  return { runs, truncated: requested > cap };
}

// ─── Private helpers ───────────────────────────────────────────

function _placeholderManifest() {
  // Only used when a run terminates before benchmark; never used for
  // attribution because attribution requires a real manifest.
  return {
    benchmark_version: "UNKNOWN",
    benchmark_hash: "UNKNOWN",
    reviewer_hash: "UNKNOWN",
    evaluator_hash: "UNKNOWN",
    knowledge_snapshot_hash: "UNKNOWN" as const,
    environment_identifier: "UNKNOWN",
    captured_at: new Date().toISOString(),
  };
}

function _zeroOverall() {
  return {
    total_cases: 0,
    correct: 0,
    wrong: 0,
    execution_error: 0,
    overall_accuracy: 0,
    defective_correct: 0,
    defective_total: 0,
    defective_catch_rate: 0,
    correct_correctly_accepted: 0,
    correct_total: 0,
    false_positive_rate: 0,
    uncertain_correct: 0,
    uncertain_total: 0,
    uncertain_accuracy: 0,
    tests_pass_but_code_wrong_correct: 0,
    tests_pass_but_code_wrong_total: 0,
    tests_pass_but_code_wrong_catch_rate: 0,
  };
}
