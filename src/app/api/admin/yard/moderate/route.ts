// POST /api/admin/yard/moderate
//
// Per-post moderation actions for the /admin/yard queue. The admin row
// buttons (Hide / Mark spam / Restore / Pin / Unpin) POST here. All
// state changes stamp moderated_at so the moderation history is
// preserved — never null that column after a row has been touched.
//
// Auth: shared xrated_admin_session HMAC cookie via isAdminAuthed().

import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { writeAuditLog, extractRequestContext } from "@/lib/admin/auditLog";
import { assertAdminRole } from "@/lib/admin/rbac";

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
  // RBAC — moderation is allowed for both 'admin' and 'moderator' roles.
  // Analyst / support / finance cannot moderate.
  const auth = await assertAdminRole(["admin", "moderator"]);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const actor = auth.identity;

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

  // Snapshot before-state for audit log (Rule 3 non-destructive-restore)
  const beforeRes = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, moderation_status, moderation_reason, is_pinned, flag_count, title, trade_slug")
    .eq("id", postId)
    .maybeSingle();
  const before = beforeRes.data as { id: string; moderation_status: string | null; moderation_reason: string | null; is_pinned: boolean; flag_count: number; title: string; trade_slug: string | null } | null;

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

  // Audit log — fire-and-forget (never blocks the response)
  const { ipAddress, userAgent } = extractRequestContext(req);
  void writeAuditLog({
    actorAdminId: actor.adminId,
    actorEmail:   actor.email,
    actorKind:    actor.role,
    action:       `yard.post.${action}`,
    targetType:   "yard_post",
    targetId:     postId,
    targetSlug:   before?.trade_slug ?? null,
    beforeState:  before ? { moderation_status: before.moderation_status, moderation_reason: before.moderation_reason, is_pinned: before.is_pinned, flag_count: before.flag_count, title: before.title } : null,
    afterState:   { ...patch },
    reason,
    ipAddress,
    userAgent
  });

  return NextResponse.json({ ok: true, post: upd.data });
}
