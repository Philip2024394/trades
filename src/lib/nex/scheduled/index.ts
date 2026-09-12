// src/lib/nex/scheduled/index.ts
//
// Founder Phase 18 · Scheduled agent registry + executor.
//
// Design:
//   · Handlers are pure functions keyed by string name · registered at
//     module load time so restarts pick them up automatically.
//   · Cadence is a simple interval spec ("60s","5m","1h","daily") · not
//     full crontab · deliberately simple so the founder can reason about it.
//   · Every run records a scheduled_job_run row · immutable audit.
//   · The tick endpoint is idempotent · re-hitting it within cadence is a
//     no-op · protects against thundering herd.

import { getKnowledgeFactoryDbPool } from "@/lib/nex/live-chat-completion/kf-pool";

// ═══════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════

export type ScheduledCadence = string;     // "60s" | "5m" | "1h" | "daily"

export interface ScheduledJobRow {
  job_id: string;
  name: string;
  handler: string;
  cadence: ScheduledCadence;
  active: boolean;
  meta: Record<string, unknown> | null;
  created_at: string;
  last_run_at: string | null;
  next_due_at: string;
  run_count: string;
  fail_count: string;
}

export interface ScheduledJobRunRow {
  run_id: string;
  job_id: string;
  started_at: string;
  finished_at: string | null;
  ok: boolean | null;
  error: string | null;
  duration_ms: number | null;
  result_summary: Record<string, unknown> | null;
  triggered_by: "tick" | "run-now" | "boot";
}

export type ScheduledHandler = (ctx: { job: ScheduledJobRow }) => Promise<{ ok: boolean; result_summary?: Record<string, unknown>; error?: string }>;

// ═══════════════════════════════════════════════════════════════════
// Handler registry · in-memory · registered at import time
// ═══════════════════════════════════════════════════════════════════

const handlers = new Map<string, ScheduledHandler>();

export function registerHandler(name: string, fn: ScheduledHandler): void {
  handlers.set(name, fn);
}

export function getHandler(name: string): ScheduledHandler | null {
  return handlers.get(name) ?? null;
}

export function listRegisteredHandlers(): string[] {
  return [...handlers.keys()].sort();
}

// ═══════════════════════════════════════════════════════════════════
// Cadence parser · deterministic
// ═══════════════════════════════════════════════════════════════════

export function parseCadenceMs(c: ScheduledCadence): number {
  const m = /^(\d+)(s|m|h|d)$/.exec(c.trim());
  if (m) {
    const n = Number(m[1]);
    const mult = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as "s" | "m" | "h" | "d"];
    return n * mult;
  }
  if (c.trim() === "daily") return 86_400_000;
  if (c.trim() === "hourly") return 3_600_000;
  if (c.trim() === "minutely") return 60_000;
  return 60_000;                             // safe default: 1 minute
}

// ═══════════════════════════════════════════════════════════════════
// Job registry (DB side)
// ═══════════════════════════════════════════════════════════════════

export async function upsertJob(args: {
  name: string;
  handler: string;
  cadence: ScheduledCadence;
  meta?: Record<string, unknown>;
  active?: boolean;
}): Promise<ScheduledJobRow> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `INSERT INTO nex.scheduled_job (name, handler, cadence, meta, active, next_due_at)
     VALUES ($1,$2,$3,$4,$5, now())
     ON CONFLICT (name) DO UPDATE SET
       handler = EXCLUDED.handler,
       cadence = EXCLUDED.cadence,
       meta    = EXCLUDED.meta,
       active  = EXCLUDED.active
     RETURNING job_id::text, name, handler, cadence, active, meta,
               created_at::text, last_run_at::text, next_due_at::text,
               run_count::text, fail_count::text`,
    [args.name, args.handler, args.cadence, args.meta ? JSON.stringify(args.meta) : null, args.active ?? true],
  );
  return r.rows[0] as unknown as ScheduledJobRow;
}

