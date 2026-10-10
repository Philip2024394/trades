// GET /api/nex/founder/email-harvest/operations-live
//
// Founder-only · per-second live-feed API for the HQ Operations Centre.
// Every field is a fresh join against the real database. No server-side
// caching. No pre-aggregation. Each request executes real SQL and
// returns the current authoritative state. `server_now` is the DB
// clock at query time so the client can compute payload age precisely.
//
// Doctrine: every number rendered by the HQ Operations Centre must be
// traceable back to a specific SQL query in this file. If a number
// isn't produced here, the HQ doesn't display it.

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

  const t_started = Date.now();
  const client = await pool.connect();
  try {
    // ── 1. Server clock (DB clock is the authority) ────────────────
    const serverNowRes = await client.query(`SELECT now() AS server_now`);
    const serverNow: string = serverNowRes.rows[0].server_now.toISOString();

    // ── 2. Queue state (nex.harvest_job by status) ─────────────────
    const queueRes = await client.query(`
      SELECT status, job_type, COUNT(*)::int c FROM nex.harvest_job
       GROUP BY status, job_type`);
    const queue = { queued: 0, claimed: 0, completed: 0, failed: 0, dead_letter: 0 };
    const queueByType: Record<string, Record<string, number>> = {};
    for (const r of queueRes.rows) {
      if (r.status in queue) (queue as any)[r.status] += Number(r.c);
      queueByType[r.job_type] = queueByType[r.job_type] || {};
      queueByType[r.job_type][r.status] = Number(r.c);
    }

    // ── 3. Workers · heartbeat freshness ───────────────────────────
    const workersRes = await client.query(`
      SELECT worker_id, status, last_heartbeat_at::text as last_heartbeat_at,
             (EXTRACT(EPOCH FROM (now() - last_heartbeat_at)))::int AS heartbeat_age_seconds,
             job_type_scope, drained_at
        FROM nex.harvest_worker
       ORDER BY last_heartbeat_at DESC NULLS LAST
       LIMIT 20`);
    const workers_active = workersRes.rows.filter(r => Number(r.heartbeat_age_seconds ?? 999) < 120 && !r.drained_at).length;

    // ── 4. AOF agents ─────────────────────────────────────────────
    const agentsRes = await client.query(`
      SELECT agent_name, agent_role, status, last_seen_at::text,
             (EXTRACT(EPOCH FROM (now() - last_seen_at)))::int AS last_seen_age_seconds
        FROM nex.aof_agent
       ORDER BY agent_role`);
    const agents_active = agentsRes.rows.filter(r => r.status === "active").length;
    const agents_signed = agentsRes.rows.filter(r => r.status === "active").length;

    // ── 5. Cycles · active + most recent ──────────────────────────
    const cycleActiveRes = await client.query(`
      SELECT cycle_id, cycle_seq, started_at::text, triggered_by,
             countries_touched, sources_attempted, sources_succeeded,
             candidates_added, walks_completed, emails_captured
        FROM nex.aof_cycle
       WHERE ended_at IS NULL
       ORDER BY started_at DESC LIMIT 5`);
    const cycleRecentRes = await client.query(`
      SELECT cycle_id, cycle_seq, started_at::text, ended_at::text, ended_kind,
             countries_touched, sources_attempted, sources_succeeded,
             candidates_added, walks_completed, emails_captured
        FROM nex.aof_cycle
       ORDER BY started_at DESC LIMIT 5`);
    const cycles_completed_last_hour = await client.query(`
      SELECT COUNT(*)::int c FROM nex.aof_cycle
       WHERE ended_at > now() - INTERVAL '1 hour' AND ended_kind = 'completed'`);

    // ── 6. Current country + source (most recent decision event) ──
    const lastSelectRes = await client.query(`
      SELECT event_at::text, payload, cycle_id
        FROM nex.aof_agent_event
       WHERE event_kind = 'decision' AND payload->>'op' = 'select_source'
       ORDER BY event_at DESC LIMIT 1`);
    const currentSelection = lastSelectRes.rows[0] ? {
      at: lastSelectRes.rows[0].event_at,
      country_iso: lastSelectRes.rows[0].payload.country_iso ?? null,
      term: lastSelectRes.rows[0].payload.term ?? null,
      selected_source: lastSelectRes.rows[0].payload.selected ?? null,
      reason: lastSelectRes.rows[0].payload.reason ?? null,
      cycle_id: lastSelectRes.rows[0].cycle_id,
    } : null;

    // ── 7. Cooldowns active ───────────────────────────────────────
    const cdRes = await client.query(`
      SELECT source_slug, cooldown_until::text,
             (EXTRACT(EPOCH FROM (cooldown_until - now())))::int AS seconds_until_expiry,
             last_failure_kind, last_failure_at::text, consecutive_failures
        FROM nex.aof_source_cooldown
       WHERE cooldown_until > now()
       ORDER BY cooldown_until ASC`);

    // ── 8. Candidate + evidence totals ────────────────────────────
    const totalsRes = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.harvest_business_candidate) AS candidates_total,
        (SELECT COUNT(*)::int FROM nex.harvest_business_candidate WHERE website_url IS NOT NULL) AS candidates_with_website,
        (SELECT COUNT(*)::int FROM nex.harvest_business_candidate WHERE website_walk_status = 'walked') AS candidates_walked_ok,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence) AS evidence_rows_total,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS evidence_with_email,
        (SELECT COUNT(DISTINCT iso_alpha_2)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS countries_with_email
    `);

    // ── 9. Rediscoveries (cross-source dedup events) ──────────────
    const redRes = await client.query(`
      SELECT COUNT(*)::int c FROM nex.aof_agent_event
       WHERE event_kind = 'decision' AND payload->>'op' = 'cross_source_rediscovery'`);
    const rediscoveries_total = Number(redRes.rows[0].c);

    // ── 10. Reaper releases in last hour ──────────────────────────
    const reaperRes = await client.query(`
      SELECT COALESCE(SUM((payload->>'released')::int), 0)::int c FROM nex.aof_agent_event
       WHERE event_kind = 'decision' AND payload->>'op' = 'reap'
         AND event_at > now() - INTERVAL '1 hour'`);
    const reaper_releases_last_hour = Number(reaperRes.rows[0].c);

    // ── 11. Failures in last hour (with per-event snippet) ────────
    const failRes = await client.query(`
      SELECT event_at::text, event_kind, agent_id, payload
        FROM nex.aof_agent_event
       WHERE event_kind IN ('error','cooldown_applied','audit_fail')
         AND event_at > now() - INTERVAL '1 hour'
       ORDER BY event_at DESC LIMIT 20`);

    // ── 12. By-country evidence + candidate breakdown ─────────────
    const byCountryRes = await client.query(`
      SELECT
        c.country_iso AS iso,
        COUNT(*)::int AS candidates,
        COUNT(CASE WHEN c.website_walk_status = 'walked' THEN 1 END)::int AS walked_ok,
        COALESCE((SELECT COUNT(*)::int FROM nex.discovery_business_evidence e
                   WHERE e.iso_alpha_2 = c.country_iso), 0) AS evidence,
        COALESCE((SELECT COUNT(*)::int FROM nex.discovery_business_evidence e
                   WHERE e.iso_alpha_2 = c.country_iso AND e.discovered_email IS NOT NULL), 0) AS with_email
        FROM nex.harvest_business_candidate c
       GROUP BY c.country_iso
       ORDER BY candidates DESC`);

    // ── 13. By-source breakdown ───────────────────────────────────
    const bySourceRes = await client.query(`
      SELECT s.source_slug, s.source_type, s.host, s.priority, s.enabled,
             s.founder_signed_at::text, s.lifetime_probes, s.lifetime_businesses, s.lifetime_emails,
             s.reliability_score, s.consecutive_success, s.consecutive_failure,
             s.last_attempt_at::text, s.last_success_at::text, s.last_failure_at::text,
             (SELECT cooldown_until::text FROM nex.aof_source_cooldown cd WHERE cd.source_slug = s.source_slug AND cd.cooldown_until > now() LIMIT 1) AS active_cooldown_until,
             (SELECT COUNT(*)::int FROM nex.harvest_business_candidate c WHERE c.source_slug = s.source_slug) AS candidates_from_this_source
        FROM nex.harvest_source s
       WHERE s.founder_signed_at IS NOT NULL
       ORDER BY s.priority DESC`);

    // ── 14. Latest heartbeat time (across ALL agents) ─────────────
    const hbRes = await client.query(`
      SELECT MAX(event_at)::text AS latest,
             (EXTRACT(EPOCH FROM (now() - MAX(event_at))))::int AS latest_age_seconds
        FROM nex.aof_agent_event WHERE event_kind = 'heartbeat'`);

    // ── 15. Harvest rate (rolling 5 min window) ───────────────────
    const rateRes = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.aof_agent_event WHERE event_kind='decision' AND payload->>'op'='walk' AND event_at > now() - INTERVAL '5 minutes') AS walks_last_5min,
        (SELECT COUNT(*)::int FROM nex.harvest_business_candidate WHERE discovered_at > now() - INTERVAL '5 minutes') AS candidates_last_5min,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE first_seen_at > now() - INTERVAL '5 minutes' AND discovered_email IS NOT NULL) AS emails_last_5min`);

    // ── 16. Recent event stream (append-only view · last 30) ──────
    const eventsRes = await client.query(`
      SELECT event_id, event_at::text, event_kind, agent_id, cycle_id,
             payload->>'op' AS op, payload
        FROM nex.aof_agent_event
       ORDER BY event_at DESC LIMIT 30`);

    // ── 17. Recent evidence rows (last 5 email discoveries) ───────
    const recentEmailsRes = await client.query(`
      SELECT iso_alpha_2, business_name, discovered_email, email_source_url,
             discovered_via_source, first_seen_at::text
        FROM nex.discovery_business_evidence
       WHERE discovered_email IS NOT NULL
       ORDER BY first_seen_at DESC LIMIT 5`);

    const t_ended = Date.now();
    return NextResponse.json({
      ok: true,
      server_now: serverNow,
      query_duration_ms: t_ended - t_started,
      queue: { ...queue, by_type: queueByType },
      workers: {
        active_count: workers_active,
        recent: workersRes.rows,
      },
      agents: {
        total: agentsRes.rowCount,
        active_count: agents_active,
        signed_count: agents_signed,
        detail: agentsRes.rows,
      },
      cycles: {
        active_count: cycleActiveRes.rowCount,
        completed_last_hour: Number(cycles_completed_last_hour.rows[0].c),
        active_detail: cycleActiveRes.rows,
        recent: cycleRecentRes.rows,
      },
      current_selection: currentSelection,
      cooldowns_active: cdRes.rows,
      totals: totalsRes.rows[0],
      rediscoveries_total,
      reaper_releases_last_hour,
      failures_last_hour: failRes.rows.map(r => ({
        at: r.event_at, kind: r.event_kind,
        op: r.payload?.op ?? null,
        snippet: JSON.stringify(r.payload).slice(0, 140),
      })),
      by_country: byCountryRes.rows,
      by_source: bySourceRes.rows,
      latest_heartbeat: {
        at: hbRes.rows[0].latest,
        age_seconds: hbRes.rows[0].latest_age_seconds,
      },
      harvest_rate: rateRes.rows[0],
      recent_events: eventsRes.rows.map(r => ({
        event_id: Number(r.event_id),
        at: r.event_at,
        kind: r.event_kind,
        agent_id: r.agent_id,
        cycle_id: r.cycle_id,
        op: r.op,
        summary: describeEvent(r.event_kind, r.payload),
      })),
      recent_email_discoveries: recentEmailsRes.rows,
      standing_marketing_status_line: "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
      cron_activation_state: process.env.NEX_DISCOVERY_CRON_ACTIVATION === "on" ? "on" : "off",
      page_fetcher_activation_state: process.env.NEX_PAGE_FETCHER_ACTIVATION === "on" ? "on" : "off",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, warning: "aof_or_harvest_schema_not_applied", detail: msg });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}

