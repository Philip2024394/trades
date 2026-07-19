// POST /api/store/stripe-webhook
//
// Signature-verified via STRIPE_STORE_WEBHOOK_SECRET.
//
// Handles:
//   • checkout.session.completed        — marks Store orders paid
//                                          OR sets initial membership
//                                          active + period_end
//   • customer.subscription.updated     — status + period_end sync
//   • customer.subscription.deleted     — mark canceled
//
// The webhook is idempotent — every event handler is safe to replay.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const stripe = getStripe();
  const sig    = req.headers.get("stripe-signature") ?? "";
  const secret = process.env.STRIPE_STORE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "webhook-secret-missing" }, { status: 500 });
  }
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret);
  } catch (err) {
    return NextResponse.json({ ok: false, error: "invalid-signature", detail: (err as Error).message }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // One-off pack/single order → mark paid.
      const orderId = session.metadata?.orderId;
      if (orderId) {
        await supabaseAdmin
          .from("hammerex_store_orders")
          .update({ paid: true, paid_at: new Date().toISOString(), stripe_session_id: session.id })
          .eq("id", orderId);
      }

      // Subscription checkout → resolve subscription + activate row.
      const membershipId = session.metadata?.membershipId;
      if (membershipId && session.subscription) {
        const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        const sub   = await stripe.subscriptions.retrieve(subId);
        await supabaseAdmin
          .from("hammerex_store_memberships")
          .update({
            status:                 sub.status === "active" || sub.status === "trialing" ? "active" : sub.status,
            stripe_customer_id:     typeof sub.customer === "string" ? sub.customer : sub.customer.id,
            stripe_subscription_id: sub.id,
            current_period_end:     new Date(sub.current_period_end * 1000).toISOString(),
            updated_at:             new Date().toISOString()
          })
          .eq("id", membershipId);
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const status: "active" | "past_due" | "canceled" | "expired" =
        sub.status === "active" || sub.status === "trialing" ? "active" :
        sub.status === "past_due" || sub.status === "unpaid" ? "past_due" :
        sub.status === "canceled" ? "canceled" :
        "expired";
      await supabaseAdmin
        .from("hammerex_store_memberships")
        .update({
          status,
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          updated_at:         new Date().toISOString()
        })
        .eq("stripe_subscription_id", sub.id);
      break;
    }
    default:
      // ignore unrelated events
      break;
  }

  return NextResponse.json({ ok: true, received: true });
}
