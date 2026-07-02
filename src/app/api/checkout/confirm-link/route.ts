// POST /api/checkout/confirm-link — called by the cart-success page
// when a customer returns from a Payment Link checkout. We can't
// independently verify the payment (link providers don't always
// webhook us), so the model is "trust the return but mark the order
// link_returned" — the merchant verifies in their own provider
// dashboard. For Stripe/PayPal/Square (Phases 2-5) we'll replace this
// with a proper webhook-verified flip to 'paid'.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyOrderPaid } from "@/lib/notifyOrderPaid";

export const runtime = "nodejs";

type Body = { listing_slug: string; order_ref: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.listing_slug || !body.order_ref) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, payment_provider")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (listing.error || !listing.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  // Payment Link mode can't be webhook-verified. We mark as 'paid' with
  // metadata.note so the merchant knows to verify in their own provider
  // dashboard before fulfilling.
  if (listing.data.payment_provider !== "payment_link") {
    return NextResponse.json(
      { error: "not_payment_link_mode" },
      { status: 400 }
    );
  }
  const upd = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      metadata: { confirmation: "link_return", verify_in_provider_dashboard: true }
    })
    .eq("listing_id", listing.data.id)
    .eq("order_ref", body.order_ref)
    .eq("status", "pending")
    .select("id")
    .single();
  if (upd.error) {
    return NextResponse.json(
      { error: "order_update_failed", detail: upd.error.message },
      { status: 500 }
    );
  }
  // Fire notifications — Payment Link mode's only signal that a payment
  // completed. notifyOrderPaid is idempotent (notified_at guard) so a
  // second call from a manual refresh is harmless.
  await notifyOrderPaid(body.order_ref);
  return NextResponse.json({ ok: true });
}
