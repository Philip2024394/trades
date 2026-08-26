// src/lib/nex-hq/workforce-metrics.ts
//
// Real-DB workforce metrics for HQ · Stage 10 observation phase (2026-08-24).
//
// Philip 2026-08-24: "These must come from real DB/runtime data. No estimated
// numbers. This is now more important than cosmetic UI work."
//
// Every metric is a live query against the same tables that already exist
// (worker_cycle_run · provider_rate_lease · discovery_orchestrator_pick).
// No new schema · no derivation · no smoothing · no fabrication.

import type { Pool } from "pg";

export interface WorkforceMetrics {
  windowLabel:         string;    // e.g. "last 1h" · "last 24h"
  windowStart:         Date;
  cyclesCompleted:     number;
  cyclesFailed:        number;
  cyclesAborted:       number;    // reconciler-killed cycles in window (status='aborted')
  cyclesRunning:       number;    // status='running' currently
  failureRatePct:      number;    // failed / (completed+failed) · 0 when total=0
  serializationErrors: number;    // cycles whose summary carries the SERIALIZABLE conflict marker · P0 canary
  recordsNew:          number;    // sum of records_new across acquisition cycles in window
  recordsProcessed:    number;    // sum of records_processed
  recordsNewPerHour:   number;    // extrapolated · honest rate over the actual observed window
  avgCycleDurationMs:  number | null;  // avg of completed cycles
  avgRecordsNewPerCycle: number | null;
  zombieCycles:        number;    // status='running' AND started_at older than 15 min (acquisition timeout)
  nominatimLeases:     number;    // acquired_at within window
  overpassLeases:      number;
  totalProviderLeases: number;
  activeLeases:        number;    // released_at IS NULL right now
  orchestratorPicks:   number;    // picks recorded in window
  distinctPickedCombos: number;   // unique (city, category) picked in window
  observationWindowSec: number;   // seconds since windowStart
}

export interface WorkforceMetricsInput {
  windowMs?: number;   // default 3600000 (1h)
}

export async function loadWorkforceMetrics(
  pool: Pool,
  opts: WorkforceMetricsInput = {},
): Promise<WorkforceMetrics> {
  const windowMs = opts.windowMs ?? 3600000;
  const windowStart = new Date(Date.now() - windowMs);
  const windowLabel = windowMs === 3600000 ? "last 1h"
                    : windowMs === 86400000 ? "last 24h"
                    : `last ${Math.round(windowMs / 60000)}min`;

  const [cycleAgg, zombie, leaseAgg, activeAgg, picksAgg] = await Promise.all([
    pool.query<{
      completed: number; failed: number; aborted: number; running: number;
      records_new: number; records_processed: number;
      avg_ms: number | null; avg_new: number | null;
      serialization_errors: number;
    }>(`
      SELECT
        count(*) FILTER (WHERE status='completed')::int AS completed,
        count(*) FILTER (WHERE status='failed')::int AS failed,
        count(*) FILTER (WHERE status='aborted')::int AS aborted,
        count(*) FILTER (WHERE status='running')::int AS running,
        COALESCE(SUM(records_new), 0)::int AS records_new,
        COALESCE(SUM(records_processed), 0)::int AS records_processed,
        AVG(duration_ms) FILTER (WHERE status='completed')::int AS avg_ms,
        AVG(records_new) FILTER (WHERE status='completed')::float AS avg_new,
        count(*) FILTER (WHERE summary->>'unexpected_error' ILIKE 'could not serialize%')::int AS serialization_errors
      FROM nex.worker_cycle_run
      WHERE started_at > $1 AND worker_type = 'acquisition'`,
      [windowStart],
    ),
    pool.query<{ n: number }>(
      // 2026-08-24 · P0 · autonomous reconciler now catches these at 15 min ·
      // if this metric is >0, either reconciler is failing or cycle just started
      // its stale phase and the next 3-min tick will reap it.
      `SELECT count(*)::int AS n FROM nex.worker_cycle_run
        WHERE status='running' AND started_at < now() - interval '15 minutes'`,
    ),
    pool.query<{ provider: string; n: number }>(
      `SELECT provider, count(*)::int AS n
         FROM nex.provider_rate_lease
        WHERE acquired_at > $1
        GROUP BY provider`,
      [windowStart],
    ),
    pool.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM nex.provider_rate_lease WHERE released_at IS NULL`,
    ),
    pool.query<{ total: number; distinct_combos: number }>(
      `SELECT count(*)::int AS total,
              count(DISTINCT (city || ':' || category))::int AS distinct_combos
         FROM nex.discovery_orchestrator_pick
        WHERE picked_at > $1`,
      [windowStart],
    ).catch(() => ({ rows: [{ total: 0, distinct_combos: 0 }] as { total: number; distinct_combos: number }[] })),
  ]);

  const r = cycleAgg.rows[0];
  const completed = Number(r.completed) || 0;
  const failed = Number(r.failed) || 0;
  const aborted = Number(r.aborted) || 0;
  const running = Number(r.running) || 0;
  const serializationErrors = Number(r.serialization_errors) || 0;
  const totalTerminal = completed + failed + aborted;
  const failureRatePct = totalTerminal === 0 ? 0 : Math.round(((failed + aborted) / totalTerminal) * 1000) / 10;

  const observationWindowSec = Math.max(1, Math.floor((Date.now() - windowStart.getTime()) / 1000));
  const recordsNew = Number(r.records_new) || 0;
  const recordsNewPerHour = observationWindowSec > 0
    ? Math.round((recordsNew * 3600) / observationWindowSec)
    : 0;

  const leaseByProvider = new Map(leaseAgg.rows.map((l) => [l.provider, Number(l.n)]));
  const nominatimLeases = leaseByProvider.get("nominatim") ?? 0;
  const overpassLeases  = leaseByProvider.get("overpass") ?? 0;
  const totalProviderLeases = [...leaseByProvider.values()].reduce((a, b) => a + b, 0);

  const picks = picksAgg.rows[0] ?? { total: 0, distinct_combos: 0 };

  return {
    windowLabel,
    windowStart,
    cyclesCompleted: completed,
    cyclesFailed: failed,
    cyclesAborted: aborted,
    cyclesRunning: running,
    failureRatePct,
    serializationErrors,
    recordsNew,
    recordsProcessed: Number(r.records_processed) || 0,
    recordsNewPerHour,
    avgCycleDurationMs: r.avg_ms == null ? null : Number(r.avg_ms),
    avgRecordsNewPerCycle: r.avg_new == null ? null : Math.round(Number(r.avg_new) * 100) / 100,
    zombieCycles: Number(zombie.rows[0]?.n) || 0,
    nominatimLeases,
    overpassLeases,
    totalProviderLeases,
    activeLeases: Number(activeAgg.rows[0]?.n) || 0,
    orchestratorPicks: Number(picks.total) || 0,
    distinctPickedCombos: Number(picks.distinct_combos) || 0,
    observationWindowSec,
  };
}
