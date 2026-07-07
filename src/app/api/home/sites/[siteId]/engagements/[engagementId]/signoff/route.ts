// POST /api/home/sites/[siteId]/engagements/[engagementId]/signoff
//
// Owner or finance role only. Marks the engagement as signed_off and
// auto-creates the final payment record for the balance owed
// (agreed_total minus deposits already recorded). Everything atomic-ish
// and audit-logged.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireHomeownerSession } from "@/lib/os/homeownerSession";
import { requireActiveMembership } from "@/lib/os/entitySession";
import { hasFinancialAccess } from "@/lib/os/entities";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { siteId: string; engagementId: string };

export async function POST(
  request: Request,
  ctx: { params: Promise<Params> }
) {
  let party;
  try {
    party = await requireHomeownerSession();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  let membership;
  try {
    membership = await requireActiveMembership();
  } catch {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }
  if (!hasFinancialAccess(membership)) {
    return NextResponse.json(
      { ok: false, error: "no_financial_access" },
      { status: 403 }
    );
  }

  const { siteId, engagementId } = await ctx.params;

  const { data: engagement } = await supabaseAdmin
    .from("os_site_engagements")
    .select(
      "id, status, agreed_price_pence, business_id, owner_entity_id, hired_display_name"
    )
    .eq("id", engagementId)
    .eq("site_id", siteId)
    .maybeSingle();

  if (!engagement || engagement.owner_entity_id !== membership.entity_id) {
    return NextResponse.json(
      { ok: false, error: "engagement_not_found" },
      { status: 404 }
    );
  }

  if (!["completed", "in_progress", "accepted"].includes(engagement.status)) {
    return NextResponse.json(
      {
        ok: false,
        error: "invalid_state",
        detail: `Cannot sign off from ${engagement.status}`
      },
      { status: 400 }
    );
  }

  let body: {
    method?: string;
    reference?: string;
    note?: string;
    override_final_amount?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  // Compute the balance owed: agreed_price - deposits already paid.
  const { data: priorPayments } = await supabaseAdmin
    .from("os_project_payments")
    .select("amount_pence, status, payment_type")
    .eq("engagement_id", engagementId)
    .neq("status", "cancelled");
  const priorPaidPence = (priorPayments ?? []).reduce(
    (sum, p) =>
      sum +
      (p.status === "both_confirmed" || p.status === "recorded"
        ? p.amount_pence
        : 0),
    0
  );

  let finalAmountPence: number | null = null;
  if (typeof body.override_final_amount === "number") {
    finalAmountPence = Math.round(body.override_final_amount * 100);
  } else if (engagement.agreed_price_pence) {
    finalAmountPence = Math.max(0, engagement.agreed_price_pence - priorPaidPence);
  }

  let paymentId: string | null = null;
  if (finalAmountPence && finalAmountPence > 0) {
    const { data: paymentRow, error: payErr } = await supabaseAdmin
      .from("os_project_payments")
      .insert({
        engagement_id: engagementId,
        from_party_id: party.id,
        paying_entity_id: membership.entity_id,
        to_business_id: engagement.business_id,
        amount_pence: finalAmountPence,
        currency: "GBP",
        payment_method: body.method || "bank_transfer",
        payment_type: "final",
        payment_reference: body.reference || null,
        notes: body.note || `Final payment on sign-off — ${engagement.hired_display_name}`,
        status: "both_confirmed",
        paid_at: new Date().toISOString(),
        homeowner_confirmed_at: new Date().toISOString(),
        homeowner_confirmed_by_party_id: party.id
      })
      .select("id")
      .single();
    if (payErr) {
      return NextResponse.json(
        {
          ok: false,
          error: "payment_create_failed",
          detail: payErr.message
        },
        { status: 500 }
      );
    }
    paymentId = paymentRow.id;
  }

  const { error: updErr } = await supabaseAdmin
    .from("os_site_engagements")
    .update({
      status: "signed_off",
      signed_off_at: new Date().toISOString(),
      signed_off_by_party_id: party.id,
      final_payment_id: paymentId
    })
    .eq("id", engagementId);

  if (updErr) {
    return NextResponse.json(
      { ok: false, error: "update_failed", detail: updErr.message },
      { status: 500 }
    );
  }

  await supabaseAdmin.from("os_entity_audit_events").insert({
    entity_id: membership.entity_id,
    actor_party_id: party.id,
    verb: "engagement.signed_off",
    after_state: {
      engagement_id: engagementId,
      hired: engagement.hired_display_name,
      final_amount_pence: finalAmountPence,
      payment_id: paymentId
    }
  });

  return NextResponse.json({
    ok: true,
    paymentId,
    finalAmountPence,
    priorPaidPence
  });
}
