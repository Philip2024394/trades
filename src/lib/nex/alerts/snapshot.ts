// NEX Operational Alerts · platform snapshot builder
//
// One DB round-trip per evaluation tick · all rules read from the
// resulting snapshot. Rules stay pure (no I/O) so they're testable
// and cheap to correlate.

import { withClient } from "@/lib/nex/delivery/db";
import { limiterSnapshot, limiterConfig } from "@/lib/nex/delivery/limiter";
import { checkAllProviderHealth, registeredProviders } from "@/lib/nex/delivery/providers";
import type { PlatformSnapshot } from "./types";

export async function buildPlatformSnapshot(): Promise<PlatformSnapshot> {
  const timestamp = new Date().toISOString();

  const registered = registeredProviders();

  // Health probe is best-effort · 5s timeout per provider inside checkAllProviderHealth
  let healthMap = new Map<string, { ok: boolean | null; detail: string | null }>();
  try {
    const results = await checkAllProviderHealth();
    healthMap = new Map(results.map((r) => [r.id, { ok: r.ok, detail: r.detail }]));
  } catch { /* keep empty · rules will see health_ok=null */ }

  const providers = registered.map((p) => {
    const h = healthMap.get(p.id);
    return { id: p.id, configured: p.configured, health_ok: h?.ok ?? null, health_detail: h?.detail ?? null };
  });

  // ── DB-derived signals ────────────────────────────────────────
  const dbSnap = await withClient(async (c) => {
    const queueRes = await c.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending')::int      AS pending,
         COUNT(*) FILTER (WHERE status = 'running')::int      AS running,
         COUNT(*) FILTER (WHERE status = 'dead_letter')::int  AS dead_letter,
         COALESCE(EXTRACT(EPOCH FROM (NOW() - MIN(scheduled_for) FILTER (WHERE status = 'pending' AND scheduled_for <= NOW())))::int, 0) AS oldest_pending_age_seconds
       FROM nex.delivery_jobs`,
    );
    const q = queueRes.rows[0] as { pending: number; running: number; dead_letter: number; oldest_pending_age_seconds: number };

    const workerRes = await c.query(
      `SELECT
         COUNT(*)::int                                                       AS registered,
         COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '2 minutes')::int AS alive,
         MAX(last_seen_at)                                                    AS last_heartbeat,
         EXTRACT(EPOCH FROM (NOW() - MAX(last_seen_at)))::int                 AS seconds_since_last_heartbeat
       FROM nex.delivery_workers`,
    );
    const w = workerRes.rows[0] as { registered: number; alive: number; last_heartbeat: string | null; seconds_since_last_heartbeat: number | null };

    // 24h rates from analytics_events
    const rates24h = await c.query(
      `WITH windowed AS (
         SELECT event_type FROM nex.analytics_events WHERE event_timestamp > NOW() - INTERVAL '24 hours'
       )
       SELECT
         SUM(CASE WHEN event_type = 'delivered' THEN 1 ELSE 0 END)::int AS delivered,
         SUM(CASE WHEN event_type = 'bounced'   THEN 1 ELSE 0 END)::int AS bounced,
         SUM(CASE WHEN event_type = 'complaint' THEN 1 ELSE 0 END)::int AS complaint,
         SUM(CASE WHEN event_type = 'queued'    THEN 1 ELSE 0 END)::int AS queued
       FROM windowed`,
    );
    const r24 = rates24h.rows[0] as { delivered: number; bounced: number; complaint: number; queued: number };
    const complaint_rate_pct_24h = r24.delivered > 0 ? +(r24.complaint * 100 / r24.delivered).toFixed(3) : null;
    const bounce_rate_pct_24h    = (r24.queued + r24.bounced) > 0 ? +(r24.bounced * 100 / Math.max(1, r24.queued)).toFixed(2) : null;

    // 1h retry rate from delivery_job_attempts
    const retryRes = await c.query(
      `SELECT
         SUM(CASE WHEN outcome = 'success'            THEN 1 ELSE 0 END)::int AS ok,
         SUM(CASE WHEN outcome IN ('transient_failure','permanent_failure') THEN 1 ELSE 0 END)::int AS fail
       FROM nex.delivery_job_attempts WHERE completed_at > NOW() - INTERVAL '1 hour'`,
    );
    const rt = retryRes.rows[0] as { ok: number; fail: number };
    const total = rt.ok + rt.fail;
    const retry_rate_pct_1h = total > 0 ? +(rt.fail * 100 / total).toFixed(1) : null;

    // Webhook verify failures (best-effort · looks at nex.events for the specific type · zero if that table isn't populated with this event yet)
    const whRes = await c.query(
      `SELECT COUNT(*)::int AS n
       FROM nex.events
       WHERE event_type = 'webhook.verify_failed' AND (payload->>'ts')::timestamptz > NOW() - INTERVAL '1 hour'`,
    ).catch(() => ({ rows: [{ n: 0 }] as Record<string, unknown>[] }));
    const verify_failures_last_hour = Number((whRes.rows[0] as { n: number })?.n ?? 0);

    return { q, w, complaint_rate_pct_24h, bounce_rate_pct_24h, retry_rate_pct_1h, verify_failures_last_hour };
  });

  if (!dbSnap) {
    // Storage unreachable · return a snapshot that flags exactly that
    return {
      timestamp, database_reachable: false,
      queue: { pending: 0, running: 0, dead_letter: 0, oldest_pending_age_seconds: 0 },
      workers: { registered: 0, alive: 0, last_heartbeat: null, seconds_since_last_heartbeat: null },
      providers,
      rates: { complaint_rate_pct_24h: null, bounce_rate_pct_24h: null, retry_rate_pct_1h: null },
      webhook: { verify_failures_last_hour: 0 },
      limiter: { max_saturation_pct: 0, saturated_buckets: [] },
    };
  }

  // Rate limiter · derive per-bucket saturation
  const lc = limiterConfig();
  const ls = limiterSnapshot();
  const saturated_buckets: string[] = [];
  let max_saturation_pct = 0;
  for (const b of ls) {
    const cap = b.per_sec * lc.burst_multiplier;
    const pct = cap > 0 ? Math.round((1 - b.tokens / cap) * 100) : 0;
    if (pct >= 100) saturated_buckets.push(b.key);
    if (pct > max_saturation_pct) max_saturation_pct = pct;
  }

  return {
    timestamp, database_reachable: true,
    queue: dbSnap.q, workers: dbSnap.w, providers,
    rates: {
      complaint_rate_pct_24h: dbSnap.complaint_rate_pct_24h,
      bounce_rate_pct_24h:    dbSnap.bounce_rate_pct_24h,
      retry_rate_pct_1h:      dbSnap.retry_rate_pct_1h,
    },
    webhook: { verify_failures_last_hour: dbSnap.verify_failures_last_hour },
    limiter: { max_saturation_pct, saturated_buckets },
  };
}
