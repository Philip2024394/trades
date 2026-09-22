// src/lib/nex/harvest/queue.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Queue operations
// Founder-authorised programme · 2026-09-22.
//
// Every operation is a Postgres transaction. The row is the truth.
// Claim uses FOR UPDATE SKIP LOCKED so concurrent workers never collide.
// Heartbeat / complete / fail all check lease ownership by row lock ·
// wrong owner → lease_lost outcome (never mutates the wrong row).

import type { PoolClient } from "pg";
import type {
  HarvestJob, EnqueueJobInput, EnqueueOutcome,
  ClaimInput, HeartbeatOutcome, CompleteOutcome, FailOutcome,
} from "./types";

// ─── Row mapping ────────────────────────────────────────────────────
function rowToJob(r: any): HarvestJob {
  return {
    job_id: r.job_id,
    job_type: r.job_type,
    programme_id: r.programme_id ?? null,
    country_iso: r.country_iso ?? null,
    source_id: r.source_id ?? null,
    payload: r.payload,
    idempotency_key: r.idempotency_key,
    status: r.status,
    priority: Number(r.priority),
    attempts: Number(r.attempts),
    max_attempts: Number(r.max_attempts),
    next_attempt_at: r.next_attempt_at,
    lease_owner: r.lease_owner ?? null,
    lease_acquired_at: r.lease_acquired_at ?? null,
    lease_expires_at: r.lease_expires_at ?? null,
    heartbeat_at: r.heartbeat_at ?? null,
    last_error: r.last_error ?? null,
    last_error_at: r.last_error_at ?? null,
    dead_letter_reason: r.dead_letter_reason ?? null,
    dead_letter_at: r.dead_letter_at ?? null,
    completed_at: r.completed_at ?? null,
    parent_job_id: r.parent_job_id ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at,
  };
}

// ─── Backoff (deterministic exponential with jitter cap) ────────────
/** Returns milliseconds to wait before the next attempt. Bounded to avoid
 *  ridiculous futures. Same attempts always produces same range. */
export function backoffMs(attempts: number, base_ms: number = 30_000, cap_ms: number = 3_600_000): number {
  const raw = base_ms * Math.pow(2, Math.max(0, attempts - 1));
  return Math.min(cap_ms, raw);
}

// ─── Enqueue ────────────────────────────────────────────────────────
export async function enqueueJob(client: PoolClient, input: EnqueueJobInput): Promise<EnqueueOutcome> {
  const priority = input.priority ?? 100;
  const max_attempts = input.max_attempts ?? 5;
  const next_attempt_at = input.next_attempt_at ?? new Date().toISOString();
  const ins = await client.query<any>(
    `INSERT INTO nex.harvest_job
       (job_type, programme_id, country_iso, source_id, payload, idempotency_key,
        priority, max_attempts, next_attempt_at, parent_job_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, $10)
     ON CONFLICT (job_type, idempotency_key) DO NOTHING
     RETURNING *`,
    [
      input.job_type,
      input.programme_id ?? null,
      input.country_iso ?? null,
      input.source_id ?? null,
      JSON.stringify(input.payload ?? {}),
      input.idempotency_key,
      priority, max_attempts, next_attempt_at,
      input.parent_job_id ?? null,
    ],
  );
  if (ins.rowCount === 1) {
    return { kind: "enqueued", job: rowToJob(ins.rows[0]) };
  }
  const existing = await client.query<any>(
    `SELECT * FROM nex.harvest_job WHERE job_type = $1 AND idempotency_key = $2`,
    [input.job_type, input.idempotency_key],
  );
  return { kind: "duplicate", existing: rowToJob(existing.rows[0]) };
}

// ─── Claim (FOR UPDATE SKIP LOCKED) ─────────────────────────────────
export async function claimNextJob(client: PoolClient, input: ClaimInput): Promise<HarvestJob | null> {
  const now_fn = input.now ?? (() => new Date());
  const now = now_fn();
  const expires_at = new Date(now.getTime() + input.lease_seconds * 1000).toISOString();
  const now_iso = now.toISOString();

  // Build the WHERE clause dynamically for optional scopers
  const wheres: string[] = ["status = 'queued'", "next_attempt_at <= $2", "job_type = ANY($1)"];
  const params: any[] = [input.job_types, now_iso];
  if (input.programme_id) { params.push(input.programme_id); wheres.push(`programme_id = $${params.length}`); }
  if (input.country_iso)  { params.push(input.country_iso);  wheres.push(`country_iso = $${params.length}`); }

  // Two-step transaction · SELECT FOR UPDATE SKIP LOCKED, then UPDATE the same row
  const pick = await client.query<any>(
    `SELECT job_id FROM nex.harvest_job
      WHERE ${wheres.join(" AND ")}
      ORDER BY priority DESC, next_attempt_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED`,
    params,
  );
  if (pick.rowCount === 0) return null;
  const job_id = pick.rows[0].job_id;

  const upd = await client.query<any>(
    `UPDATE nex.harvest_job
        SET status = 'claimed',
            lease_owner = $2,
            lease_acquired_at = $3,
            lease_expires_at = $4,
            heartbeat_at = $3,
            attempts = attempts + 1
      WHERE job_id = $1
      RETURNING *`,
    [job_id, input.worker_id, now_iso, expires_at],
  );
  return rowToJob(upd.rows[0]);
}

