// POST /api/admin/yard/moderate
//
// Per-post moderation actions for the /admin/yard queue. The admin row
// buttons (Hide / Mark spam / Restore / Pin / Unpin) POST here. All
// state changes stamp moderated_at so the moderation history is
// preserved — never null that column after a row has been touched.
//
// Auth: shared xrated_admin_session HMAC cookie via isAdminAuthed().

import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Action = "hide" | "spam" | "restore" | "pin" | "unpin";

function isAction(v: unknown): v is Action {
  return (
    v === "hide" ||
    v === "spam" ||
    v === "restore" ||
    v === "pin" ||
    v === "unpin"
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { post_id?: unknown; action?: unknown; reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id.trim() : "";
  const action = body.action;
  const reason =
    typeof body.reason === "string" ? body.reason.trim() || null : null;

  if (!postId) {
    return NextResponse.json({ error: "Missing post_id" }, { status: 400 });
  }
  if (!isAction(action)) {
    return NextResponse.json(
      { error: "action must be 'hide', 'spam', 'restore', 'pin' or 'unpin'" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { moderated_at: now };

  switch (action) {
    case "hide":
      patch.moderation_status = "hidden";
      if (reason) patch.moderation_reason = reason;
      break;
    case "spam":
      patch.moderation_status = "spam";
      if (reason) patch.moderation_reason = reason;
      break;
    case "restore":
      // Restore = back to live + clear the audit reason (timestamp
      // stays so we can see when it bounced). Reset flag_count to
      // zero so a future flag burst lands clean.
      patch.moderation_status = "live";
      patch.moderation_reason = null;
      patch.flag_count = 0;
      break;
    case "pin":
      patch.is_pinned = true;
      break;
    case "unpin":
      patch.is_pinned = false;
      break;
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update(patch)
    .eq("id", postId)
    .select("id, moderation_status, is_pinned, flag_count")
    .maybeSingle();

  if (upd.error) {
    console.error("[admin/yard/moderate] update failed:", upd.error);
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }
  if (!upd.data) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, post: upd.data });
}
