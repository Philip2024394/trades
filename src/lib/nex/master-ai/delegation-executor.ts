// src/lib/nex/master-ai/delegation-executor.ts
//
// NEX Master AI · Delegation Executor (Y-W4-3 · Programmer Consumer bridge)
// Philip 2026-09-07 · AUTHORIZE
//
// Bridge between the Programmer worker and Master AI delegations.
//
// SAFETY (§5):
//   · Programmer's Phase A worker is OBSERVATION-ONLY · this executor
//     does NOT mutate code. It performs a bounded analytical execution
//     that records what a full Phase F/G engineering loop WOULD do,
//     without invoking it.
//   · Full code-mutation execution requires the separately-authorized
//     programmer-improvement candidate loop.
//   · Every delegation is validated before execution · malformed /
//     out-of-scope / sandbox-escape / production-promotion attempts
//     are REJECTED with an explicit reason.

import type { DelegationRecord } from "./delegation";
import type { AutonomousInvocationBounds } from "./types";

// ═════════════════════════════════════════════════════════════════════
// Validation
// ═════════════════════════════════════════════════════════════════════

const SAFE_TASK_SLUG_PATTERN = /^[a-z][a-z0-9_]{2,80}$/;

const PROHIBITED_KEYWORDS_IN_TASK = [
  "rm -rf", "chmod 777", "sudo",
  "delete from", "drop table",
  "self-promote", "self_promote", "auto-promote",
  "bypass", "circumvent", "sandbox escape",
  "production_deploy", "public_release",
];

