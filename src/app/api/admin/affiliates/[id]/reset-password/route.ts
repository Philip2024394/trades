// POST /api/admin/affiliates/[id]/reset-password — admin generates a
// new random password, stores its bcrypt hash, returns the plaintext
// so the admin can forward it via WhatsApp or email. The temporary
// password is single-use in spirit — the affiliate should rotate it
// from the dashboard once logged in (Phase 2: enforce that).
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function tempPassword(): string {
  return (
    Math.random().toString(36).slice(2, 6) +
    Math.random().toString(36).slice(2, 6)
  );
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { ok: false, error: "Invalid ID" },
      { status: 400 }
    );
  }
  const newPassword = tempPassword();
  const hash = await bcrypt.hash(newPassword, 10);
  const upd = await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ password_hash: hash })
    .eq("affiliate_id", id);
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: "affiliate.reset_password",
    target_id: String(id)
  });
  return NextResponse.json({ ok: true, temporary_password: newPassword });
}
