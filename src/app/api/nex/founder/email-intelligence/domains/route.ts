// GET /api/nex/founder/email-intelligence/domains
//
// Live per-domain intelligence view.
// Reads nex.domain_intelligence · joins to email_verification counts.

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
    const serverNow = (await client.query(`SELECT now() AS n`)).rows[0].n.toISOString();

    const domains = await client.query(`
      SELECT
        domain, mx_host, is_catch_all,
        addresses_seen, addresses_verified,
        addresses_deliverable, addresses_undeliverable,
        addresses_risky, addresses_unknown,
        bounces_recorded, complaints_recorded,
        known_patterns, reputation_score,
        first_seen_at::text, last_verified_at::text, last_updated_at::text,
        CASE WHEN addresses_verified > 0
             THEN ROUND(addresses_deliverable::numeric / addresses_verified, 3)
             ELSE NULL END AS deliverable_rate
      FROM nex.domain_intelligence
      ORDER BY last_verified_at DESC NULLS LAST
      LIMIT 500
    `).catch(() => ({ rows: [] as any[] }));

    const totals = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM nex.email_verification) AS total_verified,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable = 'deliverable') AS total_deliverable,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable = 'undeliverable') AS total_undeliverable,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable = 'catch_all') AS total_catch_all,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable = 'risky') AS total_risky,
        (SELECT COUNT(*)::int FROM nex.email_verification WHERE deliverable = 'unknown') AS total_unknown,
        (SELECT COUNT(*)::int FROM nex.domain_intelligence) AS total_domains,
        (SELECT COUNT(*)::int FROM nex.domain_intelligence WHERE is_catch_all = TRUE) AS total_catch_all_domains
    `).catch(() => ({ rows: [{}] }));

    return NextResponse.json({
      ok: true, server_now: serverNow,
      totals: totals.rows[0] ?? {},
      domains: domains.rows,
    });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "internal_error", detail: (e as Error).message }, { status: 500 });
  } finally { client.release(); }
}
