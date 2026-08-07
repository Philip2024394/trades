// NEX Delivery Engine · durable queue with SKIP LOCKED lease
//
// Workers claim jobs with SELECT ... FOR UPDATE SKIP LOCKED and set
// a lease_expires_at TTL. If a worker crashes without releasing, the
// lease expires and the job becomes reclaimable — this is the
// resumable-after-restart guarantee from the doctrine.

import { withClient } from "./db";
import type { DeliveryJob, JobStatus, JobType } from "./types";

const DEFAULT_LEASE_MS = 5 * 60 * 1000;                // 5 min lease per lease acquisition

function rowToJob(r: Record<string, unknown>): DeliveryJob {
  return {
    job_id: String(r.job_id),
    job_type: r.job_type as JobType,
    status: r.status as JobStatus,
    priority: Number(r.priority),
    scheduled_for: String(r.scheduled_for),
    campaign_id: (r.campaign_id as string | null) ?? null,
    payload: (r.payload as Record<string, unknown>) ?? {},
    result: (r.result as Record<string, unknown> | null) ?? null,
    attempts: Number(r.attempts),
    max_attempts: Number(r.max_attempts),
    lease_owner: (r.lease_owner as string | null) ?? null,
    lease_expires_at: (r.lease_expires_at as string | null) ?? null,
    created_at: String(r.created_at),
    updated_at: String(r.updated_at),
    started_at: (r.started_at as string | null) ?? null,
    completed_at: (r.completed_at as string | null) ?? null,
    last_error: (r.last_error as string | null) ?? null,
  };
}

export async function enqueueJob(input: {
  job_type: JobType;
  campaign_id?: string | null;
  scheduled_for?: string;
  priority?: number;
  payload?: Record<string, unknown>;
  max_attempts?: number;
}): Promise<DeliveryJob | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `INSERT INTO nex.delivery_jobs (job_type, campaign_id, scheduled_for, priority, payload, max_attempts)
       VALUES ($1, $2, COALESCE($3::timestamptz, NOW()), $4, $5::jsonb, $6)
       RETURNING *`,
      [input.job_type, input.campaign_id ?? null, input.scheduled_for ?? null, input.priority ?? 100, JSON.stringify(input.payload ?? {}), input.max_attempts ?? 5],
    );
    return res.rows[0] ? rowToJob(res.rows[0]) : null;
  });
  return r;
}

/**
 * Lease the next runnable job (if any). Uses SKIP LOCKED so two
 * concurrent workers never claim the same row. Reclaims expired
 * leases from crashed workers by including them in the eligibility
 * clause.
 */
export async function leaseNextJob(worker_id: string): Promise<DeliveryJob | null> {
  const r = await withClient(async (c) => {
    // Single-statement CTE update: pick pending or lease-expired job, mark running.
    const res = await c.query(
      `WITH cte AS (
         SELECT job_id
         FROM nex.delivery_jobs
         WHERE (status = 'pending' AND scheduled_for <= NOW())
            OR (status = 'running' AND (lease_expires_at IS NULL OR lease_expires_at < NOW()))
         ORDER BY priority ASC, scheduled_for ASC
         LIMIT 1
         FOR UPDATE SKIP LOCKED
       )
       UPDATE nex.delivery_jobs j
       SET status = 'running',
           attempts = j.attempts + 1,
           started_at = COALESCE(j.started_at, NOW()),
           lease_owner = $1,
           lease_expires_at = NOW() + INTERVAL '${DEFAULT_LEASE_MS} milliseconds',
           updated_at = NOW()
       FROM cte
       WHERE j.job_id = cte.job_id
       RETURNING j.*`,
      [worker_id],
    );
    return res.rows[0] ? rowToJob(res.rows[0]) : null;
  });
  return r;
}

