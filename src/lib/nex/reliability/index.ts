// NEX Reliability · TypeScript helper for canonical heartbeat + cycle_run.
//
// Task #75 Bundle A · 2026-08-22 · disciplined counterpart to the
// existing scripts/nex-worker/reliability.mjs (which is Node ESM for
// standalone worker scripts). This TS module lets in-process Next.js
// workers (delivery · comms-social · image-intake) write to the
// canonical nex.worker_heartbeat + nex.worker_cycle_run tables without
// crossing ESM/CJS interop boundaries.
//
// Same SQL shape as reliability.mjs · same table columns · same
// canonical heartbeat table (post-Step-1c unification).
//
// Doctrine anchors:
//   · project_nex_one_hq_operational_reality_2026_08_22 (one worker registry)
//   · project_nex_hq_two_jobs_walker_and_teaching_2026_08_22 (Walker + Teaching + downstream operational visibility)
//   · project_nex_step1c_heartbeat_unification_shipped_2026_08_22 (canonical table)

import { randomUUID } from "node:crypto";

// Duck-typed pool/client accepting anything with .query() · works with
// pg.Pool AND our own PgClientLike wrapper.
export interface QueryRunner {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[]; rowCount?: number | null }>;
}

export type HeartbeatStatus =
  | "idle" | "running" | "waiting" | "standby" | "completed" | "failed" | "stopped";

export interface EmitHeartbeatOptions {
  workerId:       string;                                 // stable canonical id · e.g. "delivery:host-1234"
  workerType:     string;                                 // subsystem class · e.g. "delivery" | "social" | "intake"
  workerConfig?:  string | null;                          // sub-config · e.g. "comms" | "image" | "food:Yogyakarta"
  status:         HeartbeatStatus;                        // canonical 7-value vocabulary
  cycleRunId?:    string | null;                          // FK to worker_cycle_run.id if in-cycle
  metadata?:      Record<string, unknown>;                // free-form pid/hostname/mode/etc.
}

export async function emitHeartbeat(
  runner: QueryRunner,
  opts: EmitHeartbeatOptions,
): Promise<void> {
  await runner.query(
    `INSERT INTO nex.worker_heartbeat
       (worker_id, worker_type, worker_config, last_heartbeat_at, last_status, last_cycle_run_id, metadata, updated_at)
     VALUES ($1, $2, $3, now(), $4, $5, $6::jsonb, now())
     ON CONFLICT (worker_id) DO UPDATE SET
       worker_type       = EXCLUDED.worker_type,
       worker_config     = EXCLUDED.worker_config,
       last_heartbeat_at = EXCLUDED.last_heartbeat_at,
       last_status       = EXCLUDED.last_status,
       last_cycle_run_id = EXCLUDED.last_cycle_run_id,
       metadata          = EXCLUDED.metadata,
       updated_at        = now()`,
    [
      opts.workerId, opts.workerType, opts.workerConfig ?? null, opts.status,
      opts.cycleRunId ?? null, JSON.stringify(opts.metadata ?? {}),
    ],
  );
}

export interface StartCycleRunOptions {
  workerId:        string;
  workerType:      string;
  workerConfig?:   string | null;
  jobIdExternal?:  string | null;
}

export async function startCycleRun(
  runner: QueryRunner,
  opts: StartCycleRunOptions,
): Promise<string> {
  const id = randomUUID();
  await runner.query(
    `INSERT INTO nex.worker_cycle_run
       (id, worker_id, worker_type, worker_config, job_id_external, started_at, status)
     VALUES ($1, $2, $3, $4, $5, now(), 'running')`,
    [id, opts.workerId, opts.workerType, opts.workerConfig ?? null, opts.jobIdExternal ?? null],
  );
  return id;
}

export interface FinishCycleRunOptions {
  status:              "completed" | "failed" | "aborted";
  recordsProcessed?:   number | null;
  recordsNew?:         number | null;
  recordsRejected?:    number | null;
  errorsCount?:        number | null;
  summary?:            Record<string, unknown> | null;
  auditReportPath?:    string | null;
  doctrineChecks?:     Record<string, unknown> | null;
}

export async function finishCycleRun(
  runner: QueryRunner,
  cycleRunId: string,
  opts: FinishCycleRunOptions,
): Promise<void> {
  await runner.query(
    `UPDATE nex.worker_cycle_run
        SET finished_at       = now(),
            duration_ms       = EXTRACT(EPOCH FROM (now() - started_at))::int * 1000,
            status            = $2,
            records_processed = $3,
            records_new       = $4,
            records_rejected  = $5,
            errors_count      = $6,
            summary           = COALESCE($7::jsonb, summary),
            audit_report_path = COALESCE($8, audit_report_path),
            doctrine_checks   = COALESCE($9::jsonb, doctrine_checks)
      WHERE id = $1`,
    [
      cycleRunId, opts.status,
      opts.recordsProcessed ?? 0, opts.recordsNew ?? 0,
      opts.recordsRejected ?? 0, opts.errorsCount ?? 0,
      opts.summary ? JSON.stringify(opts.summary) : null,
      opts.auditReportPath ?? null,
      opts.doctrineChecks ? JSON.stringify(opts.doctrineChecks) : null,
    ],
  );
}
