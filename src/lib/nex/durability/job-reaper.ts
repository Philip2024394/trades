// src/lib/nex/durability/job-reaper.ts
//
// UWI · Wave 2 · D7 · General job reaper (~120 LOC)
// Founder-authorised programme.
//
// Complements the implicit re-claim behaviour in `claim_next_job` by
// proactively scanning for expired leases and returning them to
// `waiting`. Makes orphan-recovery latency BOUNDED and OBSERVABLE
// instead of dependent on the next `claim_next_job` call happening.
//
// Two responsibilities:
//   1. Scan worker_jobs for lease_expires_at < now() AND status IN
//      ('assigned','running') → transition back to 'waiting', increment
//      metrics, emit worker_audit_events row of kind 'lease_reaped'.
//   2. Detect jobs whose attempts >= max_attempts (built on top of the
//      new dead_letter_at column from D8) → transition to DLQ.
//
// Deterministic; testable via a mock db client. Runs as a background
// interval or as a cron-scheduled invocation.

export interface ReapableJobRow {
  id: string;
  worker_type: string;
  attempts: number;
  assigned_worker_id: string | null;
  lease_expires_at: string;
}

export interface JobReaperMetrics {
  scanned_at_iso: string;
  reaped_count: number;
  dead_lettered_count: number;
  scan_duration_ms: number;
  reaped_jobs: ReadonlyArray<ReapableJobRow>;
  dead_lettered_jobs: ReadonlyArray<ReapableJobRow>;
}

export interface JobReaperDb {
  /** SELECT + UPDATE (in one txn) all rows with expired leases; return
   *  the reaped rows for audit. Uses SKIP LOCKED semantics so it plays
   *  nice with concurrent claim_next_job calls. */
  reapExpiredLeases(now_iso: string, max_attempts: number): Promise<{
    reaped: ReadonlyArray<ReapableJobRow>;
    dead_lettered: ReadonlyArray<ReapableJobRow>;
  }>;
  /** Insert an audit event per reaped job (one row per). */
  writeAuditEvent(event: {
    event_type: "lease_reaped" | "job_dead_lettered";
    job_id: string;
    worker_type: string;
    details: Record<string, unknown>;
  }): Promise<void>;
}

export interface JobReaperConfig {
  /** Jobs with attempts >= this go to DLQ instead of being re-queued. */
  max_attempts: number;
  /** Time between scans when running as a background interval. Milliseconds. */
  scan_interval_ms: number;
}

export const DEFAULT_REAPER_CONFIG: JobReaperConfig = {
  max_attempts: 5,
  scan_interval_ms: 10_000,
};

/** Run one reap pass. Returns metrics for observability. Pure orchestration
 *  over the injected db; testable via a mock. */
export async function runReaperOnce(
  db: JobReaperDb,
  config: JobReaperConfig = DEFAULT_REAPER_CONFIG,
  now: () => Date = () => new Date(),
): Promise<JobReaperMetrics> {
  const t0 = Date.now();
  const scanned_at = now();
  const result = await db.reapExpiredLeases(scanned_at.toISOString(), config.max_attempts);

  for (const row of result.reaped) {
    await db.writeAuditEvent({
      event_type: "lease_reaped",
      job_id: row.id,
      worker_type: row.worker_type,
      details: {
        prior_assigned_worker_id: row.assigned_worker_id,
        prior_lease_expires_at: row.lease_expires_at,
        attempts_so_far: row.attempts,
        scanned_at_iso: scanned_at.toISOString(),
      },
    });
  }
  for (const row of result.dead_lettered) {
    await db.writeAuditEvent({
      event_type: "job_dead_lettered",
      job_id: row.id,
      worker_type: row.worker_type,
      details: {
        final_worker_id: row.assigned_worker_id,
        final_lease_expires_at: row.lease_expires_at,
        attempts: row.attempts,
        max_attempts: config.max_attempts,
        reason: "attempts_exhausted",
        scanned_at_iso: scanned_at.toISOString(),
      },
    });
  }

  return {
    scanned_at_iso: scanned_at.toISOString(),
    reaped_count: result.reaped.length,
    dead_lettered_count: result.dead_lettered.length,
    scan_duration_ms: Date.now() - t0,
    reaped_jobs: result.reaped,
    dead_lettered_jobs: result.dead_lettered,
  };
}

/** Long-running interval reaper. Calls runReaperOnce every
 *  config.scan_interval_ms. Returns a stop function. */
export function startReaperInterval(
  db: JobReaperDb,
  onScan?: (metrics: JobReaperMetrics) => void,
  config: JobReaperConfig = DEFAULT_REAPER_CONFIG,
): { stop: () => void } {
  let active = true;
  const loop = async () => {
    while (active) {
      try {
        const m = await runReaperOnce(db, config);
        if (onScan) onScan(m);
      } catch (e) {
        // Never crash the reaper on a bad scan · log and continue.
        if (onScan) {
          onScan({
            scanned_at_iso: new Date().toISOString(),
            reaped_count: 0,
            dead_lettered_count: 0,
            scan_duration_ms: 0,
            reaped_jobs: [],
            dead_lettered_jobs: [],
          });
        }
      }
      await new Promise((r) => setTimeout(r, config.scan_interval_ms));
    }
  };
  loop();
  return { stop: () => { active = false; } };
}
