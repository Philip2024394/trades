// GET /api/nex/founder/email-harvest/website-harvest
// Founder-only aggregate of the website-walk layer · distinct counters
// per Founder directive (business_discovered / website_discovered /
// website_walked / email_discovered / evidence_persisted).

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const country_iso = url.searchParams.get("country") ?? undefined;
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const params: any[] = [];
    let where = "";
    if (country_iso) { params.push(country_iso.toUpperCase()); where = `WHERE country_iso = $${params.length}`; }
    const agg = await client.query<{
      businesses_discovered: number;
      websites_discovered: number;
      websites_walked: number;
      websites_walked_zero_pages: number;
      websites_blocked_by_robots: number;
      websites_blocked_by_governance: number;
      websites_unavailable: number;
      websites_not_applicable: number;
      emails_discovered: number;
    }>(
      `SELECT
         COUNT(*)::int AS businesses_discovered,
         COUNT(*) FILTER (WHERE website_url IS NOT NULL AND website_url <> '')::int AS websites_discovered,
         COUNT(*) FILTER (WHERE website_walk_status = 'walked')::int AS websites_walked,
         COUNT(*) FILTER (WHERE website_walk_status = 'walked_zero_pages')::int AS websites_walked_zero_pages,
         COUNT(*) FILTER (WHERE website_walk_status = 'blocked_by_robots')::int AS websites_blocked_by_robots,
         COUNT(*) FILTER (WHERE website_walk_status = 'blocked_by_governance')::int AS websites_blocked_by_governance,
         COUNT(*) FILTER (WHERE website_walk_status = 'unavailable')::int AS websites_unavailable,
         COUNT(*) FILTER (WHERE website_walk_status = 'not_applicable')::int AS websites_not_applicable,
         COALESCE(SUM(emails_discovered_count), 0)::int AS emails_discovered
       FROM nex.harvest_business_candidate ${where}`,
      params,
    );

    const byCountry = await client.query<{
      country: string; businesses: number; walked: number; emails: number;
    }>(
      `SELECT country_iso AS country,
              COUNT(*)::int AS businesses,
              COUNT(*) FILTER (WHERE website_walk_status = 'walked')::int AS walked,
              COALESCE(SUM(emails_discovered_count), 0)::int AS emails
         FROM nex.harvest_business_candidate ${where}
        GROUP BY country_iso ORDER BY businesses DESC LIMIT 50`,
      params,
    );

    return NextResponse.json({ ok: true, aggregate: agg.rows[0] ?? null, by_country: byCountry.rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        aggregate: null,
        by_country: [],
        warning: "harvest_business_candidate_schema_not_applied",
        detail: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
