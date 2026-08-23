// NEX HQ · Worker Evaluator entry-point · Task #72 Step 3
//
// Orchestrates the six-criteria evaluation for a single worker.
// Reads a canonical WorkerRef, runs the spec, computes verdict, returns
// a fully-populated WorkerEvaluation the UI can render + expose as
// click-through evidence.

import type { Pool } from "pg";
import type { CriterionResult, CriteriaKey, WorkerEvaluation, WorkerRef } from "./worker-criteria";
import {
  deriveVerdict,
  evaluateHeartbeatCriterion,
  evaluateProvabilityCriterion,
  loadRecentFailures,
  hasEverRun,
} from "./worker-criteria";
import { evaluateSpec } from "./worker-criteria-specs";

export async function evaluateWorker(pool: Pool, worker: WorkerRef): Promise<WorkerEvaluation> {
  const [spec, heartbeat, recentFailures24h, everRan] = await Promise.all([
    evaluateSpec(pool, worker),
    evaluateHeartbeatCriterion(pool, worker),
    loadRecentFailures(pool, worker.worker_id),
    hasEverRun(pool, worker.worker_id),
  ]);

  const partial: Omit<Record<CriteriaKey, CriterionResult>, "provable"> = {
    input:     spec.input,
    consumed:  spec.consumed,
    output:    spec.output,
    state:     spec.state,
    heartbeat,
  };
  const provable = await evaluateProvabilityCriterion(partial);
  const criteria: Record<CriteriaKey, CriterionResult> = { ...partial, provable };

  const { verdict, reason } = deriveVerdict(criteria, {
    hasEverRun: everRan,
    recentFailures24h,
    markedBlocked: Boolean(spec.markedBlocked),
    markedStandby: Boolean(spec.markedStandby),
  });

  return {
    ...worker,
    verdict,
    verdict_reason: reason,
    criteria,
    evaluated_at: new Date().toISOString(),
  };
}

export async function listAllWorkers(pool: Pool): Promise<WorkerRef[]> {
  // Union of registered heartbeats + scheduled workers · deduped by worker_id.
  const r = await pool.query(`
    SELECT worker_id, worker_type, worker_config FROM nex.worker_heartbeat
    UNION
    SELECT worker_id, worker_type, worker_config FROM nex.worker_schedule WHERE enabled = true
    ORDER BY worker_type, worker_id
  `);
  return r.rows as WorkerRef[];
}
