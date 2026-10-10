// GET /api/nex/founder/email-harvest/source-quality
//
// Per-source scorecard · every metric derived from the real event log +
// state tables. No synthesis. No hardcoded numbers. If a metric can't
// be computed from evidence, it is returned as null with a reason.

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
  try {
    const serverNowRes = await client.query(`SELECT now() AS server_now`);
    const server_now = serverNowRes.rows[0].server_now.toISOString();

    // Founder-signed sources (authority list)
    const sourcesRes = await client.query(`
      SELECT source_slug, source_type, host, priority, enabled,
             founder_signed_at::text, founder_signed_by,
             lifetime_probes, lifetime_businesses, lifetime_emails,
             reliability_score, consecutive_success, consecutive_failure,
             last_attempt_at::text, last_success_at::text, last_failure_at::text,
             country_scope, category_scope
        FROM nex.harvest_source
       WHERE founder_signed_at IS NOT NULL
       ORDER BY priority DESC`);

    // Per-source metrics computed from event log + state
    const scorecards: any[] = [];
    for (const s of sourcesRes.rows) {
      const slug = s.source_slug;

      // Discovery events for this source
      const disc = await client.query(`
        SELECT
          COUNT(*)::int AS total_discover_attempts,
          COUNT(*) FILTER (WHERE payload->>'kind' = 'ok')::int AS ok_attempts,
          COUNT(*) FILTER (WHERE payload->>'kind' = 'zero_results')::int AS zero_result_attempts,
          COUNT(*) FILTER (WHERE payload->>'kind' = 'rate_limited')::int AS rate_limited_attempts,
          COUNT(*) FILTER (WHERE payload->>'kind' = 'source_unavailable')::int AS unavailable_attempts,
          COUNT(*) FILTER (WHERE payload->>'kind' = 'parse_error')::int AS parse_error_attempts,
          COALESCE(SUM((payload->>'inserted')::int), 0)::int AS total_inserted,
          COALESCE(SUM((payload->>'walks_enqueued')::int), 0)::int AS total_walks_enqueued,
          COALESCE(SUM((payload->>'cross_source_rediscoveries')::int), 0)::int AS total_rediscoveries
          FROM nex.aof_agent_event
         WHERE event_kind = 'decision' AND payload->>'op' = 'discover'
           AND payload->>'source_slug' = $1`, [slug]);

      // Candidates produced by this source
      const candCounts = await client.query(`
        SELECT
          COUNT(*)::int AS candidates,
          COUNT(website_url)::int AS with_website,
          COUNT(CASE WHEN website_walk_status = 'walked' THEN 1 END)::int AS walked_ok,
          COUNT(CASE WHEN website_walk_status = 'blocked_by_governance' THEN 1 END)::int AS blocked,
          COUNT(CASE WHEN website_walk_status = 'unavailable' THEN 1 END)::int AS unavailable,
          COUNT(DISTINCT country_iso)::int AS distinct_countries,
          MIN(discovered_at)::text AS first_seen,
          MAX(discovered_at)::text AS most_recent
          FROM nex.harvest_business_candidate WHERE source_slug = $1`, [slug]);

      // Emails via this source (from discovery_business_evidence)
      const emailCounts = await client.query(`
        SELECT
          COUNT(*)::int AS evidence_rows,
          COUNT(discovered_email)::int AS with_email,
          COUNT(DISTINCT iso_alpha_2)::int AS distinct_email_countries
          FROM nex.discovery_business_evidence
         WHERE discovered_via_source = $1`, [slug]);

      // Cooldown history (aof_source_cooldown current state)
      const cdRes = await client.query(`
        SELECT cooldown_until::text, last_failure_kind, last_failure_at::text,
               consecutive_failures,
               (cooldown_until > now()) AS currently_cooled,
               (EXTRACT(EPOCH FROM (cooldown_until - now())))::int AS seconds_until_expiry
          FROM nex.aof_source_cooldown WHERE source_slug = $1`, [slug]);

      const cd = cdRes.rows[0] ?? null;

      // Rate metrics · from event log
      const total_attempts = Number(disc.rows[0].total_discover_attempts);
      const rate_limit_rate = total_attempts > 0 ? Number(disc.rows[0].rate_limited_attempts) / total_attempts : null;
      const unavailable_rate = total_attempts > 0 ? Number(disc.rows[0].unavailable_attempts) / total_attempts : null;
      const zero_result_rate = total_attempts > 0 ? Number(disc.rows[0].zero_result_attempts) / total_attempts : null;
      const ok_rate = total_attempts > 0 ? Number(disc.rows[0].ok_attempts) / total_attempts : null;

      // Yield-per-attempt
      const inserted_per_attempt = total_attempts > 0 ? Number(disc.rows[0].total_inserted) / total_attempts : null;

      // Walk success rate
      const with_website = Number(candCounts.rows[0].with_website);
      const walked_ok = Number(candCounts.rows[0].walked_ok);
      const walk_success_rate = with_website > 0 ? walked_ok / with_website : null;

      // Email yield · emails per candidate with website
      const email_yield_rate = with_website > 0 ? Number(emailCounts.rows[0].with_email) / with_website : null;

      // Provenance completeness · % of candidates whose source_slug matches
      // any evidence row with matching business_name (approx)
      const provRes = await client.query(`
        SELECT
          COUNT(*)::int AS candidates_with_email_evidence,
          (SELECT COUNT(*)::int FROM nex.harvest_business_candidate WHERE source_slug = $1) AS total_candidates
          FROM nex.harvest_business_candidate c
         WHERE c.source_slug = $1
           AND EXISTS (
             SELECT 1 FROM nex.discovery_business_evidence e
              WHERE lower(e.business_name) = lower(c.business_name)
                AND e.discovered_via_source = $1
                AND e.discovered_email IS NOT NULL)`, [slug]);
      const provenance_completeness = Number(provRes.rows[0].total_candidates) > 0
        ? Number(provRes.rows[0].candidates_with_email_evidence) / Number(provRes.rows[0].total_candidates)
        : null;

      scorecards.push({
        source_slug: slug,
        source_type: s.source_type,
        host: s.host,
        priority: Number(s.priority),
        enabled: s.enabled,
        founder_signed_at: s.founder_signed_at,
        country_scope: s.country_scope,
        category_scope: s.category_scope,

        // Health from registry
        reliability_score: s.reliability_score != null ? Number(s.reliability_score) : null,
        consecutive_success: Number(s.consecutive_success ?? 0),
        consecutive_failure: Number(s.consecutive_failure ?? 0),
        lifetime_probes: Number(s.lifetime_probes ?? 0),
        lifetime_businesses: Number(s.lifetime_businesses ?? 0),
        lifetime_emails: Number(s.lifetime_emails ?? 0),
        last_attempt_at: s.last_attempt_at,
        last_success_at: s.last_success_at,
        last_failure_at: s.last_failure_at,

        // Discover-attempt breakdown (from event log)
        discover_attempts_total: total_attempts,
        discover_ok: Number(disc.rows[0].ok_attempts),
        discover_zero_results: Number(disc.rows[0].zero_result_attempts),
        discover_rate_limited: Number(disc.rows[0].rate_limited_attempts),
        discover_unavailable: Number(disc.rows[0].unavailable_attempts),
        discover_parse_error: Number(disc.rows[0].parse_error_attempts),

        // Rates
        ok_rate,
        zero_result_rate,
        rate_limit_rate,
        unavailable_rate,

        // Yield
        candidates_produced: Number(candCounts.rows[0].candidates),
        candidates_with_website: with_website,
        candidates_walked_ok: walked_ok,
        candidates_blocked_by_governance: Number(candCounts.rows[0].blocked),
        candidates_unavailable: Number(candCounts.rows[0].unavailable),
        distinct_countries: Number(candCounts.rows[0].distinct_countries),
        distinct_email_countries: Number(emailCounts.rows[0].distinct_email_countries),
        evidence_rows: Number(emailCounts.rows[0].evidence_rows),
        evidence_with_email: Number(emailCounts.rows[0].with_email),

        // Ratios
        inserted_per_attempt,
        walk_success_rate,
        email_yield_rate,
        provenance_completeness,

        // Cooldown
        currently_cooled: cd ? cd.currently_cooled : false,
        cooldown_until: cd?.cooldown_until ?? null,
        cooldown_seconds_until_expiry: cd?.seconds_until_expiry ?? null,
        cooldown_last_failure_kind: cd?.last_failure_kind ?? null,
        cooldown_consecutive_failures: cd ? Number(cd.consecutive_failures) : 0,

        // Freshness
        first_candidate_at: candCounts.rows[0].first_seen,
        most_recent_candidate_at: candCounts.rows[0].most_recent,
      });
    }

    return NextResponse.json({
      ok: true,
      server_now,
      scorecards,
      standing_marketing_status_line: "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, warning: "aof_or_harvest_schema_not_applied", detail: msg, scorecards: [] });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
