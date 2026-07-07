// OS Billing — Stripe client + webhook signature verification.
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

export function stripeClient(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  cached = new Stripe(key, {
    apiVersion: "2025-02-24.acacia",
    typescript: true
  });
  return cached;
}

export function stripeWebhookSecret(): string {
  const s = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }
  return s;
}

/** Verify + parse a Stripe webhook body. Throws on invalid signature. */
export function constructWebhookEvent(
  rawBody: string,
  signatureHeader: string
): Stripe.Event {
  return stripeClient().webhooks.constructEvent(
    rawBody,
    signatureHeader,
    stripeWebhookSecret()
  );
}
