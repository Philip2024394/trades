// POST /api/admin/reviews/[id]/status
//
// Sets the moderation status on a review. Body: { status, action_reason? }.
//   'live'    — publish immediately. Also stamps admin_marked_safe_at
//               and clamps goes_live_at = now() so the public profile
//               picks it up on the next request (no caching deferred
//               behind the 24h cool-down).
//   'hidden'  — pull from public view. Reviews stay in the DB; admin
//               can Restore via status='live'.
//   'flagged' — keep visible but tag for follow-up.
//
// Auth: shared xrated_admin_session HMAC cookie via isAdminAuthed().

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminStatus = "live" | "hidden" | "flagged";

function isAdminStatus(v: unknown): v is AdminStatus {
  return v === "live" || v === "hidden" || v === "flagged";
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  let body: { status?: unknown; action_reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isAdminStatus(body.status)) {
    return NextResponse.json(
      { error: "status must be 'live', 'hidden' or 'flagged'" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: body.status };
  if (body.status === "live") {
    // Mark Safe — publish immediately. Stamping admin_marked_safe_at
    // gives us audit trail; clamping goes_live_at means the public
    // carousel (which filters on goes_live_at <= now()) picks the
    // review up on the next page render, no cron wait.
    patch.admin_marked_safe_at = now;
    patch.goes_live_at = now;
  }
  if (typeof body.action_reason === "string") {
    const reason = body.action_reason.trim();
    if (reason) patch.admin_action_reason = reason;
  }

  const upd = await supabaseAdmin
    .from("hammerex_xrated_reviews")
    .update(patch)
    .eq("id", id)
    .select("id, status")
    .maybeSingle();
  if (upd.error) {
    console.error("[admin/reviews/status] update failed:", upd.error);
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, review: upd.data });
}