// ─── Heartbeat (extends lease · rejects wrong owner) ────────────────
export async function heartbeatJob(
  client: PoolClient,
  input: { job_id: string; worker_id: string; lease_seconds: number; now?: () => Date },
): Promise<HeartbeatOutcome> {
  const now_fn = input.now ?? (() => new Date());
  const now = now_fn();
  const new_expiry = new Date(now.getTime() + input.lease_seconds * 1000).toISOString();
  const upd = await client.query<any>(
    `UPDATE nex.harvest_job
        SET heartbeat_at = $3,
            lease_expires_at = $4,
            status = CASE WHEN status = 'claimed' THEN 'processing' ELSE status END
      WHERE job_id = $1
        AND lease_owner = $2
        AND status IN ('claimed','processing')
      RETURNING lease_expires_at`,
    [input.job_id, input.worker_id, now.toISOString(), new_expiry],
  );
  if (upd.rowCount === 0) {
    return { kind: "lost", job_id: input.job_id, reason: "lease_not_owned_or_terminal" };
  }
  return { kind: "extended", job_id: input.job_id, new_lease_expires_at: upd.rows[0].lease_expires_at };
}

// ─── Complete ──────────────────────────────────────────────────────
export async function completeJob(
  client: PoolClient,
  input: { job_id: string; worker_id: string; now?: () => Date },
): Promise<CompleteOutcome> {
  const now = (input.now ?? (() => new Date()))().toISOString();
  const upd = await client.query<any>(
    `UPDATE nex.harvest_job
        SET status = 'completed',
            completed_at = $3,
            lease_owner = NULL,
            lease_acquired_at = NULL,
            lease_expires_at = NULL,
            heartbeat_at = $3
      WHERE job_id = $1
        AND lease_owner = $2
        AND status IN ('claimed','processing')
      RETURNING *`,
    [input.job_id, input.worker_id, now],
  );
  if (upd.rowCount === 0) return { kind: "lease_lost", reason: "wrong_owner_or_terminal_status" };
  return { kind: "completed", job: rowToJob(upd.rows[0]) };
}

// ─── Fail (retries within max_attempts · else dead_letter) ─────────
export async function failJob(
  client: PoolClient,
  input: { job_id: string; worker_id: string; error: string; retryable?: boolean; now?: () => Date },
): Promise<FailOutcome> {
  const now_fn = input.now ?? (() => new Date());
  const now = now_fn();
  const retryable = input.retryable !== false;

  // Fetch current attempts + max_attempts atomically
  const cur = await client.query<any>(
    `SELECT attempts, max_attempts FROM nex.harvest_job
      WHERE job_id = $1 AND lease_owner = $2 AND status IN ('claimed','processing')
      FOR UPDATE`,
    [input.job_id, input.worker_id],
  );
  if (cur.rowCount === 0) return { kind: "lease_lost", reason: "wrong_owner_or_terminal_status" };
  const attempts = Number(cur.rows[0].attempts);
  const max_attempts = Number(cur.rows[0].max_attempts);

  if (!retryable || attempts >= max_attempts) {
    // Dead letter (terminal)
    const upd = await client.query<any>(
      `UPDATE nex.harvest_job
          SET status = 'dead_letter',
              dead_letter_reason = $3,
              dead_letter_at = $4,
              lease_owner = NULL,
              lease_acquired_at = NULL,
              lease_expires_at = NULL,
              last_error = $3,
              last_error_at = $4
        WHERE job_id = $1 AND lease_owner = $2
        RETURNING *`,
      [input.job_id, input.worker_id, input.error, now.toISOString()],
    );
    return { kind: "dead_letter", job: rowToJob(upd.rows[0]), reason: input.error };
  }

  // Requeue with backoff
  const backoff = backoffMs(attempts);
  const next_attempt_at = new Date(now.getTime() + backoff).toISOString();
  const upd = await client.query<any>(
    `UPDATE nex.harvest_job
        SET status = 'queued',
            lease_owner = NULL,
            lease_acquired_at = NULL,
            lease_expires_at = NULL,
            last_error = $3,
            last_error_at = $4,
            next_attempt_at = $5
      WHERE job_id = $1 AND lease_owner = $2
      RETURNING *`,
    [input.job_id, input.worker_id, input.error, now.toISOString(), next_attempt_at],
  );
  return { kind: "requeued", job: rowToJob(upd.rows[0]), next_attempt_at };
}

// ─── Redrive · move dead_letter → queued (Founder intent) ──────────
export async function redriveJob(
  client: PoolClient,
  input: { job_id: string; reset_attempts?: boolean; now?: () => Date },
): Promise<HarvestJob | null> {
  const now = (input.now ?? (() => new Date()))().toISOString();
  const reset = input.reset_attempts !== false;
  const setAttempts = reset ? ", attempts = 0" : "";
  const upd = await client.query<any>(
    `UPDATE nex.harvest_job
        SET status = 'queued',
            dead_letter_reason = NULL,
            dead_letter_at = NULL,
            next_attempt_at = $2,
            last_error = NULL,
            last_error_at = NULL${setAttempts}
      WHERE job_id = $1 AND status = 'dead_letter'
      RETURNING *`,
    [input.job_id, now],
  );
  if (upd.rowCount === 0) return null;
  return rowToJob(upd.rows[0]);
}

// ─── Load (by id · for tests + observability) ──────────────────────
export async function loadJob(client: PoolClient, job_id: string): Promise<HarvestJob | null> {
  const r = await client.query<any>(`SELECT * FROM nex.harvest_job WHERE job_id = $1`, [job_id]);
  return r.rowCount === 0 ? null : rowToJob(r.rows[0]);
}

// ─── Aggregate counts (for HQ / SLA panel) ─────────────────────────
export async function loadQueueSummary(client: PoolClient): Promise<Record<string, number>> {
  const r = await client.query<{ status: string; n: number }>(
    `SELECT status, COUNT(*)::int AS n FROM nex.harvest_job GROUP BY status`,
  );
  const out: Record<string, number> = { queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 };
  for (const row of r.rows) out[row.status] = row.n;
  return out;
}
