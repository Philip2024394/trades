// POST /api/admin/affiliates/password-recovery/sent
//
// Called by the admin queue when the operator clicks "Send via
// WhatsApp". Stamps password_recovery_sent_at so:
//   1. The row leaves the pending queue (partial index excludes it).
//   2. The recovery_code becomes redeemable at /affiliates/set-password
//      (the queue-snooping guard requires sent_at IS NOT NULL).
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: { affiliate_id?: unknown };
  try {
    body = (await req.json()) as { affiliate_id?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const id = Number(body.affiliate_id);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Missing affiliate_id" }, { status: 400 });
  }
  const upd = await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ password_recovery_sent_at: new Date().toISOString() })
    .eq("affiliate_id", id)
    .not("password_recovery_requested_at", "is", null);
  if (upd.error) {
    return NextResponse.json(
      { error: `Update failed: ${upd.error.message}` },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: "password_recovery.sent",
    target_id: String(id)
  });
  return NextResponse.json({ ok: true });
}
