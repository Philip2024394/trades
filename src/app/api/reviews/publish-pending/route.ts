// POST /api/reviews/publish-pending
//
// The 72h cool-off gate. Flips pending reviews to published when
// their publish_at has passed AND admin hasn't frozen or removed them.
// Idempotent — safe to call every minute from any scheduler
// (Vercel cron, GitHub Actions, external uptime robot).
//
// Auth: CRON_SECRET header must match process.env.CRON_SECRET. Set
// the same value in both places and rotate periodically.
//
// Response contract:
//   200 { ok: true, published: number }
//   401 { ok: false, error: "unauthorized" }
//   500 { ok: false, error: "db-*", detail?: string }

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("x-cron-secret") ?? req.headers.get("authorization");
  const providedSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : authHeader;

  if (!cronSecret) {
    // Fail-safe: refuse to run when the secret isn't configured. Never
    // leave the cron endpoint fully open.
    return NextResponse.json({ ok: false, error: "cron-secret-not-configured" }, { status: 500 });
  }
  if (providedSecret !== cronSecret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  // Find rows that are ripe. Admin action is checked here (not just at
  // insert-time) so a mid-window admin freeze takes effect immediately.
  const readyRes = await supabaseAdmin
    .from("hammerex_network_reviews")
    .select("id")
    .eq("status", "pending")
    .lte("publish_at", nowIso)
    .or("admin_action.is.null,admin_action.eq.verified");

  if (readyRes.error) {
    return NextResponse.json(
      { ok: false, error: "db-read-failed", detail: readyRes.error.message },
      { status: 500 }
    );
  }

  const ids = (readyRes.data ?? []).map((r) => r.id as string);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, published: 0 });
  }

  const updateRes = await supabaseAdmin
    .from("hammerex_network_reviews")
    .update({ status: "published" })
    .in("id", ids);

  if (updateRes.error) {
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: updateRes.error.message },
      { status: 500 }
    );
  }

  // Emit a published event per row. Fire-and-forget batch — the row
  // update is the source of truth.
  const events = ids.map((review_id) => ({
    review_id,
    kind: "published" as const,
    actor: "system" as const,
    actor_slug: "cron",
    note: "72h window elapsed"
  }));
  await supabaseAdmin.from("hammerex_network_review_events").insert(events);

  return NextResponse.json({ ok: true, published: ids.length });
}
