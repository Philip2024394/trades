// GET /api/trade-off/yard/count-since?since=<iso>
//
// Cheap poll target for the Yard "N new posts" ribbon. Returns the
// count of live, non-expired, non-hidden yard posts created strictly
// after the client's initial load timestamp. Client passes the ISO
// timestamp of when the page was rendered; this endpoint answers
// "how much has changed since then?"
//
// No auth. Read-only. 15s CDN cache — even at scale this is a
// count(head) call to Postgres and irrelevant to hot paths.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since") ?? "";
  const sinceMs = Date.parse(since);
  if (!Number.isFinite(sinceMs) || sinceMs <= 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_since" },
      { status: 400 }
    );
  }

  const { count, error } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id", { count: "exact", head: true })
    .eq("status", "live")
    .is("parent_id", null)
    .not("moderation_status", "in", '("hidden","spam")')
    .gt("expires_at", new Date().toISOString())
    .gt("created_at", new Date(sinceMs).toISOString());

  if (error) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, count: count ?? 0 },
    {
      headers: {
        "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30"
      }
    }
  );
}
