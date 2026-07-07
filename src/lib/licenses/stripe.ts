// Stripe integration for licence purchases.
//
// One Stripe Checkout session per licence purchase. We store the
// session id + licence id via metadata so the webhook can correlate
// the settled payment back to the pending licence row.

import Stripe from "stripe";
import { TIER_PRICING } from "./pricing";
import type { LicenseTier } from "./types";

function stripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

export type CreateSessionInput = {
  imageId: string;
  imageSubject: string;
  tier: LicenseTier;
  buyerEmail?: string;
  buyerMerchantId?: string;
  postcodePrefix?: string;
  successUrl: string;
  cancelUrl: string;
  /** Licence id in our DB — we round-trip it via Stripe session
   *  metadata so the webhook can activate the right row. */
  licenseId: string;
};

export async function createCheckoutSession(
  input: CreateSessionInput
): Promise<{ sessionId: string; url: string } | null> {
  const s = stripe();
  if (!s) return null;
  const pricing = TIER_PRICING[input.tier];
  const priceLabel =
    pricing.billingCadence === "annual"
      ? `${pricing.label} (annual)`
      : pricing.billingCadence === "monthly"
      ? `${pricing.label} (monthly)`
      : pricing.label;

  const isSubscription = pricing.billingCadence !== "one-time";

  const session = await s.checkout.sessions.create({
    mode: isSubscription ? "subscription" : "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          product_data: {
            name: `${priceLabel} — ${input.imageSubject}`,
            description: pricing.headline,
            metadata: {
              image_id: input.imageId,
              tier: input.tier
            }
          },
          unit_amount: pricing.amountPence,
          ...(isSubscription
            ? {
                recurring: {
                  interval: pricing.billingCadence === "annual" ? "year" : "month"
                }
              }
            : {})
        } as Stripe.Checkout.SessionCreateParams.LineItem.PriceData
      }
    ],
    metadata: {
      license_id: input.licenseId,
      image_id: input.imageId,
      tier: input.tier,
      buyer_merchant_id: input.buyerMerchantId ?? "",
      postcode_prefix: input.postcodePrefix ?? ""
    },
    customer_email: input.buyerEmail,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    allow_promotion_codes: true
  });

  if (!session.url) return null;
  return { sessionId: session.id, url: session.url };
}

export function verifyWebhookSignature(
  body: string,
  signature: string
): Stripe.Event | null {
  const s = stripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!s || !secret) return null;
  try {
    return s.webhooks.constructEvent(body, signature, secret);
  } catch {
    return null;
  }
}
