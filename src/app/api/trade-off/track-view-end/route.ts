// POST /api/trade-off/track-view-end
// Closes a view row: sets ended_at = now() and computes duration_seconds.
//
// RLS on hammerex_xrated_views restricts UPDATE to rows where ended_at is
// null, so once a row is closed it can't be overwritten. Best-effort: any
// failure returns { ok: false } with HTTP 200.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      // sendBeacon sends as text/plain by default — fall back to raw text.
      try {
        const raw = await req.text();
        body = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        return NextResponse.json({ ok: false });
      }
    }

    const view_id =
      typeof body.view_id === "string" && body.view_id.trim().length > 0
        ? body.view_id.trim()
        : "";
    if (!view_id) {
      return NextResponse.json({ ok: false });
    }

    // Fetch viewed_at so we can compute duration. RLS allows service role
    // to SELECT; the public update policy only checks ended_at is null.
    const existing = await supabaseAdmin
      .from("hammerex_xrated_views")
      .select("id, viewed_at, ended_at")
      .eq("id", view_id)
      .maybeSingle();

    if (!existing.data || existing.data.ended_at) {
      // Already closed (or not found) — no-op so duplicate beacons don't
      // overwrite. The RLS UPDATE check would block this anyway.
      return NextResponse.json({ ok: false });
    }

    const endedAtMs = Date.now();
    const viewedAtMs = new Date(existing.data.viewed_at).getTime();
    const duration_seconds = Number.isFinite(viewedAtMs)
      ? Math.max(0, Math.floor((endedAtMs - viewedAtMs) / 1000))
      : null;

    const update = await supabaseAdmin
      .from("hammerex_xrated_views")
      .update({
        ended_at: new Date(endedAtMs).toISOString(),
        duration_seconds
      })
      .eq("id", view_id)
      .is("ended_at", null);

    if (update.error) {
      return NextResponse.json({ ok: false });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