/** Validates Phase G bounds against the same limits used elsewhere. */
function validateBoundsAgainstPhaseG(bounds: AutonomousInvocationBounds): { ok: boolean; reason?: string } {
  if (bounds.max_iterations < 1 || bounds.max_iterations > 32) return { ok: false, reason: `max_iterations_out_of_range:${bounds.max_iterations}` };
  if (bounds.max_runtime_ms < 100 || bounds.max_runtime_ms > 10 * 60_000) return { ok: false, reason: `max_runtime_ms_out_of_range:${bounds.max_runtime_ms}` };
  if (bounds.max_files_changed < 1 || bounds.max_files_changed > 64) return { ok: false, reason: `max_files_changed_out_of_range:${bounds.max_files_changed}` };
  return { ok: true };
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateDelegation(d: DelegationRecord): ValidationResult {
  if (!SAFE_TASK_SLUG_PATTERN.test(d.task_slug)) {
    return { ok: false, reason: `task_slug_pattern_violation:${d.task_slug}` };
  }
  const boundsCheck = validateBoundsAgainstPhaseG(d.bounds);
  if (!boundsCheck.ok) return { ok: false, reason: boundsCheck.reason! };
  const combined = `${d.task_slug} ${d.task_description} ${d.reason}`.toLowerCase();
  for (const kw of PROHIBITED_KEYWORDS_IN_TASK) {
    if (combined.includes(kw)) return { ok: false, reason: `prohibited_keyword:${kw}` };
  }
  return { ok: true };
}

// ═════════════════════════════════════════════════════════════════════
// Bounded observation-style execution
// ═════════════════════════════════════════════════════════════════════

export type ExecutionResult = {
  status: "COMPLETED" | "FAILED" | "REJECTED" | "TIMED_OUT";
  outcome_notes: string;
  measured_runtime_ms: number;
  files_touched_count: number;                     // always 0 for Phase A observation
  observation_summary: string;                     // structured summary of what would be done
  bench_verdict: "IMPROVED" | "NO_CHANGE" | "REGRESSED" | "INCONCLUSIVE" | "NO_VALID_IMPROVEMENT";
};

/** Bounded observation-style execution · Phase A safe.
 *  Records what a full engineering loop WOULD do without doing it. */
export async function executeDelegation(d: DelegationRecord): Promise<ExecutionResult> {
  const startMs = Date.now();

  // Validate first · fail closed on any issue
  const v = validateDelegation(d);
  if (!v.ok) {
    return {
      status: "REJECTED",
      outcome_notes: `validation_failed:${v.reason}`,
      measured_runtime_ms: Date.now() - startMs,
      files_touched_count: 0,
      observation_summary: `Delegation ${d.delegation_id.slice(0, 8)} rejected during validation.`,
      bench_verdict: "NO_VALID_IMPROVEMENT",
    };
  }

  // Bounded observation: read task description, produce a structured
  // analysis of what a full Phase F/G engineering loop would attempt.
  // This is honest to the Phase A worker's actual capabilities.
  const analysisLines: string[] = [];
  analysisLines.push(`delegation_id: ${d.delegation_id}`);
  analysisLines.push(`task_slug: ${d.task_slug}`);
  analysisLines.push(`task_description: ${d.task_description.slice(0, 200)}`);
  analysisLines.push(`bounds: iter=${d.bounds.max_iterations} runtime=${d.bounds.max_runtime_ms}ms files=${d.bounds.max_files_changed}`);
  analysisLines.push(`analysis: task classified as OBSERVATION_ONLY · Phase A worker records what a Phase F/G loop would attempt`);
  analysisLines.push(`recommended_next_step: register a candidate proposal in programmer-improvement ledger for founder review`);
  analysisLines.push(`benchmark: none run · Phase A worker does not run benchmarks · Master AI should observe outcome and decide if a benchmark run is warranted`);

  const runtime = Date.now() - startMs;
  return {
    status: "COMPLETED",
    outcome_notes: `Phase A observation-only execution completed · runtime=${runtime}ms · full engineering requires separate authorization`,
    measured_runtime_ms: runtime,
    files_touched_count: 0,
    observation_summary: analysisLines.join(" · "),
    bench_verdict: "NO_VALID_IMPROVEMENT",
  };
}

// ═════════════════════════════════════════════════════════════════════
// End-to-end · claim → execute → outcome (idempotent)
// ═════════════════════════════════════════════════════════════════════

import {
  atomicClaim,
  markInProgress,
  recordDelegationOutcome,
  getDelegation,
} from "./delegation";
import type { MasterAgentId } from "./types";

export type ProcessDelegationInputs = {
  delegation_id: string;
  recipient: MasterAgentId;                         // e.g. "programmer"
  claimer_id: string;                                // stable per-worker run_id
};

export type ProcessDelegationOutcome = {
  attempted: boolean;
  final_status: DelegationRecord["status"] | null;
  reason: string;
  execution_result: ExecutionResult | null;
};

/** Full pipeline: PENDING → ACCEPTED → IN_PROGRESS → terminal.
 *  Idempotent for restart safety · if the delegation has already been
 *  processed by this claimer, no-op returns. */
export async function processOneDelegation(input: ProcessDelegationInputs): Promise<ProcessDelegationOutcome> {
  const current = getDelegation(input.delegation_id);
  if (!current) {
    return { attempted: false, final_status: null, reason: "unknown_delegation", execution_result: null };
  }
  if (current.status !== "PENDING") {
    return { attempted: false, final_status: current.status, reason: `not_pending:${current.status}`, execution_result: null };
  }
  // Atomic claim
  const claimed = atomicClaim({
    delegation_id: input.delegation_id,
    claimer_id: input.claimer_id,
    recipient: input.recipient,
  });
  if (!claimed) {
    return { attempted: true, final_status: null, reason: "claim_lost_or_invalid", execution_result: null };
  }
  // Transition to IN_PROGRESS
  markInProgress({ delegation_id: input.delegation_id, recipient: input.recipient });
  // Bounded observation-style execution
  const exec = await executeDelegation(claimed);
  // Record terminal outcome
  const terminal = recordDelegationOutcome({
    delegation_id: input.delegation_id,
    recipient: input.recipient,
    status: exec.status,
    outcome_ref: null,
    outcome_notes: `${exec.outcome_notes} · bench=${exec.bench_verdict} · files=${exec.files_touched_count} · summary=${exec.observation_summary.slice(0, 200)}`,
  });
  return {
    attempted: true,
    final_status: terminal.status,
    reason: exec.outcome_notes,
    execution_result: exec,
  };
}
