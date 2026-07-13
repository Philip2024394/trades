// GET /api/cron/yard-release-queued
//
// Every 10 minutes: promote queued Yard posts whose scheduled_release_at
// has passed → status='live'. Called by Vercel cron.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const nowIso = new Date().toISOString();

  // Fetch a batch of due posts (cap to avoid runaway inserts).
  const { data: dueRows, error: qErr } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id")
    .eq("status", "queued")
    .not("scheduled_release_at", "is", null)
    .lte("scheduled_release_at", nowIso)
    .limit(200);

  if (qErr) {
    return NextResponse.json(
      { ok: false, error: "query_failed", detail: qErr.message },
      { status: 500 }
    );
  }

  const ids = (dueRows ?? []).map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, promoted: 0 });
  }

  const { error: uErr } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update({ status: "live" })
    .in("id", ids);

  if (uErr) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: uErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, promoted: ids.length });
}
