// src/lib/nex/brain/timeouts/withWorkerDeadline.ts
//
// Wave 3 · H3 · T-6 / T-7 opt-in worker + per-job deadline wrappers.
// Governed by: docs/headquarters-production-readiness/WAVE-3-H3-TIMEOUT-BUDGETS.md
//
// PURPOSE
//   Provide the mechanism for enforcing worker-cycle (T-6) and per-job (T-7)
//   deadlines without changing default runtime behaviour. When the relevant
//   env var is `0` (the default) each wrapper is a no-op — the fn runs
//   without any budget. When set to a positive value inside its sanity range
//   the wrapper races the fn against an AbortController that fires after the
//   configured ms and throws `TimeoutError` on expiry.
//
// SEMANTICS
//   · On timeout: TimeoutError throws · counter `timeout.worker_cycle` or
//     `timeout.job_budget` bumps · caller's existing try/catch (typically
//     failWorkerJob) runs · DB lease expires naturally · job requeues.
//   · The fn CONTINUES running in the background after we throw (Node has
//     no true async cancellation without cooperation). Callers whose fn
//     produces external side effects should treat this as at-least-once
//     execution AFTER a timeout. Idempotency is the caller's responsibility.
//   · No retry amplification inside these wrappers · exactly one attempt.
//
// USAGE
//   const summary = await withWorkerCycleDeadline("cron-tick", () => runOneCycle());
//   const result = await withJobBudget("knowledge-extractor", () => processJob(job));
//
// See §4.3 of the design doc for error taxonomy and §4.5 for the
// intentional-no-op-by-default policy.

import { TimeoutError, workerCycleDeadlineMs, jobBudgetMs } from "@/lib/nex/config/timeouts";
import { incr } from "@/lib/nex/observability/counters";

async function withDeadline<T>(
  cls: "worker_cycle" | "job_budget",
  budget_ms: number,
  fn: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      incr(cls === "worker_cycle" ? "timeout.worker_cycle" : "timeout.job_budget");
      reject(new TimeoutError(cls, budget_ms));
    }, budget_ms);
    // Unref so a stray timer never keeps the process alive after the fn
    // resolves. Node's clearTimeout on success covers the common path.
    (timer as { unref?: () => void }).unref?.();
  });
  try {
    return await Promise.race([fn(), deadline]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * T-6 · wrap a worker cycle in the configured cycle deadline.
 * When `NEX_WORKER_CYCLE_DEADLINE_MS` is `0` (default) this is a no-op and
 * fn runs unbounded (existing behaviour preserved).
 *
 * @param tag identifier for the cycle (used in the TimeoutError message)
 * @param fn cycle body
 */
export async function withWorkerCycleDeadline<T>(tag: string, fn: () => Promise<T>): Promise<T> {
  const ms = workerCycleDeadlineMs();
  if (ms <= 0) return fn();
  try {
    return await withDeadline("worker_cycle", ms, fn);
  } catch (e) {
    if (e instanceof TimeoutError) {
      throw new TimeoutError("worker_cycle", ms, `timeout-worker-cycle · ${tag} · budget ${ms}ms exceeded`);
    }
    throw e;
  }
}

/**
 * T-7 · wrap a single-job body in the configured per-job budget.
 * When `NEX_WORKER_JOB_BUDGET_MS` is `0` (default) this is a no-op.
 */
export async function withJobBudget<T>(tag: string, fn: () => Promise<T>): Promise<T> {
  const ms = jobBudgetMs();
  if (ms <= 0) return fn();
  try {
    return await withDeadline("job_budget", ms, fn);
  } catch (e) {
    if (e instanceof TimeoutError) {
      throw new TimeoutError("job_budget", ms, `timeout-job-budget · ${tag} · budget ${ms}ms exceeded`);
    }
    throw e;
  }
}
