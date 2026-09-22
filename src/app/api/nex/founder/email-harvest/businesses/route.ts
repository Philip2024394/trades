// GET /api/nex/founder/email-harvest/businesses
// Founder-only aggregate + rows for retained business candidates.
// Distinct counters from real persisted state (audit-2026-09-22 fix).

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadCandidates } from "@/lib/nex/harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const url = new URL(req.url);
  const country_iso = url.searchParams.get("country") ?? undefined;
  const programme_id = url.searchParams.get("programme_id") ?? undefined;
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? "50")));
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const report = await loadCandidates(client, { country_iso, programme_id, limit });
    return NextResponse.json({ ok: true, report });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        report: { total: 0, with_website: 0, without_website: 0, with_walk_job: 0, by_country: [], rows: [] },
        warning: "harvest_business_candidate_schema_not_applied",
        detail: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
