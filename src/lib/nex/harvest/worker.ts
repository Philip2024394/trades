// src/lib/nex/harvest/worker.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Worker lifecycle
// Founder-authorised programme · 2026-09-22.

import type { PoolClient } from "pg";
import type { WorkerHeartbeat } from "./types";

function rowToWorker(r: any): WorkerHeartbeat {
  return {
    worker_id: r.worker_id,
    host_identifier: r.host_identifier ?? null,
    job_type_scope: r.job_type_scope ?? [],
    status: r.status,
    started_at: r.started_at,
    last_heartbeat_at: r.last_heartbeat_at,
    heartbeat_interval_seconds: Number(r.heartbeat_interval_seconds),
    expected_expiry_at: r.expected_expiry_at,
    jobs_claimed: Number(r.jobs_claimed),
    jobs_completed: Number(r.jobs_completed),
    jobs_failed: Number(r.jobs_failed),
  };
}

export interface RegisterWorkerInput {
  readonly worker_id: string;
  readonly host_identifier?: string;
  readonly job_type_scope: readonly string[];
  readonly heartbeat_interval_seconds?: number;
  readonly now?: () => Date;
}

/** Register a worker · upsert · idempotent by worker_id. */
export async function registerWorker(client: PoolClient, input: RegisterWorkerInput): Promise<WorkerHeartbeat> {
  const now = (input.now ?? (() => new Date()))();
  const interval = input.heartbeat_interval_seconds ?? 30;
  const expiry = new Date(now.getTime() + interval * 4 * 1000).toISOString(); // 4× interval grace
  const upd = await client.query<any>(
    `INSERT INTO nex.harvest_worker
       (worker_id, host_identifier, job_type_scope, status,
        started_at, last_heartbeat_at, heartbeat_interval_seconds, expected_expiry_at)
     VALUES ($1, $2, $3, 'alive', $4, $4, $5, $6)
     ON CONFLICT (worker_id) DO UPDATE SET
       host_identifier = EXCLUDED.host_identifier,
       job_type_scope = EXCLUDED.job_type_scope,
       status = 'alive',
       started_at = EXCLUDED.started_at,
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       heartbeat_interval_seconds = EXCLUDED.heartbeat_interval_seconds,
       expected_expiry_at = EXCLUDED.expected_expiry_at
     RETURNING *`,
    [input.worker_id, input.host_identifier ?? null, input.job_type_scope, now.toISOString(), interval, expiry],
  );
  return rowToWorker(upd.rows[0]);
}

/** Worker heartbeat · extends expected_expiry_at deterministically. */
export async function workerHeartbeat(
  client: PoolClient,
  input: { worker_id: string; now?: () => Date },
): Promise<WorkerHeartbeat | null> {
  const now = (input.now ?? (() => new Date()))();
  const upd = await client.query<any>(
    `UPDATE nex.harvest_worker
        SET last_heartbeat_at = $2,
            expected_expiry_at = ($2::timestamptz + (heartbeat_interval_seconds * 4 || ' seconds')::interval),
            status = CASE WHEN status = 'drained' THEN 'drained' ELSE 'alive' END
      WHERE worker_id = $1
      RETURNING *`,
    [input.worker_id, now.toISOString()],
  );
  if (upd.rowCount === 0) return null;
  return rowToWorker(upd.rows[0]);
}

/** Drain a worker · signals graceful shutdown. Existing leases remain until
 *  their natural expiry OR the worker completes them normally. */
export async function drainWorker(client: PoolClient, worker_id: string): Promise<WorkerHeartbeat | null> {
  const upd = await client.query<any>(
    `UPDATE nex.harvest_worker
        SET status = 'drained'
      WHERE worker_id = $1
      RETURNING *`,
    [worker_id],
  );
  if (upd.rowCount === 0) return null;
  return rowToWorker(upd.rows[0]);
}

/** Increment counters for observability. */
export async function bumpWorkerCounters(
  client: PoolClient,
  input: { worker_id: string; claimed?: number; completed?: number; failed?: number },
): Promise<void> {
  await client.query(
    `UPDATE nex.harvest_worker
        SET jobs_claimed   = jobs_claimed   + COALESCE($2, 0),
            jobs_completed = jobs_completed + COALESCE($3, 0),
            jobs_failed    = jobs_failed    + COALESCE($4, 0)
      WHERE worker_id = $1`,
    [input.worker_id, input.claimed ?? 0, input.completed ?? 0, input.failed ?? 0],
  );
}

/** Load current worker snapshot. */
export async function loadWorker(client: PoolClient, worker_id: string): Promise<WorkerHeartbeat | null> {
  const r = await client.query<any>(`SELECT * FROM nex.harvest_worker WHERE worker_id = $1`, [worker_id]);
  return r.rowCount === 0 ? null : rowToWorker(r.rows[0]);
}

/** Load all workers (for HQ + reaper). */
export async function loadWorkers(client: PoolClient): Promise<readonly WorkerHeartbeat[]> {
  const r = await client.query<any>(`SELECT * FROM nex.harvest_worker ORDER BY status, worker_id`);
  return r.rows.map(rowToWorker);
}
