// GET /api/cron/yard-expire-notifications
//
// Daily: hard-delete targeted notifications past their expires_at.
// Called by Vercel cron. Uses the SQL function created in the yard v2
// migration — one round-trip, no cursor pagination needed.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // Delete directly — no need for the RPC round-trip. Bounded by the
  // where clause; PostgreSQL handles the actual work in one statement.
  const { error, count } = await supabaseAdmin
    .from("hammerex_yard_targeted_notifications")
    .delete({ count: "exact" })
    .lt("expires_at", new Date().toISOString());

  if (error) {
    return NextResponse.json(
      { ok: false, error: "delete_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, deleted: count ?? 0 });
}
