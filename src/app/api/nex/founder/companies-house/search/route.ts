// POST /api/nex/founder/companies-house/search
//
// Founder-only bridge to the Companies House adapter.
// Not activated for autonomous cron · Founder-triggered only until proven.
// Persists candidates to nex.harvest_business_candidate for downstream walk.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { searchCompaniesHouse, resolveCompaniesHouseConfig, CONSTRUCTION_SIC_CODES } from "@/lib/nex/aof/adapters/companies-house-uk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

interface Body {
  sic_code?: string;
  keyword?: string;
  items_per_page?: number;
  start_index?: number;
  dry_run?: boolean;                             // if true, do not persist
}

export async function POST(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });

  let body: Body = {};
  try { body = await req.json(); } catch { /* empty ok */ }

  const cfg = resolveCompaniesHouseConfig();
  if (!cfg.configured) {
    return NextResponse.json({
      ok: false,
      error: "not_configured",
      detail: cfg.reason,
      how_to_configure: [
        "1. Register at https://developer.company-information.service.gov.uk/",
        "2. Create an application, choose 'Live' environment",
        "3. Add REST API key to your app",
        "4. Set NEX_COMPANIES_HOUSE_API_KEY=<key> in .env.harvest.local",
        "5. Restart the dev server",
      ],
      construction_sic_codes: CONSTRUCTION_SIC_CODES.map((c) => ({
        sic: c,
        pattern: `sic_code=${c} for advanced-search`,
      })),
    }, { status: 503 });
  }

  const outcome = await searchCompaniesHouse({
    sic_code: body.sic_code,
    keyword: body.keyword,
    items_per_page: body.items_per_page ?? 20,
    start_index: body.start_index ?? 0,
    active_only: true,
  });

  if (outcome.kind !== "responded") {
    return NextResponse.json({ ok: false, adapter: outcome, error: outcome.kind });
  }

  if (body.dry_run) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total_results: outcome.total_results,
      candidates_returned: outcome.candidates.length,
      next_start_index: outcome.next_start_index,
      candidates: outcome.candidates,
    });
  }

  // Persist to harvest_business_candidate  ·  tolerant of missing columns
  const client = await pool.connect();
  let persisted = 0, updated = 0;
  try {
    const cyc = await client.query(`SELECT gen_random_uuid() AS cid`);
    const cycleId = cyc.rows[0].cid;

    for (const cand of outcome.candidates) {
      // Query nex.harvest_business_candidate structure once — we insert into
      // a subset of columns · missing rows become new candidates
      try {
        const res = await client.query(
          `INSERT INTO nex.harvest_business_candidate
             (candidate_id, source_slug, source_evidence_url,
              business_name, iso_alpha_2, discovery_term, first_seen_at, last_seen_at,
              raw_payload, website_walk_status)
           VALUES (gen_random_uuid(), 'companies_house_uk', $1, $2, 'GB', $3, now(), now(), $4::jsonb, 'pending')
           ON CONFLICT (source_slug, source_evidence_url) DO UPDATE SET
             last_seen_at = now(),
             business_name = EXCLUDED.business_name,
             raw_payload = EXCLUDED.raw_payload
           RETURNING (xmax = 0) AS is_insert`,
          [cand.source_url, cand.company_name, body.sic_code ?? body.keyword ?? "unspecified", JSON.stringify(cand)],
        );
        if (res.rows[0]?.is_insert) persisted++; else updated++;
      } catch (e) {
        if (!/does not exist/i.test((e as Error).message)) throw e;
      }
    }

    return NextResponse.json({
      ok: true,
      cycle_id: cycleId,
      total_results: outcome.total_results,
      candidates_returned: outcome.candidates.length,
      persisted_new: persisted,
      updated_existing: updated,
      next_start_index: outcome.next_start_index,
      note: "candidates persisted · website resolution + walk are separate steps",
    });
  } finally { client.release(); }
}
