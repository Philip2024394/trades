// GET /api/nex/delivery/metrics — Mission Control aggregates for the Delivery Engine
import { NextResponse } from "next/server";
import { withClient } from "@/lib/nex/delivery/db";
import { activeProvider, currentMode, registeredProviders } from "@/lib/nex/delivery/providers";
import { limiterConfig, limiterSnapshot } from "@/lib/nex/delivery/limiter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const provider = activeProvider();

  const r = await withClient(async (c) => {
    const byStatus = await c.query(`SELECT status, COUNT(*)::int AS n FROM nex.delivery_jobs GROUP BY status`);
    // Task #75 Bundle A (2026-08-22): redirected from dropped nex.delivery_workers
    // to canonical nex.worker_heartbeat. Column mapping: worker_id → same,
    // hostname/mode → metadata jsonb, started_at → created_at, last_seen_at → last_heartbeat_at.
    // jobs_processed/jobs_failed migrated to derived counts from nex.worker_cycle_run.
    const workers = await c.query(
      `SELECT
         h.worker_id,
         (h.metadata->>'hostname')::text                            AS hostname,
         h.created_at                                                AS started_at,
         h.last_heartbeat_at                                         AS last_seen_at,
         COALESCE((SELECT SUM(records_processed)::int FROM nex.worker_cycle_run
                   WHERE worker_id = h.worker_id AND status = 'completed'), 0) AS jobs_processed,
         COALESCE((SELECT COUNT(*)::int FROM nex.worker_cycle_run
                   WHERE worker_id = h.worker_id AND status = 'failed'), 0)    AS jobs_failed,
         COALESCE(h.worker_config, 'unknown')                        AS mode,
         EXTRACT(EPOCH FROM (NOW() - h.last_heartbeat_at))::int      AS seconds_since_seen
       FROM nex.worker_heartbeat h
      WHERE h.worker_type = 'delivery'
      ORDER BY h.last_heartbeat_at DESC LIMIT 25`);
    const deadLetter = await c.query(`SELECT job_id, job_type, campaign_id, last_error, updated_at FROM nex.delivery_jobs WHERE status = 'dead_letter' ORDER BY updated_at DESC LIMIT 20`);
    const throughput = await c.query(`SELECT COUNT(*)::int AS n FROM nex.delivery_job_attempts WHERE completed_at > NOW() - INTERVAL '1 hour' AND outcome = 'success'`);
    const errorsHour = await c.query(`SELECT COUNT(*)::int AS n FROM nex.delivery_job_attempts WHERE completed_at > NOW() - INTERVAL '1 hour' AND outcome IN ('transient_failure','permanent_failure')`);
    const recentByType = await c.query(`SELECT job_type, COUNT(*)::int AS n FROM nex.delivery_jobs WHERE updated_at > NOW() - INTERVAL '24 hours' GROUP BY job_type`);
    const nextRun = await c.query(`SELECT MIN(scheduled_for) AS next FROM nex.delivery_jobs WHERE status = 'pending'`);

    const by_status: Record<string, number> = {};
    for (const row of byStatus.rows) by_status[String(row.status)] = Number(row.n);

    const recent_by_type: Record<string, number> = {};
    for (const row of recentByType.rows) recent_by_type[String(row.job_type)] = Number(row.n);

    return {
      by_status,
      workers: workers.rows.map((w) => ({
        worker_id: String(w.worker_id), hostname: (w.hostname as string | null) ?? null,
        started_at: String(w.started_at), last_seen_at: String(w.last_seen_at),
        jobs_processed: Number(w.jobs_processed), jobs_failed: Number(w.jobs_failed),
        mode: String(w.mode), seconds_since_seen: Number(w.seconds_since_seen ?? 0),
        alive: Number(w.seconds_since_seen ?? 999) < 120,
      })),
      dead_letter: deadLetter.rows.map((d) => ({
        job_id: String(d.job_id), job_type: String(d.job_type),
        campaign_id: (d.campaign_id as string | null) ?? null,
        last_error: (d.last_error as string | null) ?? null,
        updated_at: String(d.updated_at),
      })),
      throughput_last_hour: Number((throughput.rows[0] as { n: number })?.n ?? 0),
      errors_last_hour:     Number((errorsHour.rows[0] as { n: number })?.n ?? 0),
      recent_by_type,
      next_scheduled_at: (nextRun.rows[0] as { next: string | null })?.next ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    mode: currentMode(),
    active_provider: { id: provider.id, label: provider.label },
    registered_providers: registeredProviders(),
    limiter: { config: limiterConfig(), buckets: limiterSnapshot() },
    ...(r ?? {
      by_status: {}, workers: [], dead_letter: [],
      throughput_last_hour: 0, errors_last_hour: 0, recent_by_type: {},
      next_scheduled_at: null,
    }),
  });
}
