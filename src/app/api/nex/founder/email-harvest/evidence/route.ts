// GET /api/nex/founder/email-harvest/evidence
//
// Founder-only · Evidence & Provenance live feed.
// Returns real rows from nex.discovery_business_evidence with every
// provenance column intact + optional join to nex.discovery_entity.
// Read-only. No caching. No fabrication.

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
    const country = url.searchParams.get("country");
    const withEmailOnly = url.searchParams.get("with_email") === "true";
    const source = url.searchParams.get("source");

    const wheres: string[] = [];
    const params: any[] = [];
    if (country) { params.push(country.toUpperCase()); wheres.push(`e.iso_alpha_2 = $${params.length}`); }
    if (withEmailOnly) wheres.push(`e.discovered_email IS NOT NULL`);
    if (source) { params.push(source); wheres.push(`e.discovered_via_source = $${params.length}`); }
    const whereClause = wheres.length ? `WHERE ${wheres.join(" AND ")}` : "";

    const serverNow = (await client.query(`SELECT now() AS n`)).rows[0].n.toISOString();

    // Totals (unfiltered baseline)
    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence) AS total_rows,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS with_email,
        (SELECT COUNT(*)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL AND email_source_url IS NOT NULL) AS with_source_url,
        (SELECT COUNT(DISTINCT iso_alpha_2)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS distinct_countries,
        (SELECT COUNT(DISTINCT discovered_via_source)::int FROM nex.discovery_business_evidence WHERE discovered_email IS NOT NULL) AS distinct_sources,
        (SELECT COUNT(*)::int FROM nex.discovery_entity) AS entities_total
    `);

    // By country
    const byCountry = await client.query(`
      SELECT iso_alpha_2, COUNT(*)::int rows, COUNT(discovered_email)::int with_email,
             COUNT(DISTINCT website_url)::int distinct_websites
        FROM nex.discovery_business_evidence
       ${country ? `WHERE iso_alpha_2 = $1` : ``}
       GROUP BY iso_alpha_2 ORDER BY iso_alpha_2`,
      country ? [country.toUpperCase()] : []);

    // By source
    const bySource = await client.query(`
      SELECT discovered_via_source, COUNT(*)::int rows,
             COUNT(discovered_email)::int with_email,
             COUNT(DISTINCT iso_alpha_2)::int distinct_countries
        FROM nex.discovery_business_evidence
       WHERE discovered_via_source IS NOT NULL
       GROUP BY discovered_via_source ORDER BY rows DESC`);

    // Provenance-tier breakdown
    const byTier = await client.query(`
      SELECT COALESCE(email_evidence_tier, 'unclassified') AS tier,
             COUNT(*)::int rows
        FROM nex.discovery_business_evidence
       WHERE discovered_email IS NOT NULL
       GROUP BY 1 ORDER BY rows DESC`);

    // Confidence distribution
    const byConfidence = await client.query(`
      SELECT
        CASE
          WHEN email_extraction_confidence IS NULL THEN 'unmeasured'
          WHEN email_extraction_confidence >= 0.95 THEN 'very_high_>=0.95'
          WHEN email_extraction_confidence >= 0.85 THEN 'high_>=0.85'
          WHEN email_extraction_confidence >= 0.70 THEN 'good_>=0.70'
          ELSE 'below_0.70'
        END AS bucket,
        COUNT(*)::int rows
      FROM nex.discovery_business_evidence
      WHERE discovered_email IS NOT NULL
      GROUP BY 1 ORDER BY 1`);

    // Recent rows · full provenance columns
    const rowsRes = await client.query(`
      SELECT
        e.evidence_id, e.programme_id, e.iso_alpha_2, e.cycle_id::text,
        e.business_name, e.website_url, e.contact_page_url,
        e.services, e.category,
        e.discovered_via_term, e.discovered_via_source, e.discovered_via_evidence_url,
        e.discovered_email, e.email_source_url, e.email_extraction_confidence,
        e.email_type, e.email_evidence_tier, e.email_provider_domain,
        e.first_seen_at::text, e.last_seen_at::text,
        e.entity_id::text,
        ent.state AS entity_state,
        ent.confidence AS entity_confidence,
        s.founder_signed_at::text AS source_founder_signed_at,
        s.source_type,
        s.host AS source_host
        FROM nex.discovery_business_evidence e
        LEFT JOIN nex.discovery_entity ent ON ent.entity_id = e.entity_id
        LEFT JOIN nex.harvest_source s ON s.source_slug = e.discovered_via_source
        ${whereClause}
       ORDER BY e.first_seen_at DESC
       LIMIT ${limit}`,
      params);

    // Entities · state breakdown
    const entities = await client.query(`
      SELECT state, COUNT(*)::int rows FROM nex.discovery_entity
       GROUP BY state ORDER BY rows DESC`);

    return NextResponse.json({
      ok: true,
      server_now: serverNow,
      filters: { limit, country: country ?? null, with_email_only: withEmailOnly, source: source ?? null },
      totals: totals.rows[0],
      by_country: byCountry.rows,
      by_source: bySource.rows,
      by_evidence_tier: byTier.rows,
      by_confidence_bucket: byConfidence.rows,
      by_entity_state: entities.rows,
      rows: rowsRes.rows,
      standing_marketing_status_line: "NEX Managed Email Marketing · MACHINERY PROVEN UNDER TEST · NOT YET PROVEN RUNNING AGAINST THE WORLD.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({ ok: true, warning: "schema_not_applied", detail: msg, rows: [] });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