export async function heartbeatJob(job_id: string, worker_id: string): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.delivery_jobs SET lease_expires_at = NOW() + INTERVAL '${DEFAULT_LEASE_MS} milliseconds', updated_at = NOW() WHERE job_id = $1 AND lease_owner = $2`,
      [job_id, worker_id],
    );
    return null;
  });
}

export async function completeJob(job_id: string, result: Record<string, unknown> = {}): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `UPDATE nex.delivery_jobs SET status = 'completed', completed_at = NOW(), result = $1::jsonb, lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW(), last_error = NULL WHERE job_id = $2`,
      [JSON.stringify(result), job_id],
    );
    return null;
  });
}

/**
 * Fail a job. If attempts < max_attempts, requeue with backoff.
 * If attempts >= max_attempts, move to dead_letter.
 * `permanent` = true forces dead_letter regardless of attempts.
 */
export async function failJob(job_id: string, error: string, opts: { permanent?: boolean; backoffMs: number }): Promise<void> {
  await withClient(async (c) => {
    if (opts.permanent) {
      await c.query(
        `UPDATE nex.delivery_jobs SET status = 'dead_letter', last_error = $1, completed_at = NOW(), lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW() WHERE job_id = $2`,
        [error.slice(0, 4000), job_id],
      );
      return null;
    }
    await c.query(
      `UPDATE nex.delivery_jobs
       SET status = CASE
                       WHEN attempts >= max_attempts THEN 'dead_letter'
                       ELSE 'pending'
                    END,
           scheduled_for = CASE
                              WHEN attempts >= max_attempts THEN scheduled_for
                              ELSE NOW() + INTERVAL '${Math.max(1000, opts.backoffMs)} milliseconds'
                           END,
           last_error = $1,
           lease_owner = NULL,
           lease_expires_at = NULL,
           updated_at = NOW()
       WHERE job_id = $2`,
      [error.slice(0, 4000), job_id],
    );
    return null;
  });
}

export async function cancelJobsForCampaign(campaign_id: string): Promise<number> {
  const r = await withClient(async (c) => {
    const res = await c.query(
      `UPDATE nex.delivery_jobs SET status = 'cancelled', lease_owner = NULL, lease_expires_at = NULL, updated_at = NOW() WHERE campaign_id = $1 AND status IN ('pending','running') RETURNING job_id`,
      [campaign_id],
    );
    return res.rowCount ?? 0;
  });
  return r ?? 0;
}

// ── Attempts logging ──────────────────────────────────────────────
export async function recordAttempt(input: {
  job_id: string; attempt_no: number; worker_id: string;
  outcome: import("./types").AttemptOutcome; latency_ms: number;
  error?: string | null; detail?: Record<string, unknown>;
}): Promise<void> {
  await withClient(async (c) => {
    await c.query(
      `INSERT INTO nex.delivery_job_attempts (job_id, attempt_no, worker_id, completed_at, outcome, latency_ms, error, detail)
       VALUES ($1, $2, $3, NOW(), $4, $5, $6, $7::jsonb)`,
      [input.job_id, input.attempt_no, input.worker_id, input.outcome, input.latency_ms, input.error ?? null, JSON.stringify(input.detail ?? {})],
    );
    return null;
  });
}

// ── List / read helpers ───────────────────────────────────────────
export async function listJobs(opts?: { status?: JobStatus; campaign_id?: string; limit?: number }): Promise<DeliveryJob[]> {
  const r = await withClient(async (c) => {
    const wheres: string[] = ["TRUE"];
    const params: unknown[] = [];
    if (opts?.status)      { params.push(opts.status);      wheres.push(`status = $${params.length}`); }
    if (opts?.campaign_id) { params.push(opts.campaign_id); wheres.push(`campaign_id = $${params.length}`); }
    const limit = Math.max(1, Math.min(500, opts?.limit ?? 100));
    const res = await c.query(`SELECT * FROM nex.delivery_jobs WHERE ${wheres.join(" AND ")} ORDER BY scheduled_for DESC LIMIT ${limit}`, params);
    return res.rows.map(rowToJob);
  });
  return r ?? [];
}

export async function getJob(job_id: string): Promise<DeliveryJob | null> {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.delivery_jobs WHERE job_id = $1`, [job_id]);
    return res.rows[0] ? rowToJob(res.rows[0]) : null;
  });
  return r ?? null;
}

export async function getAttemptsForJob(job_id: string) {
  const r = await withClient(async (c) => {
    const res = await c.query(`SELECT * FROM nex.delivery_job_attempts WHERE job_id = $1 ORDER BY attempt_no DESC`, [job_id]);
    return res.rows;
  });
  return r ?? [];
}
