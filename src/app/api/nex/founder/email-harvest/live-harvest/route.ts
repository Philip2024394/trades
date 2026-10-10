// GET /api/nex/founder/email-harvest/live-harvest
//
// Aggregated live-harvest view · reads the three tables the manifest
// commits to (harvest_job · harvest_worker · harvest_yield) plus
// contextual active AOF cycles (aof_cycle) which are the current
// operational truth of what NEX is actually doing right now.
//
// Founder rule: `.catch(() => empty-shape)` is BANNED here. Every query
// either returns real data or the outer catch classifies the failure
// honestly. No silent zeros.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  const t_started = Date.now();
  try {
    const server_now = (await client.query(`SELECT now() AS n`)).rows[0].n.toISOString();

    // ── nex.harvest_job (queue state · authoritative) ──
    const queueByStatusType = await client.query(`
      SELECT status, job_type, COUNT(*)::int c FROM nex.harvest_job
       GROUP BY status, job_type ORDER BY status, job_type`);
    const recentJobs = await client.query(`
      SELECT job_id, status, job_type, country_iso, source_id::text, priority,
             lease_owner, attempts, max_attempts, last_error,
             created_at::text, updated_at::text, next_attempt_at::text,
             lease_acquired_at::text, lease_expires_at::text
        FROM nex.harvest_job
       ORDER BY updated_at DESC NULLS LAST LIMIT 30`);
    const dlqSample = await client.query(`
      SELECT job_id, job_type, country_iso, source_id::text, last_error, updated_at::text
        FROM nex.harvest_job WHERE status='dead_letter' ORDER BY updated_at DESC LIMIT 10`);

    // ── nex.harvest_worker (heartbeat state · sparse when AOF orbit is the driver) ──
    const workers = await client.query(`
      SELECT worker_id, host_identifier, status, job_type_scope,
             last_heartbeat_at::text,
             (EXTRACT(EPOCH FROM (now() - last_heartbeat_at)))::int heartbeat_age_seconds,
             expected_expiry_at::text,
             started_at::text,
             jobs_claimed, jobs_completed, jobs_failed, metadata
        FROM nex.harvest_worker
       ORDER BY last_heartbeat_at DESC LIMIT 20`);
    const workerCounts = await client.query(`
      SELECT status, COUNT(*)::int c FROM nex.harvest_worker GROUP BY status`);
    const workerCountMap = { alive: 0, expired: 0, drained: 0 };
    for (const r of workerCounts.rows) if (r.status in workerCountMap) (workerCountMap as any)[r.status] = Number(r.c);

    // ── nex.harvest_yield (evidence-of-real-work ledger) ──
    const yieldTotals = await client.query(`
      SELECT COUNT(*)::int total,
             MAX(yielded_at)::text most_recent_at,
             (EXTRACT(EPOCH FROM (now() - MAX(yielded_at))))::int age_seconds
        FROM nex.harvest_yield`);
    const yieldWindows = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE yielded_at > now() - INTERVAL '5 minutes')::int last_5m,
        COUNT(*) FILTER (WHERE yielded_at > now() - INTERVAL '60 minutes')::int last_60m,
        COUNT(*) FILTER (WHERE yielded_at > now() - INTERVAL '24 hours')::int last_24h
      FROM nex.harvest_yield`);
    const yieldByKindHour = await client.query(`
      SELECT yield_kind, SUM(yield_count)::int total_count, COUNT(*)::int events
        FROM nex.harvest_yield WHERE yielded_at > now() - INTERVAL '60 minutes'
       GROUP BY yield_kind ORDER BY events DESC`);
    const recentYields = await client.query(`
      SELECT yield_id::text, job_id::text, worker_id, yield_kind, yield_count, yielded_at::text,
             yield_meta
        FROM nex.harvest_yield ORDER BY yielded_at DESC LIMIT 15`);

    // ── AOF context (current operational truth) ──
    const activeCycles = await client.query(`
      SELECT cycle_id::text, cycle_seq, started_at::text,
             (EXTRACT(EPOCH FROM (now() - started_at)))::int age_seconds,
             countries_touched, sources_attempted, sources_succeeded,
             candidates_added, walks_completed, emails_captured, triggered_by
        FROM nex.aof_cycle WHERE ended_at IS NULL
       ORDER BY started_at DESC LIMIT 10`);
    const activeAgents = await client.query(`
      SELECT COUNT(*) FILTER (WHERE status='active')::int active_count,
             COUNT(*) FILTER (WHERE last_seen_at > now() - INTERVAL '2 minutes')::int recently_seen,
             MIN(EXTRACT(EPOCH FROM (now() - last_seen_at)))::int freshest_seen_age_s
        FROM nex.aof_agent`);

    // Compute headline state honestly
    const q = { queued: 0, claimed: 0, processing: 0, completed: 0, failed: 0, dead_letter: 0 };
    for (const r of queueByStatusType.rows) if (r.status in q) (q as any)[r.status] += Number(r.c);
    const yieldMostRecentAgeS = yieldTotals.rows[0].age_seconds;
    const aliveWorkers = workerCountMap.alive;
    const activeCycleCount = activeCycles.rowCount;

    let headline_state: string;
    let headline_note: string;
    if (activeCycleCount > 0 && (q.claimed + q.processing) === 0 && (yieldMostRecentAgeS ?? 99999) > 300) {
      headline_state = "active_via_aof_only";
      headline_note = `${activeCycleCount} aof_cycle(s) running · no harvest_job currently claimed · no yield_ledger rows in last 5 min · AOF orbit produces work through its own event log, not through the classic harvest_worker/harvest_job/harvest_yield path. This is architectural: AOF is the observer of real activity.`;
    } else if (activeCycleCount > 0 && (q.claimed + q.processing) > 0) {
      headline_state = "active";
      headline_note = `${activeCycleCount} aof_cycle(s) running + ${q.claimed + q.processing} harvest_job(s) held. Live.`;
    } else if (aliveWorkers === 0 && (q.claimed + q.processing) > 0) {
      headline_state = "stalled";
      headline_note = `No alive workers registered · ${q.claimed + q.processing} job(s) held in lease. Reaper should recover on next AOF cycle.`;
    } else if (activeCycleCount === 0 && q.queued === 0 && aliveWorkers === 0) {
      headline_state = "idle";
      headline_note = `No AOF cycles active · queue empty · no live workers. Quiet is honest.`;
    } else {
      headline_state = "mixed";
      headline_note = `queue: ${q.queued} queued / ${q.claimed} claimed / ${q.processing} processing · workers: ${aliveWorkers} alive · aof_cycles: ${activeCycleCount} active.`;
    }

    return NextResponse.json({
      ok: true,
      server_now,
      query_duration_ms: Date.now() - t_started,
      headline: { state: headline_state, note: headline_note },
      queue: {
        by_status_and_type: queueByStatusType.rows,
        totals: q,
        recent_jobs: recentJobs.rows,
        dead_letter_sample: dlqSample.rows,
      },
      workers: {
        count_by_status: workerCountMap,
        detail: workers.rows,
        note_architectural_gap:
          "nex.harvest_worker is the classic-path worker registry (populated by registerWorker()). " +
          "The AOF orbit uses ephemeral per-cycle worker_ids that do not currently register here. " +
          "For AOF-driven live activity, see aof_cycle + aof_agent_event via /api/nex/founder/email-harvest/operations-live.",
      },
      yield_ledger: {
        total: Number(yieldTotals.rows[0].total),
        most_recent_at: yieldTotals.rows[0].most_recent_at,
        most_recent_age_seconds: yieldTotals.rows[0].age_seconds,
        windows: yieldWindows.rows[0],
        by_kind_last_60_min: yieldByKindHour.rows,
        recent_events: recentYields.rows,
      },
      aof_context: {
        active_cycles: activeCycles.rows,
        active_cycle_count: activeCycleCount,
        agents_active: Number(activeAgents.rows[0].active_count),
        agents_recently_seen: Number(activeAgents.rows[0].recently_seen),
        freshest_agent_last_seen_age_s: Number(activeAgents.rows[0].freshest_seen_age_s ?? -1),
      },
      standing_marketing_status_line: "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
      cron_activation_state: process.env.NEX_DISCOVERY_CRON_ACTIVATION === "on" ? "on" : "off",
      page_fetcher_activation_state: process.env.NEX_PAGE_FETCHER_ACTIVATION === "on" ? "on" : "off",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, warning: "harvest_schema_not_applied", detail: msg });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
