// GET /api/nex/founder/email-harvest/live-inventory
//
// Live inventory for the consolidated Email Harvest page.
// Every counter is a fresh SQL query · zero caching · zero simulation.
// Returns:
//   - server_now (authoritative time)
//   - totals (total emails · unique addresses · countries · sources)
//   - by_country breakdown
//   - by_source breakdown
//   - by_confidence bucket
//   - recent rows (default 100 · sorted by first_seen_at desc)
//   - recent_batches (last 10 founder send batches)
//   - live_flags (G3-24h aof_cycle activity in last 5m · yes/no honest state)

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
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(500, Number(url.searchParams.get("limit") ?? 100)));

    const serverNowRes = await client.query(`SELECT now() AS n`);
    const server_now: string = serverNowRes.rows[0].n.toISOString();

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS total_rows,
        (SELECT COUNT(DISTINCT LOWER(discovered_email))::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS unique_addresses,
        (SELECT COUNT(DISTINCT iso_alpha_2)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS distinct_countries,
        (SELECT COUNT(DISTINCT discovered_via_source)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS distinct_sources,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL AND first_seen_at >= now() - interval '1 hour') AS added_last_hour,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL AND first_seen_at >= now() - interval '5 minutes') AS added_last_5min
    `);

    const by_country = await client.query(`
      SELECT iso_alpha_2 AS country,
             COUNT(*)::int AS rows,
             COUNT(DISTINCT LOWER(discovered_email))::int AS unique_addresses
        FROM nex.discovery_business_evidence
       WHERE discovered_email IS NOT NULL
       GROUP BY iso_alpha_2
       ORDER BY unique_addresses DESC
    `);

    const by_source = await client.query(`
      SELECT discovered_via_source AS source,
             COUNT(*)::int AS rows,
             COUNT(DISTINCT LOWER(discovered_email))::int AS unique_addresses
        FROM nex.discovery_business_evidence
       WHERE discovered_email IS NOT NULL
       GROUP BY discovered_via_source
       ORDER BY unique_addresses DESC
    `);

    const by_confidence = await client.query(`
      SELECT
        CASE
          WHEN email_extraction_confidence IS NULL THEN 'unmeasured'
          WHEN email_extraction_confidence >= 0.90 THEN 'high_ge_0.90'
          WHEN email_extraction_confidence >= 0.75 THEN 'good_ge_0.75'
          WHEN email_extraction_confidence >= 0.60 THEN 'fair_ge_0.60'
          ELSE 'low_lt_0.60'
        END AS bucket,
        COUNT(*)::int AS rows
      FROM nex.discovery_business_evidence
      WHERE discovered_email IS NOT NULL
      GROUP BY 1
      ORDER BY 1
    `);

    const rows = await client.query(`
      SELECT
        e.evidence_id,
        e.iso_alpha_2 AS country,
        e.business_name,
        e.website_url,
        e.discovered_email,
        e.email_source_url,
        e.email_extraction_confidence,
        e.discovered_via_source,
        e.discovered_via_term,
        e.first_seen_at::text,
        e.last_seen_at::text,
        s.host AS source_host,
        v.deliverable   AS verification_state,
        v.rcpt_code     AS verification_rcpt_code,
        v.verified_at::text AS verified_at,
        di.is_catch_all,
        -- All emails persisted for this business (multi-email unlock)
        COALESCE((
          SELECT json_agg(json_build_object(
            'email', be.email_address,
            'method', be.extraction_method,
            'confidence', be.extraction_confidence,
            'source_url', be.email_source_url,
            'same_apex', be.same_apex_as_business,
            'role_hint', be.role_hint,
            'verification', bv.deliverable
          ) ORDER BY be.extraction_confidence DESC NULLS LAST)
          FROM nex.business_email be
          LEFT JOIN nex.email_verification bv ON bv.email_address = be.email_address
          WHERE be.evidence_id = e.evidence_id
        ), '[]'::json) AS all_emails
      FROM nex.discovery_business_evidence e
      LEFT JOIN nex.harvest_source s   ON s.source_slug = e.discovered_via_source
      LEFT JOIN nex.email_verification v ON v.email_address = LOWER(e.discovered_email)
      LEFT JOIN nex.domain_intelligence di ON di.domain = LOWER(SPLIT_PART(e.discovered_email, '@', 2))
      WHERE e.discovered_email IS NOT NULL
      ORDER BY e.first_seen_at DESC
      LIMIT ${limit}
    `);

    // Live harvest activity flag: is anything writing right now?
    const live_flags = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.aof_cycle WHERE started_at >= now() - interval '5 minutes') AS cycles_last_5min,
        (SELECT COUNT(*)::int FROM nex.aof_cycle WHERE started_at >= now() - interval '1 hour') AS cycles_last_hour,
        (SELECT MAX(started_at)::text FROM nex.aof_cycle) AS latest_cycle_at,
        (SELECT MAX(last_seen_at)::text FROM nex.aof_agent) AS latest_agent_heartbeat_at
    `).catch(() => ({ rows: [{ cycles_last_5min: null, cycles_last_hour: null, latest_cycle_at: null, latest_agent_heartbeat_at: null }] }));

    // Recent batches (last 10)
    const recent_batches = await client.query(`
      SELECT
        b.batch_id,
        b.subject,
        b.recipient_count,
        b.status,
        b.smtp_host,
        b.created_at::text,
        b.sent_completed_at::text,
        (SELECT COUNT(*)::int FROM nex.founder_email_recipient WHERE batch_id = b.batch_id AND status = 'sent') AS sent_count,
        (SELECT COUNT(*)::int FROM nex.founder_email_recipient WHERE batch_id = b.batch_id AND status = 'failed') AS failed_count
      FROM nex.founder_email_batch b
      ORDER BY b.created_at DESC
      LIMIT 10
    `).catch(() => ({ rows: [] }));

    // Verification summary (join-safe · empty when tables missing)
    const verification_summary = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.email_verification) AS total_verified,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable='deliverable') AS deliverable,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable='undeliverable') AS undeliverable,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable='catch_all') AS catch_all,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable='risky') AS risky,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable='unknown') AS unknown,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL
           AND NOT EXISTS (SELECT 1 FROM nex.email_verification v WHERE v.email_address = LOWER(discovered_email))
        ) AS unverified
    `).catch(() => ({ rows: [{}] }));

    // Multi-email summary (join-safe · empty when table missing)
    const multi_email = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.business_email) AS total_emails_persisted,
        (SELECT COUNT(DISTINCT evidence_id)::int FROM nex.business_email) AS businesses_with_email,
        (SELECT ROUND(AVG(cnt)::numeric, 2) FROM (
           SELECT evidence_id, COUNT(*) cnt FROM nex.business_email GROUP BY evidence_id
         ) x) AS avg_emails_per_business
    `).catch(() => ({ rows: [{}] }));

    return NextResponse.json({
      ok: true,
      server_now,
      totals: totals.rows[0],
      by_country: by_country.rows,
      by_source: by_source.rows,
      by_confidence: by_confidence.rows,
      verification: verification_summary.rows[0] ?? {},
      multi_email: multi_email.rows[0] ?? {},
      rows: rows.rows,
      live_flags: live_flags.rows[0],
      recent_batches: recent_batches.rows,
      standing_marketing_status_line: "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
