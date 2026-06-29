// POST /api/admin/affiliates/review-queue?id=<affiliate_id>
//   body { action: "clear" | "suspend" }
//
// clear   — empties fraud_flags + clears requires_review
// suspend — sets status='suspended' (keeps flags for audit)
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  const url = new URL(req.url);
  const idRaw = url.searchParams.get("id") ?? "";
  const affiliateId = Number(idRaw);
  if (!Number.isFinite(affiliateId) || affiliateId <= 0) {
    return NextResponse.json(
      { ok: false, error: "Invalid affiliate id" },
      { status: 400 }
    );
  }
  let body: { action?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }
  const action = typeof body.action === "string" ? body.action : "";

  if (action === "clear") {
    const upd = await supabaseAdmin
      .from("hammerex_affiliates")
      .update({ fraud_flags: [], requires_review: false })
      .eq("affiliate_id", affiliateId);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "fraud.review.clear",
      target_id: String(affiliateId)
    });
    return NextResponse.json({ ok: true });
  }
  if (action === "suspend") {
    const upd = await supabaseAdmin
      .from("hammerex_affiliates")
      .update({ status: "suspended" })
      .eq("affiliate_id", affiliateId);
    if (upd.error) {
      return NextResponse.json(
        { ok: false, error: upd.error.message },
        { status: 500 }
      );
    }
    await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
      actor_type: "admin",
      actor_id: "admin",
      action: "fraud.review.suspend",
      target_id: String(affiliateId)
    });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(
    { ok: false, error: "Unknown action" },
    { status: 400 }
  );
}
