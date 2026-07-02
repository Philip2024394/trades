// Platform-level Stripe integration for plant hire bookings.
//
// TO ACTIVATE IN PRODUCTION set the following environment variables:
//   STRIPE_SECRET_KEY        — server-only, sk_live_… or sk_test_…
//   STRIPE_WEBHOOK_SECRET    — for verifying incoming webhook payloads
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  — currently unused; retained
//     for future direct-in-page Stripe Elements checkout
//
// When STRIPE_SECRET_KEY is absent the /pay route + create-payment-intent
// endpoint fall back to "not configured" mode — the customer sees the
// merchant's manually-supplied payment gateways instead (BACS details,
// PayPal link, etc.) or a WhatsApp CTA.

import Stripe from "stripe";

let cached: Stripe | null | undefined;

export function getStripe(): Stripe | null {
  if (cached !== undefined) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    cached = null;
    return null;
  }
  cached = new Stripe(key);
  return cached;
}

export function isStripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}
