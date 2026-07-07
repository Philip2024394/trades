// POST /api/trade/payments/[paymentId]/confirm  (body: { action: 'confirm' | 'dispute' })
//
// Trade-side confirmation of a payment. Promotes `recorded` payments
// to `both_confirmed` when the trade taps confirm. Sets
// merchant_confirmed_at + merchant_confirmed_by_party_id for provenance.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireTradeSession } from "@/lib/os/tradeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { paymentId: string };

export async function POST(request: Request, ctx: { params: Promise<Params> }) {
  let trade;
  try {
    trade = await requireTradeSession();
  } catch {
    return NextResponse.json(
      { ok: false, error: "not_authenticated" },
      { status: 401 }
    );
  }

  const { paymentId } = await ctx.params;

  const { data: payment } = await supabaseAdmin
    .from("os_project_payments")
    .select(
      "id, to_business_id, status, paying_entity_id, amount_pence"
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment || payment.to_business_id !== trade.primaryListingId) {
    return NextResponse.json(
      { ok: false, error: "payment_not_found" },
      { status: 404 }
    );
  }

  let body: { action?: string; reason?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  const action = (body.action ?? "confirm").trim();

  if (action === "confirm") {
    if (payment.status === "both_confirmed") {
      return NextResponse.json({ ok: true, alreadyConfirmed: true });
    }
    if (payment.status !== "recorded") {
      return NextResponse.json(
        {
          ok: false,
          error: "invalid_state",
          detail: `Cannot confirm from ${payment.status}`
        },
        { status: 400 }
      );
    }
    await supabaseAdmin
      .from("os_project_payments")
      .update({
        status: "both_confirmed",
        merchant_confirmed_at: new Date().toISOString(),
        merchant_confirmed_by_party_id: trade.party.id
      })
      .eq("id", paymentId);

    if (payment.paying_entity_id) {
      await supabaseAdmin.from("os_entity_audit_events").insert({
        entity_id: payment.paying_entity_id,
        actor_party_id: trade.party.id,
        verb: "payment.trade_confirmed",
        after_state: { payment_id: paymentId, amount_pence: payment.amount_pence }
      });
    }
    return NextResponse.json({ ok: true, status: "both_confirmed" });
  }

  if (action === "dispute") {
    await supabaseAdmin
      .from("os_project_payments")
      .update({ status: "disputed" })
      .eq("id", paymentId);

    if (payment.paying_entity_id) {
      await supabaseAdmin.from("os_entity_audit_events").insert({
        entity_id: payment.paying_entity_id,
        actor_party_id: trade.party.id,
        verb: "payment.trade_disputed",
        after_state: {
          payment_id: paymentId,
          amount_pence: payment.amount_pence,
          reason: body.reason ?? null
        }
      });
    }
    return NextResponse.json({ ok: true, status: "disputed" });
  }

  return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
}
