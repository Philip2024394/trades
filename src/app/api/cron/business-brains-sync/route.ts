// GET /api/cron/business-brains-sync
//
// Scheduled every hour by Vercel. Finds every Business Brain whose
// next_sync_due_at has passed (and whose sync_frequency != "manual")
// and runs the sync. Runs are serialised to keep the crawler polite.
//
// Auth: expects the standard CRON_SECRET bearer header — anyone
// bypassing that gets a 401. Vercel supplies the header automatically
// for cron-triggered invocations.

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { runBrainSync } from "@/lib/business-brains/_sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const bearer = req.headers.get("authorization") ?? "";
  const secret = process.env.CRON_SECRET;
  if (!secret || bearer !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("business_brains")
    .select("id, next_sync_due_at, sync_frequency, status")
    .neq("sync_frequency", "manual")
    .neq("status", "paused")
    .lte("next_sync_due_at", nowIso)
    .limit(10);   // hard cap per tick — brains left over roll into the next hour

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  const rows = (data ?? []) as Array<{ id: string }>;

  const results: Array<{ brainId: string; ok: boolean; error?: string; pagesCrawled?: number }> = [];
  for (const row of rows) {
    try {
      const r = await runBrainSync({ brainId: row.id, triggeredBy: "cron" });
      results.push({ brainId: row.id, ok: true, pagesCrawled: r.pagesCrawled });
    } catch (err) {
      results.push({ brainId: row.id, ok: false, error: err instanceof Error ? err.message : "sync_failed" });
    }
  }

  return NextResponse.json({ ok: true, ran: results.length, results });
}