export async function listJobs(): Promise<ScheduledJobRow[]> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT job_id::text, name, handler, cadence, active, meta,
            created_at::text, last_run_at::text, next_due_at::text,
            run_count::text, fail_count::text
       FROM nex.scheduled_job
      ORDER BY next_due_at ASC`,
  );
  return r.rows as unknown as ScheduledJobRow[];
}

export async function findJobByName(name: string): Promise<ScheduledJobRow | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT job_id::text, name, handler, cadence, active, meta,
            created_at::text, last_run_at::text, next_due_at::text,
            run_count::text, fail_count::text
       FROM nex.scheduled_job WHERE name = $1`,
    [name],
  );
  return (r.rows[0] as unknown as ScheduledJobRow) ?? null;
}

export async function findJobById(job_id: string): Promise<ScheduledJobRow | null> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT job_id::text, name, handler, cadence, active, meta,
            created_at::text, last_run_at::text, next_due_at::text,
            run_count::text, fail_count::text
       FROM nex.scheduled_job WHERE job_id = $1`,
    [job_id],
  );
  return (r.rows[0] as unknown as ScheduledJobRow) ?? null;
}

// ═══════════════════════════════════════════════════════════════════
// Execution
// ═══════════════════════════════════════════════════════════════════

async function claimJobForExecution(job_id: string, triggered_by: "tick" | "run-now" | "boot"): Promise<{ run_id: string; job: ScheduledJobRow } | null> {
  const pool = getKnowledgeFactoryDbPool();
  // Atomic claim: only if now() >= next_due_at (for tick) OR unconditionally (run-now).
  const claimSql = triggered_by === "tick"
    ? `UPDATE nex.scheduled_job
          SET last_run_at = now()
        WHERE job_id = $1 AND active = TRUE AND next_due_at <= now()
        RETURNING job_id::text, name, handler, cadence, active, meta,
                  created_at::text, last_run_at::text, next_due_at::text,
                  run_count::text, fail_count::text`
    : `UPDATE nex.scheduled_job
          SET last_run_at = now()
        WHERE job_id = $1 AND active = TRUE
        RETURNING job_id::text, name, handler, cadence, active, meta,
                  created_at::text, last_run_at::text, next_due_at::text,
                  run_count::text, fail_count::text`;
  const claim = await pool.query(claimSql, [job_id]);
  const job = claim.rows[0] as unknown as ScheduledJobRow | undefined;
  if (!job) return null;
  const runR = await pool.query(
    `INSERT INTO nex.scheduled_job_run (job_id, triggered_by) VALUES ($1,$2) RETURNING run_id::text`,
    [job_id, triggered_by],
  );
  return { run_id: (runR.rows[0] as { run_id: string }).run_id, job };
}

async function completeRun(args: {
  job_id: string;
  run_id: string;
  started_ms: number;
  ok: boolean;
  error?: string;
  result_summary?: Record<string, unknown>;
  cadence: ScheduledCadence;
}): Promise<void> {
  const pool = getKnowledgeFactoryDbPool();
  const duration_ms = Math.round(performance.now() - args.started_ms);
  await pool.query(
    `UPDATE nex.scheduled_job_run
        SET finished_at = now(), ok = $2, error = $3, duration_ms = $4, result_summary = $5
      WHERE run_id = $1`,
    [args.run_id, args.ok, args.error ?? null, duration_ms, args.result_summary ? JSON.stringify(args.result_summary) : null],
  );
  const nextMs = parseCadenceMs(args.cadence);
  await pool.query(
    `UPDATE nex.scheduled_job
        SET run_count  = run_count + 1,
            fail_count = fail_count + (CASE WHEN $2 THEN 0 ELSE 1 END),
            next_due_at = now() + ($3 || ' milliseconds')::interval
      WHERE job_id = $1`,
    [args.job_id, args.ok, String(nextMs)],
  );
}

export async function executeJob(job_id: string, triggered_by: "tick" | "run-now" | "boot" = "tick"): Promise<{
  ran: boolean;
  ok?: boolean;
  error?: string;
  duration_ms?: number;
  run_id?: string;
  result_summary?: Record<string, unknown>;
}> {
  const claim = await claimJobForExecution(job_id, triggered_by);
  if (!claim) return { ran: false };
  const { job, run_id } = claim;
  const started_ms = performance.now();
  const handler = getHandler(job.handler);
  if (!handler) {
    await completeRun({
      job_id, run_id, started_ms, ok: false,
      error: `handler_not_registered:${job.handler}`,
      cadence: job.cadence,
    });
    return { ran: true, ok: false, error: `handler_not_registered:${job.handler}`, run_id, duration_ms: Math.round(performance.now() - started_ms) };
  }
  try {
    const out = await handler({ job });
    await completeRun({
      job_id, run_id, started_ms,
      ok: out.ok, error: out.error, result_summary: out.result_summary,
      cadence: job.cadence,
    });
    return { ran: true, ok: out.ok, error: out.error, result_summary: out.result_summary, run_id, duration_ms: Math.round(performance.now() - started_ms) };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    await completeRun({ job_id, run_id, started_ms, ok: false, error: `handler_error:${msg}`, cadence: job.cadence });
    return { ran: true, ok: false, error: `handler_error:${msg}`, run_id, duration_ms: Math.round(performance.now() - started_ms) };
  }
}

/**
 * Ticks every active job whose next_due_at <= now().
 * Returns a summary of what ran. Safe to call every minute.
 */
export async function tick(): Promise<{
  now: string;
  ran_count: number;
  skipped_count: number;
  runs: Array<{ name: string; ok: boolean; error?: string; duration_ms: number }>;
}> {
  const pool = getKnowledgeFactoryDbPool();
  const dueR = await pool.query(
    `SELECT job_id::text, name FROM nex.scheduled_job
      WHERE active = TRUE AND next_due_at <= now()
      ORDER BY next_due_at ASC`,
  );
  const rows = dueR.rows as Array<{ job_id: string; name: string }>;
  const runs: Array<{ name: string; ok: boolean; error?: string; duration_ms: number }> = [];
  let skipped = 0;
  for (const r of rows) {
    const out = await executeJob(r.job_id, "tick");
    if (!out.ran) { skipped += 1; continue; }
    runs.push({ name: r.name, ok: out.ok ?? false, error: out.error, duration_ms: out.duration_ms ?? 0 });
  }
  return {
    now: new Date().toISOString(),
    ran_count: runs.length,
    skipped_count: skipped,
    runs,
  };
}

export async function listRuns(job_id: string, limit = 20): Promise<ScheduledJobRunRow[]> {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT run_id::text, job_id::text, started_at::text, finished_at::text,
            ok, error, duration_ms, result_summary, triggered_by
       FROM nex.scheduled_job_run
      WHERE job_id = $1
      ORDER BY started_at DESC
      LIMIT $2`,
    [job_id, Math.max(1, Math.min(500, limit))],
  );
  return r.rows as unknown as ScheduledJobRunRow[];
}

