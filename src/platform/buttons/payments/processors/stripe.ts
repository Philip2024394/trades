// Stripe processor — real Checkout Session via the official SDK.
//
// Credentials required:
//   secret_key       — sk_live_… (required)
//   webhook_secret   — whsec_… (required for webhook verification)
//
// The client redirects to session.url; on success/cancel the customer
// lands on returnUrl / cancelUrl. The webhook posts checkout.session.completed
// which flips the order to 'paid'.

import Stripe from "stripe";
import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const processor: PaymentProcessor = {
  providerId: "stripe",
  async createSession(req, credentials) {
    const secretKey = credentials.secret_key as string | undefined;
    if (!secretKey) {
      return { kind: "error", error: "Stripe secret_key missing" };
    }
    const stripe = new Stripe(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: req.currency.toLowerCase(),
            product_data: {
              name: req.description ?? req.orderRef
            },
            unit_amount: req.amountMinor
          },
          quantity: 1
        }
      ],
      customer_email: req.customerEmail,
      client_reference_id: req.orderRef,
      success_url: req.returnUrl,
      cancel_url: req.cancelUrl,
      metadata: {
        orderRef: req.orderRef,
        brandId: req.brandId,
        ...toStringMetadata(req.metadata ?? {})
      }
    });
    if (!session.url) {
      return { kind: "error", error: "Stripe session had no url" };
    }
    return {
      kind: "redirect",
      checkoutUrl: session.url,
      externalRef: session.id
    };
  },

  async verifyAndParseWebhook(rawBody, headers, credentials) {
    const secretKey = credentials.secret_key as string | undefined;
    const whSecret = credentials.webhook_secret as string | undefined;
    if (!secretKey || !whSecret) {
      return { kind: "error", error: "Stripe webhook secret missing" };
    }
    const stripe = new Stripe(secretKey);
    const sig = headers.get("stripe-signature");
    if (!sig) return { kind: "ignore", reason: "no-stripe-signature" };
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, whSecret);
    } catch (err) {
      return { kind: "error", error: (err as Error).message };
    }
    if (event.type === "checkout.session.completed") {
      const s = event.data.object as Stripe.Checkout.Session;
      return {
        kind: "update",
        externalRef: s.id,
        status: s.payment_status === "paid" ? "paid" : "pending",
        metadata: { stripeEventId: event.id }
      };
    }
    if (event.type === "checkout.session.expired") {
      const s = event.data.object as Stripe.Checkout.Session;
      return { kind: "update", externalRef: s.id, status: "cancelled" };
    }
    if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      // Best-effort: map back via metadata orderRef; if not available,
      // ignore since we key by session id.
      const ref = (pi.metadata as Record<string, string>)?.orderRef;
      if (!ref) return { kind: "ignore", reason: "no-orderRef-in-pi" };
      return { kind: "update", externalRef: ref, status: "failed" };
    }
    return { kind: "ignore", reason: `unhandled-event-${event.type}` };
  }
};

function toStringMetadata(m: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(m)) {
    if (typeof v === "string") out[k] = v;
    else out[k] = JSON.stringify(v);
  }
  return out;
}

paymentProcessors.register(processor);
