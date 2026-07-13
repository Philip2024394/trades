// GET /api/activity/public
//
// Anonymised activity events for the logged-out landing widget.
// Returns the most recent public events (comments trending, projects
// posted, trades joining, tier upgrades) — the "the platform is
// alive" social-proof feed.
//
// No auth. Read-only. Filters out expired rows. Response is cached
// for 30 seconds at the edge — fresh enough to feel live, cheap
// enough that a viral landing page doesn't crush the DB.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("os_activity_events")
    .select(
      "id, kind, subject_type, subject_id, summary_text, action_url, source_display_name, source_trade, source_city, created_at"
    )
    .eq("is_public", true)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, events: data ?? [] },
    {
      headers: {
        "Cache-Control":
          "public, s-maxage=30, stale-while-revalidate=120"
      }
    }
  );
}
