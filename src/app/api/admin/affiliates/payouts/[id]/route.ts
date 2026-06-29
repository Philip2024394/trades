// PATCH /api/admin/affiliates/payouts/[id] — mark a payout as paid +
// flip the linked commissions to status='paid'. Also sends the
// commission-paid email to the affiliate if their email is on file.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendCommissionPaidEmail } from "@/lib/affiliateEmails";
import { recomputeAffiliateLevel } from "@/lib/affiliateLevel";

export const runtime = "nodejs";

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
  let body: { status?: unknown; reference?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const status = typeof body.status === "string" ? body.status : "";
  if (!["pending", "paid", "failed"].includes(status)) {
    return NextResponse.json(
      { ok: false, error: "Invalid status" },
      { status: 400 }
    );
  }
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch.paid_at = now;
  if (typeof body.reference === "string") {
    patch.reference = body.reference.slice(0, 120);
  }

  const upd = await supabaseAdmin
    .from("hammerex_affiliate_payouts")
    .update(patch)
    .eq("id", id)
    .select("id, affiliate_id, total_pence, commission_ids, reference")
    .maybeSingle();
  if (upd.error || !upd.data) {
    return NextResponse.json(
      { ok: false, error: upd.error?.message ?? "Update failed" },
      { status: 500 }
    );
  }

  if (status === "paid") {
    await supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .update({ status: "paid", paid_at: now, paid_method: "manual" })
      .in("id", upd.data.commission_ids);

    // Best-effort email.
    const { data: aff } = await supabaseAdmin
      .from("hammerex_affiliates")
      .select("affiliate_id, email")
      .eq("affiliate_id", upd.data.affiliate_id)
      .maybeSingle();
    if (aff?.email) {
      await sendCommissionPaidEmail(
        { affiliate_id: aff.affiliate_id, email: aff.email },
        { total_pence: upd.data.total_pence, reference: upd.data.reference }
      );
    }

    // Recompute level — newly-paid commissions may have crossed a tier.
    await recomputeAffiliateLevel(upd.data.affiliate_id);
  }

  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: `payout.${status}`,
    target_id: id
  });

  return NextResponse.json({ ok: true });
}
