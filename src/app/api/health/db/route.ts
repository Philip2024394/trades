// GET /api/health/db — Supabase read latency + connection state.
//
// Issues a lightweight COUNT query against a known-small table and
// records the round-trip time. Anything over 500ms is 'degraded',
// error or timeout is 'down'. Powers the "Supabase · DB" tile on
// /admin/red-zone.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    const { error } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("id", { count: "exact", head: true });
    const elapsed = Date.now() - startedAt;
    if (error) {
      return NextResponse.json({
        ok: false,
        status: "down",
        detail: `DB error: ${error.message}`,
        elapsedMs: elapsed,
        checkedAt: new Date().toISOString()
      });
    }
    return NextResponse.json({
      ok: true,
      status: elapsed > 500 ? "degraded" : "operational",
      detail: `Read/write · ${elapsed}ms`,
      elapsedMs: elapsed,
      checkedAt: new Date().toISOString()
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      status: "down",
      detail: `DB threw: ${e instanceof Error ? e.message : String(e)}`,
      elapsedMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString()
    });
  }
}
