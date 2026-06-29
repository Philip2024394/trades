// PATCH /api/admin/affiliates/commissions/[id] — update a commission's
// status. Stamps approved_at / paid_at when transitioning.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { recomputeAffiliateLevel } from "@/lib/affiliateLevel";

export const runtime = "nodejs";

const ALLOWED = new Set(["pending", "approved", "paid", "cancelled", "refunded"]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  const { id } = await params;
  let body: { status?: unknown; cancelled_reason?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!ALLOWED.has(status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid status" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "approved") patch.approved_at = now;
  if (status === "paid") patch.paid_at = now;
  if (status === "cancelled" && typeof body.cancelled_reason === "string") {
    patch.cancelled_reason = body.cancelled_reason.slice(0, 200);
  }

  const upd = await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .update(patch)
    .eq("id", id)
    .select("affiliate_id, amount_pence")
    .maybeSingle();
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: `commission.${status}`,
    target_id: id
  });

  // Level recompute on every paid transition. Fire-and-forget — the
  // helper swallows its own errors so we never fail the PATCH on a
  // downstream email hiccup.
  if (status === "paid" && upd.data?.affiliate_id) {
    await recomputeAffiliateLevel(upd.data.affiliate_id);
  }

  return NextResponse.json({ ok: true });
}
