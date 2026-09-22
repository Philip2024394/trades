// GET /api/nex/founder/email-harvest/yield-summary
//
// Founder-only yield ledger summary · 5min / 60min / 24h totals + by_kind.

import { NextResponse } from "next/server";
import { getPool } from "@/lib/nex/db";
import { resolveFounderAuth } from "@/lib/nex/marketing/founder";
import { loadYieldSummary } from "@/lib/nex/harvest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = resolveFounderAuth(req);
  if (!auth.authenticated) return NextResponse.json({ ok: false, error: "not_founder" }, { status: 401 });
  const pool = await getPool();
  if (!pool) return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  const client = await pool.connect();
  try {
    const summary = await loadYieldSummary(client);
    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/does not exist/i.test(msg)) {
      return NextResponse.json({
        ok: true,
        summary: { total_last_5_min: 0, total_last_60_min: 0, total_last_24h: 0, by_kind_last_60_min: {}, most_recent_at: null },
        warning: "harvest_schema_not_applied",
        detail: msg,
      });
    }
    return NextResponse.json({ ok: false, error: "internal_error", detail: msg }, { status: 500 });
  } finally { client.release(); }
}
