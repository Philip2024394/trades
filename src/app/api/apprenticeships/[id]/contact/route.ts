// POST /api/apprenticeships/[id]/contact
// Trade action: reveal an apprentice's WhatsApp contact by spending
// 1 washer. Idempotent — if the trade has already paid to contact
// this apprentice, the endpoint returns the contact without a
// second debit.
//
// Requires: merchant session (network cookie or dev stub).

import { NextResponse } from "next/server";
import { supabaseAdmin }    from "@/lib/supabaseAdmin";
import { spendWashers }     from "@/lib/washers";
import { getMerchantSlug }  from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPRENTICE_CONTACT_COST = 1;

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: requestId } = await params;

  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug) {
    return NextResponse.json({ ok: false, error: "auth-required" }, { status: 401 });
  }

  // Confirm the apprenticeship request exists + is still live.
  const req = await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .select("id, full_name, whatsapp, city, trade_slug, status, contact_count")
    .eq("id", requestId)
    .single();
  if (req.error || !req.data)  return NextResponse.json({ ok: false, error: "request-not-found" }, { status: 404 });
  if (req.data.status !== "live") return NextResponse.json({ ok: false, error: "request-not-live" }, { status: 410 });

  // Idempotency: if this merchant already contacted this apprentice,
  // return the contact without spending again.
  const existing = await supabaseAdmin
    .from("hammerex_apprenticeship_contacts")
    .select("id, washer_transaction_id, created_at")
    .eq("request_id", requestId)
    .eq("merchant_slug", merchantSlug)
    .maybeSingle();
  if (existing.data) {
    return NextResponse.json({
      ok:       true,
      alreadyPaid: true,
      contact:  { fullName: req.data.full_name, whatsapp: req.data.whatsapp, city: req.data.city },
      cost:     0
    });
  }

  // Debit the washer.
  const spend = await spendWashers({
    merchantSlug,
    amount: APPRENTICE_CONTACT_COST,
    source: "apprentice-contact",
    detail: { request_id: requestId, trade: req.data.trade_slug, city: req.data.city }
  });

  if (!spend.ok) {
    if (spend.reason === "insufficient-balance") {
      return NextResponse.json({
        ok: false, error: "insufficient-balance",
        balance: spend.balance ?? 0,
        cost:    APPRENTICE_CONTACT_COST
      }, { status: 402 });
    }
    return NextResponse.json({ ok: false, error: spend.reason }, { status: 500 });
  }

  // Record the contact ledger row + bump contact_count on request.
  await supabaseAdmin.from("hammerex_apprenticeship_contacts").insert({
    request_id:            requestId,
    merchant_slug:         merchantSlug,
    washer_transaction_id: spend.transactionId
  });
  await supabaseAdmin
    .from("hammerex_apprenticeship_requests")
    .update({ contact_count: (req.data.contact_count ?? 0) + 1 })
    .eq("id", requestId);

  return NextResponse.json({
    ok:       true,
    contact:  { fullName: req.data.full_name, whatsapp: req.data.whatsapp, city: req.data.city },
    cost:     APPRENTICE_CONTACT_COST,
    balance:  spend.balance
  });
}
