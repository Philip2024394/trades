// POST /api/webhooks/stripe — Stripe webhook receiver.
//
// Handles connected-account events so we can flip orders to 'paid'
// without polling. Also catches account.updated so we can mirror
// charges_enabled state changes (e.g. merchant completed onboarding,
// merchant restricted for compliance, etc.).
//
// Signature verification: Stripe signs each webhook with a shared
// secret configured in the Stripe dashboard. STRIPE_WEBHOOK_SECRET
// must match. Constant-time verification via stripe.webhooks.
// constructEvent — never manually compare signatures.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyOrderPaid } from "@/lib/notifyOrderPaid";

export const runtime = "nodejs";
// Stripe sends the raw body — we MUST NOT let Next parse it. This
// tells the route to receive the body as-is for signature verification.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const key = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!key || !webhookSecret) {
    return NextResponse.json(
      { error: "stripe_not_configured" },
      { status: 503 }
    );
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }
  const raw = await req.text();
  const stripe = new Stripe(key);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, webhookSecret);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_signature", detail: (e as Error).message },
      { status: 400 }
    );
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderRef = session.client_reference_id ?? session.metadata?.order_ref;
      if (orderRef) {
        const upd = await supabaseAdmin
          .from("hammerex_xrated_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            customer_email: session.customer_details?.email ?? undefined,
            metadata: {
              stripe_session_id: session.id,
              payment_intent: session.payment_intent,
              customer_email: session.customer_details?.email ?? null,
              amount_total_pence: session.amount_total ?? null
            }
          })
          .eq("order_ref", orderRef)
          .eq("status", "pending")
          .select("id");
        // Fire notifications only when the update actually flipped a
        // pending row — prevents duplicate sends on webhook retries.
        if (upd.data && upd.data.length > 0) {
          await notifyOrderPaid(orderRef);
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderRef = session.client_reference_id ?? session.metadata?.order_ref;
      if (orderRef) {
        await supabaseAdmin
          .from("hammerex_xrated_orders")
          .update({
            status: "cancelled",
            cancelled_at: new Date().toISOString()
          })
          .eq("order_ref", orderRef)
          .eq("status", "pending");
      }
    } else if (event.type === "account.updated") {
      // Mirror connected-account capability changes so our
      // hasConfiguredPaymentProvider gate stays accurate.
      const account = event.data.object as Stripe.Account;
      const listing = await supabaseAdmin
        .from("hammerex_trade_off_listings")
        .select("id, payment_provider_data")
        .filter("payment_provider_data->>stripe_account_id", "eq", account.id)
        .maybeSingle();
      if (listing.data) {
        const data = (listing.data.payment_provider_data ?? {}) as Record<string, unknown>;
        await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .update({
            payment_provider_data: {
              ...data,
              charges_enabled: account.charges_enabled === true,
              payouts_enabled: account.payouts_enabled === true,
              details_submitted: account.details_submitted === true,
              status: account.charges_enabled === true ? "ready" : "pending_onboarding",
              refreshed_at: new Date().toISOString()
            }
          })
          .eq("id", listing.data.id);
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json(
      { error: "webhook_handler_error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
