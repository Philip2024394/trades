// Xrated Trades — Stripe SDK initialisation.
//
// Single source of truth for the server-side Stripe client. Both the
// checkout-session route and the webhook handler import `getStripe()`
// from here so we only construct one client per cold start.
//
// We deliberately DO NOT throw at module load. Importing this file in
// dev when STRIPE_SECRET_KEY is unset must not blow up the server —
// we only throw inside `getStripe()` so the rest of the app keeps
// booting, and only the Stripe routes 500.
//
// The `apiVersion` is pinned so a Stripe SDK upgrade can't silently
// shift webhook payload shapes under us. Bump deliberately when the
// SDK ships and you've re-tested the webhook.
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Lazily construct (and cache) the Stripe client. Throws a clear,
 * actionable error if `STRIPE_SECRET_KEY` is not set — but only at
 * call time, not at import time, so dev mode without Stripe wired up
 * still boots.
 */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Missing STRIPE_SECRET_KEY. Add it to .env.local (see docs/STRIPE_SETUP.md)."
    );
  }
  cached = new Stripe(key, {
    // Pin the API version so a stripe@latest install can't shift the
    // webhook payload shapes underneath us. Bump deliberately.
    apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion
  });
  return cached;
}