// ═══════════════════════════════════════════════════════════════════
// Built-in handlers
// ═══════════════════════════════════════════════════════════════════

// observatory-refresh · snapshots table counts across nex.* into result_summary.
registerHandler("observatory-refresh", async () => {
  const pool = getKnowledgeFactoryDbPool();
  const r = await pool.query(
    `SELECT
       (SELECT count(*) FROM nex.conversation)              AS conversations,
       (SELECT count(*) FROM nex.conversation_message)      AS messages,
       (SELECT count(*) FROM nex.api_key WHERE revoked_at IS NULL) AS active_keys,
       (SELECT count(*) FROM nex.team WHERE deleted_at IS NULL)    AS teams,
       (SELECT count(*) FROM nex.audit_event)               AS audit_events,
       (SELECT count(*) FROM nex.file_extraction)           AS file_extractions,
       (SELECT count(*) FROM nex.voice_transcript)          AS voice_transcripts`,
  );
  const row = r.rows[0] as Record<string, string | number> | undefined;
  return {
    ok: true,
    result_summary: {
      snapshotted_at: new Date().toISOString(),
      counts: row ?? {},
    },
  };
});

// heartbeat · trivial no-op used to prove the tick loop works.
registerHandler("heartbeat", async () => ({
  ok: true,
  result_summary: { pong: new Date().toISOString() },
}));
