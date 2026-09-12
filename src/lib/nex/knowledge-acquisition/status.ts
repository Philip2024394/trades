// src/lib/nex/knowledge-acquisition/status.ts
//
// P1 REDIRECT · Knowledge Acquisition Capability · status evaluator
// (Philip 2026-09-05 · §OP amendment to the P1 spec)
//
// CONSTITUTIONAL: pipeline modules NEVER set their own final_status.
// This module DERIVES status from the persisted run history + config.
// It is structurally separate from pipeline.ts by design.
//
// Composition with Operational Truth doctrine §16:
//   "A component can claim success. NEX must verify success."
//
// The pipeline claims progress (emits RunStage events + counts).
// This module verifies whether that constitutes a healthy
// operational state, applying deadlines to the persisted evidence.
//
// Pure functions · no I/O · no LLM · fully deterministic.

import type { PipelineRun, Status } from "./types";

/** Configuration for status derivation.
 *  Overridable via env in the runner · defaults chosen conservatively. */
export type StatusConfig = {
  /** How long a run may sit without progress before it's auto-FAILED (ms). */
  staleProgressMs: number;
  /** How long since the last successful run before status decays (ms). */
  workDeadlineMs: number;
  /** How long an invocation-window can be silent before status = NEVER_PROVEN (ms). */
  invocationWindowMs: number;
  /** Minimum verification success rate for HEALTHY (fraction 0..1). */
  minVerificationRate: number;
  /** Max recent-failure count tolerated before DEGRADED. */
  degradedAfterFailures: number;
  /** Max recovery attempts before EXHAUSTED. */
  maxRecoveryAttempts: number;
  /** "Now" injection point for deterministic tests. */
  nowMs: number;
};

export function defaultStatusConfig(nowMs = Date.now()): StatusConfig {
  return {
    staleProgressMs: Number(process.env.NEX_P1_STALE_PROGRESS_MS ?? String(24 * 60 * 60 * 1000)),        // 24h
    workDeadlineMs: Number(process.env.NEX_P1_WORK_DEADLINE_MS ?? String(7 * 24 * 60 * 60 * 1000)),      // 7 days
    invocationWindowMs: Number(process.env.NEX_P1_INVOCATION_WINDOW_MS ?? String(30 * 24 * 60 * 60 * 1000)), // 30 days
    minVerificationRate: Number(process.env.NEX_P1_MIN_VERIFICATION_RATE ?? "0.5"),
    degradedAfterFailures: Number(process.env.NEX_P1_DEGRADED_AFTER_FAILURES ?? "2"),
    maxRecoveryAttempts: Number(process.env.NEX_P1_MAX_RECOVERY_ATTEMPTS ?? "3"),
    nowMs,
  };
}

/** The core evaluator.
 *
 *  Inputs:
 *    · runs: append-only history of pipeline invocations
 *    · config: deadlines + thresholds
 *
 *  Output: single evidence-derived Status per §OP.3.
 *
 *  Never mutates runs. Never sets status back on the runs (that's a
 *  policy decision the caller can make). Pure derivation from evidence.
 */