function describeEvent(kind: string, payload: any): string {
  const op = payload?.op;
  if (kind === "cycle_start") return `cycle_start · territories=${payload?.territories_planned ?? "?"} · asia_last=${payload?.asia_last_enforced ?? "?"}`;
  if (kind === "cycle_end") return `cycle_end · ${payload?.ended_kind ?? "?"} · audit=${payload?.audit_pass ?? "?"}`;
  if (kind === "cooldown_applied") return `cooldown ${payload?.source_slug ?? "?"} · ${payload?.failure_kind ?? "?"}`;
  if (kind === "decision" && op === "select_source") return `select_source ${payload?.country_iso ?? "?"}/${payload?.term ?? "?"} → ${payload?.selected ?? "no_source_available"}`;
  if (kind === "decision" && op === "walk") return `walk ${payload?.country ?? "?"} · ${payload?.kind ?? "?"} · emails=${payload?.emails_captured ?? 0}`;
  if (kind === "decision" && op === "discover") return `discover ${payload?.adapter ?? "?"} · ${payload?.country_iso ?? "?"} · inserted=${payload?.inserted ?? 0}`;
  if (kind === "decision" && op === "cross_source_rediscovery") return `rediscover ${payload?.business_name?.slice(0, 30) ?? "?"} · ${payload?.existing_source_slug} → ${payload?.new_source_slug}`;
  if (kind === "decision" && op === "reap") return `reap · released=${payload?.released ?? 0}`;
  if (kind === "audit_pass") return `audit_pass`;
  if (kind === "audit_fail") return `audit_fail`;
  if (kind === "heartbeat") return `heartbeat`;
  if (kind === "error") return `error · ${JSON.stringify(payload).slice(0, 60)}`;
  return `${kind}`;
}
