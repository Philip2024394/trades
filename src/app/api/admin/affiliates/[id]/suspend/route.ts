import { NextResponse } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "Invalid ID" }, { status: 400 });
  }
  const upd = await supabaseAdmin
    .from("hammerex_affiliates")
    .update({ status: "suspended" })
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
    action: "affiliate.suspend",
    target_id: String(id)
  });
  return NextResponse.json({ ok: true });
}
