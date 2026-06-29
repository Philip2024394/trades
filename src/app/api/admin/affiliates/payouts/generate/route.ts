// POST /api/admin/affiliates/payouts/generate — create a payout row
// for an affiliate and stamp the matching commissions with payout_id.
import { NextResponse, type NextRequest } from "next/server";
import { isAdminAuthed } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAdminAuthed())) {
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 }
    );
  }
  let body: {
    affiliate_id?: unknown;
    commission_ids?: unknown;
    total_pence?: unknown;
    period_month?: unknown;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON" },
      { status: 400 }
    );
  }
  const affiliate_id = Number(body.affiliate_id);
  const total_pence = Number(body.total_pence);
  const commission_ids = Array.isArray(body.commission_ids)
    ? (body.commission_ids as unknown[]).filter(
        (x): x is string => typeof x === "string"
      )
    : [];
  const period_month =
    typeof body.period_month === "string" ? body.period_month : "";

  if (
    !Number.isFinite(affiliate_id) ||
    !Number.isFinite(total_pence) ||
    commission_ids.length === 0 ||
    !/^\d{4}-\d{2}$/.test(period_month)
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid payload" },
      { status: 400 }
    );
  }

  const ins = await supabaseAdmin
    .from("hammerex_affiliate_payouts")
    .insert({
      affiliate_id,
      total_pence,
      commission_ids,
      status: "pending",
      period_month
    })
    .select("id")
    .maybeSingle();
  if (ins.error || !ins.data) {
    return NextResponse.json(
      { ok: false, error: ins.error?.message ?? "Insert failed" },
      { status: 500 }
    );
  }
  await supabaseAdmin
    .from("hammerex_affiliate_commissions")
    .update({ payout_id: ins.data.id })
    .in("id", commission_ids);
  await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
    actor_type: "admin",
    actor_id: "admin",
    action: "payout.generate",
    target_id: ins.data.id,
    details: { affiliate_id, total_pence, commission_ids }
  });
  return NextResponse.json({ ok: true, payout_id: ins.data.id });
}
