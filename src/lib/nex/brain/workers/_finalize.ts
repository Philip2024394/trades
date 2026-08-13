// src/lib/nex/brain/workers/_finalize.ts
//
// Wave 11 · Step 8 · F35 remediation.
//
// SHARED canonical completion path for every worker. Before this
// module the six workers each maintained ~30 lines of insertResult →
// (maybe enqueueJob) → (maybe insertAudit) → completeJob boilerplate.
// A single missed step (e.g. forgot the audit) was invisible in code
// review because the pattern was replicated per-worker. This module
// makes the pattern a single call so:
//
//   1. Adding a new step (retry ledger · signal · telemetry hook) is
//      one edit that reaches every worker.
//   2. Missing the audit or the completeJob at a worker level becomes
//      a static drift-catcher failure.
//   3. The reader of any worker sees WHAT it does · not HOW it
//      finalizes.
//
// CONVERGENCE
//   Every worker's success path ends with `finalizeWorkerJob(...)`.
//   Every worker's catch path ends with `failWorkerJob(...)`.
//   The workers retain divergent PRE-finalize logic (per-record
//   audits, worker-specific enrichment) — that's genuine domain
//   difference and stays inline. What converges is the closing
//   sequence.

import type { BrainStore } from "../storage";
import type { AuditEntry, WorkerJob, WorkerResult } from "../types";
// W-OBS-1 Path A Layer 1 · read parent worker's CID from ALS so child
// job inherits automatically at enqueue time (§7 of Path A plan).
import { getCorrelationId } from "@/lib/nex/observability/correlation";
// F4 structured logger · Wave 3 H2.b · adopted 2026-08-10.
import { logger } from "@/lib/nex/observability/logger";

const log = logger("worker.finalize");

// Reuse the exact input shape the store expects · never re-derive it.
export type ResultInput = Omit<WorkerResult, "id" | "created_at">;
export type AuditInput  = Omit<AuditEntry,   "id" | "created_at">;
export type EnqueueInput = Omit<WorkerJob, "id" | "status" | "attempts" | "created_at" | "updated_at">;

export type FinalizeInput = {
  /** The claimed job being completed. */
  job: WorkerJob;
  /** The worker_result to insert. `job_id` is filled in from `job` — caller must NOT set it. */
  resultInput: Omit<ResultInput, "job_id">;
  /**
   * OPTIONAL · a next-stage job to enqueue AFTER insertResult and
   * BEFORE the final audit. Preserves the historical order used by
   * knowledge-context, voice-context, and learning-context.
   */
  nextJob?: EnqueueInput;
  /**
   * OPTIONAL · worker-specific side-effect hook that runs AFTER
   * nextJob and BEFORE finalAudit. Currently used by learning-context
   * to mark feedback rows as applied (must land before we claim
   * completion). The hook throwing propagates to the caller's catch
   * so the job goes to failed if the side-effect fails · preserves
   * the pre-remediation semantic exactly.
   */
  betweenNextJobAndFinalAudit?: () => Promise<void>;
  /**
   * OPTIONAL · final worker-completion audit event. Present on 5 of
   * the 6 workers (image-analyst emits per-record audits earlier and
   * has no final one · that pre-finalize divergence stays inline).
   */
  finalAudit?: AuditInput;
};

/**
 * Canonical worker completion path · SUCCESS.
 *
 * Order (exactly · never reordered):
 *   1. insertResult   → returns result
 *   2. enqueueJob     (if nextJob provided)
 *   3. insertAudit    (if finalAudit provided)
 *   4. completeJob(job.id, result.id)
 *
 * Returns the inserted result so callers can attach it to their
 * worker-specific return shape (e.g. { job, result, bundle }).
 */
export async function finalizeWorkerJob(store: BrainStore, input: FinalizeInput): Promise<WorkerResult> {
  const result = await store.insertResult({
    ...input.resultInput,
    job_id: input.job.id,
  });
  if (input.nextJob) {
    // W-OBS-1 Path A Layer 1 · child job inherits parent's CID from ALS.
    // Parent worker established scope via enterJobCorrelationScope(job) at
    // its own claim time · getCorrelationId() reads that value here.
    // Explicit caller-supplied nextJob.input_payload.correlation_id wins
    // if present (rare · reserved for future intentional overrides).
    const parentCid = getCorrelationId();
    const nextJob = parentCid && input.nextJob.input_payload &&
      (input.nextJob.input_payload as Record<string, unknown>).correlation_id == null
      ? {
          ...input.nextJob,
          input_payload: {
            ...(input.nextJob.input_payload as Record<string, unknown>),
            correlation_id: parentCid,
          },
        }
      : input.nextJob;
    await store.enqueueJob(nextJob);
  }
  if (input.betweenNextJobAndFinalAudit)   await input.betweenNextJobAndFinalAudit();
  if (input.finalAudit)                    await store.insertAudit(input.finalAudit);
  await store.completeJob(input.job.id, result.id);
  return result;
}

/**
 * Canonical worker completion path · FAILURE.
 *
 * Every worker's catch block goes through this helper. The err.message
 * is passed to store.failJob so the operator can trace the failure
 * from the worker_jobs row. The tag prefix appears on the local
 * console log for grep-ability.
 *
 * SECURITY · err.message is passed through unchanged because the
 * store contract already accepts it. The helper does NOT invent
 * additional log lines that could contain secrets · it only calls
 * the same store.failJob + console.error path every worker already
 * used.
 */
export async function failWorkerJob(store: BrainStore, job: WorkerJob, err: unknown, tag: string): Promise<string> {
  const message = err instanceof Error ? err.message : String(err);
  log.error("failed", { tag, message, job_id: job.id });
  await store.failJob(job.id, message);
  // Return the extracted message so callers that need it for downstream
  // side-effects (e.g. knowledge-extractor's KnowledgeJob failure sync)
  // don't have to re-extract it.
  return message;
}
