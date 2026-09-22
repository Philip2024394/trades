// src/lib/nex/harvest/reaper.ts
//
// NEX 24/7 World Harvest Engine · Wave H1 · Reaper
// Founder-authorised programme · 2026-09-22.
//
// Deterministic self-recovery. Runs on a cadence (in Wave H5 · the controller).
// Idempotent · running twice in the same second has the same effect as once.
//
// STEPS:
//   1. Any harvest_worker.expected_expiry_at < now → mark 'expired'
//   2. Any harvest_job with lease_expires_at < now AND status IN ('claimed','processing')
//      → release lease · attempts stays (already incremented at claim) ·
//        if attempts >= max_attempts → move to dead_letter · else back to queued
//        with a backoff.

import type { PoolClient } from "pg";
import type { ReaperOutcome } from "./types";
import { backoffMs } from "./queue";

export async function runHarvestReaper(
  client: PoolClient,
  input: { now?: () => Date } = {},
): Promise<ReaperOutcome> {
  const now = (input.now ?? (() => new Date()))();
  const now_iso = now.toISOString();

  // 1 · Mark expired workers
  const workers = await client.query<{ worker_id: string }>(
    `UPDATE nex.harvest_worker
        SET status = 'expired'
      WHERE status = 'alive'
        AND expected_expiry_at < $1
      RETURNING worker_id`,
    [now_iso],
  );

  // 2 · Find jobs whose lease has expired
  const expired = await client.query<{ job_id: string; attempts: number; max_attempts: number }>(
    `SELECT job_id, attempts, max_attempts
       FROM nex.harvest_job
      WHERE lease_owner IS NOT NULL
        AND lease_expires_at IS NOT NULL
        AND lease_expires_at < $1
        AND status IN ('claimed', 'processing')
      FOR UPDATE SKIP LOCKED`,
    [now_iso],
  );

  let released = 0;
  let dead_lettered = 0;
  for (const row of expired.rows) {
    const attempts = Number(row.attempts);
    const max_attempts = Number(row.max_attempts);
    if (attempts >= max_attempts) {
      await client.query(
        `UPDATE nex.harvest_job
            SET status = 'dead_letter',
                dead_letter_reason = 'lease_expired_max_attempts_reached',
                dead_letter_at = $2,
                lease_owner = NULL,
                lease_acquired_at = NULL,
                lease_expires_at = NULL
          WHERE job_id = $1`,
        [row.job_id, now_iso],
      );
      dead_lettered++;
    } else {
      const next_attempt = new Date(now.getTime() + backoffMs(attempts)).toISOString();
      await client.query(
        `UPDATE nex.harvest_job
            SET status = 'queued',
                lease_owner = NULL,
                lease_acquired_at = NULL,
                lease_expires_at = NULL,
                last_error = 'lease_expired_reaped',
                last_error_at = $2,
                next_attempt_at = $3
          WHERE job_id = $1`,
        [row.job_id, now_iso, next_attempt],
      );
      released++;
    }
  }

  return {
    expired_leases_released: released,
    moved_to_dead_letter: dead_lettered,
    workers_marked_expired: workers.rowCount ?? 0,
    ran_at: now_iso,
  };
}