export function deriveStatus(runs: readonly PipelineRun[], config: StatusConfig = defaultStatusConfig()): {
  status: Status;
  reason: string;
  /** For observability: what evidence drove the verdict. */
  evidence: {
    last_run_id: string | null;
    last_run_completed_at: string | null;
    last_successful_run_id: string | null;
    last_successful_completed_at: string | null;
    stale_runs_detected: number;
    recovery_exhausted: boolean;
    verification_rate_last_5: number | null;
  };
} {
  const nowMs = config.nowMs;
  const noEvidence = {
    last_run_id: null,
    last_run_completed_at: null,
    last_successful_run_id: null,
    last_successful_completed_at: null,
    stale_runs_detected: 0,
    recovery_exhausted: false,
    verification_rate_last_5: null,
  };

  // Case 0 · no invocations ever
  if (runs.length === 0) {
    return {
      status: "NEVER_PROVEN",
      reason: "no invocations recorded",
      evidence: noEvidence,
    };
  }

  // Compute derived signals
  const sorted = [...runs].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  const last = sorted[sorted.length - 1];
  const staleRuns = sorted.filter((r) => {
    if (r.completed_at) return false;
    const progressAt = Date.parse(r.last_progress_at);
    return Number.isFinite(progressAt) && nowMs - progressAt > config.staleProgressMs;
  });
  const successfulRuns = sorted.filter(
    (r) => r.completed_at !== null && r.recovery_result !== "EXHAUSTED" && r.failure_stage === null,
  );
  const lastSuccessful = successfulRuns[successfulRuns.length - 1] ?? null;
  const last5 = sorted.slice(-5);
  const totalClaimsLast5 = last5.reduce((s, r) => s + r.claims_extracted, 0);
  const verifiedLast5 = last5.reduce((s, r) => s + r.claims_verified, 0);
  const verificationRateLast5 = totalClaimsLast5 > 0 ? verifiedLast5 / totalClaimsLast5 : null;
  const recentFailures = last5.filter((r) => r.failure_stage !== null).length;
  const anyRecoveryExhausted = sorted.some((r) => r.recovery_result === "EXHAUSTED");
  const anyRecoveryInProgress = sorted.some((r) => r.recovery_result === "IN_PROGRESS");

  const evidence = {
    last_run_id: last.run_id,
    last_run_completed_at: last.completed_at,
    last_successful_run_id: lastSuccessful?.run_id ?? null,
    last_successful_completed_at: lastSuccessful?.completed_at ?? null,
    stale_runs_detected: staleRuns.length,
    recovery_exhausted: anyRecoveryExhausted,
    verification_rate_last_5: verificationRateLast5,
  };

  // Case 1 · recovery exhausted → FAILED
  if (anyRecoveryExhausted) {
    return {
      status: "FAILED",
      reason: `recovery exhausted on ${sorted.filter((r) => r.recovery_result === "EXHAUSTED").length} run(s)`,
      evidence,
    };
  }

  // Case 2 · a run has been silent longer than staleProgressMs → FAILED
  //   (this is the adversarial-silence detection · §OP.4)
  if (staleRuns.length > 0) {
    return {
      status: "FAILED",
      reason: `${staleRuns.length} stale run(s) · no progress for > ${Math.round(config.staleProgressMs / 60000)}min · silence detected`,
      evidence,
    };
  }

  // Case 3 · currently recovering
  if (anyRecoveryInProgress) {
    return { status: "RECOVERING", reason: "recovery in progress", evidence };
  }

  // Case 4 · no successful runs ever · NEVER_PROVEN
  if (!lastSuccessful) {
    return {
      status: "NEVER_PROVEN",
      reason: `${runs.length} invocation(s) but no successful completion`,
      evidence,
    };
  }

  // Case 5 · last successful run older than workDeadlineMs → FAILED
  const lastSuccessMs = Date.parse(lastSuccessful.completed_at!);
  if (Number.isFinite(lastSuccessMs) && nowMs - lastSuccessMs > config.workDeadlineMs) {
    return {
      status: "FAILED",
      reason: `last successful run ${Math.round((nowMs - lastSuccessMs) / (60 * 60 * 1000))}h ago · exceeds work deadline`,
      evidence,
    };
  }

  // Case 6 · invocation window silence → NEVER_PROVEN degradation
  const lastStartMs = Date.parse(last.started_at);
  if (Number.isFinite(lastStartMs) && nowMs - lastStartMs > config.invocationWindowMs) {
    return {
      status: "NEVER_PROVEN",
      reason: `no invocation in ${Math.round((nowMs - lastStartMs) / (24 * 60 * 60 * 1000))} days · window exceeded`,
      evidence,
    };
  }

  // Case 7 · verification rate below threshold → DEGRADED
  if (verificationRateLast5 !== null && verificationRateLast5 < config.minVerificationRate) {
    return {
      status: "DEGRADED",
      reason: `verification rate ${(verificationRateLast5 * 100).toFixed(0)}% below threshold ${(config.minVerificationRate * 100).toFixed(0)}%`,
      evidence,
    };
  }

  // Case 8 · recent-failure count above tolerance → DEGRADED
  if (recentFailures > config.degradedAfterFailures) {
    return {
      status: "DEGRADED",
      reason: `${recentFailures} failure(s) in last 5 runs · tolerance ${config.degradedAfterFailures}`,
      evidence,
    };
  }

  // Default · PROVEN_HEALTHY
  return {
    status: "PROVEN_HEALTHY",
    reason: `last successful run ${lastSuccessful.run_id.slice(0, 8)}… completed at ${lastSuccessful.completed_at} · verification rate ${verificationRateLast5 !== null ? (verificationRateLast5 * 100).toFixed(0) + "%" : "n/a (no claims)"}`,
    evidence,
  };
}

/** Convenience: overlay the derived status onto a runs array for reporting.
 *  Never persists. Returns a new array. */
export function overlayStatus(runs: readonly PipelineRun[], config?: StatusConfig): PipelineRun[] {
  // Not applying per-row · the derived status is a global capability
  // status, not a per-run mark. Returns runs unchanged. Kept for API
  // symmetry with future per-run status extension.
  return [...runs];
}
