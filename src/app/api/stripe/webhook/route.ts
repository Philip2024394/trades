// POST /api/stripe/webhook
//
// Stripe → server callbacks. Verifies the `stripe-signature` header
// against `STRIPE_WEBHOOK_SECRET`, then acts on the events we care
// about. ALWAYS returns 200 (even for unhandled events) so Stripe
// doesn't burn retry budget on stuff we deliberately ignore.
//
// Events handled:
//   - checkout.session.completed
//       Read metadata, flip listing.tier → app_paid, set
//       paid_expires_at (+30 days monthly | +365 days annual), merge
//       addon_slugs into addons_enabled, stamp last_payment_plan.
//   - customer.subscription.updated
//       Pull the new `current_period_end` from the subscription and
//       refresh paid_expires_at. Handles renewals + plan swaps.
//   - customer.subscription.deleted
//       Flip listing.tier → app_expired immediately. (The nightly
//       cron also catches this in case the webhook is ever missed.)
//
// We use Stripe.constructEvent with the raw body — Next.js App Router
// gives us a stream via `req.text()` which preserves byte-for-byte
// content. Don't switch to `req.json()`; signature verification will
// fail.
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  allAddonSlugs,
  resolveAddonSlugFromPriceId
} from "@/lib/stripePrices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

type SubscriptionWithPeriod = Stripe.Subscription & {
  current_period_end?: number;
};

function expiresAtFor(billing: string | undefined): string {
  const days = billing === "annual" ? 365 : 30;
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};
  const listing_id = meta.listing_id;
  const billing = meta.billing;
  const addonCsv = meta.addon_slugs ?? "";

  if (!listing_id) {
    console.warn(
      "[stripe/webhook] checkout.session.completed without listing_id metadata; skipping"
    );
    return;
  }

  const addonSlugs = String(addonCsv)
    .split(",")
    .map((s: string) => s.trim())
    .filter((s: string) => s.length > 0);

  // Merge add-on flags into the existing `addons_enabled` JSON map so
  // we don't blow away anything the user already had switched on.
  const current = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("addons_enabled")
    .eq("id", listing_id)
    .maybeSingle();

  const merged: Record<string, boolean> = {
    ...((current.data?.addons_enabled as Record<string, boolean> | null) ??
      {})
  };
  for (const slug of addonSlugs) merged[slug] = true;

  // Stripe gives us `customer` and `subscription` as either string IDs or
  // expanded objects (we don't expand, so they should be strings, but
  // belt-and-braces). Stamp them onto the listing so the /api/stripe/portal
  // endpoint can mint a Billing Portal session later without re-reading
  // the session.
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && "id" in session.customer
        ? session.customer.id
        : null;
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription && "id" in session.subscription
        ? session.subscription.id
        : null;

  const patch: Record<string, unknown> = {
    tier: "app_paid",
    addons_enabled: merged,
    paid_expires_at: expiresAtFor(billing),
    last_payment_plan: billing === "annual" ? "annual" : "monthly"
  };
  if (customerId) patch.stripe_customer_id = customerId;
  if (subscriptionId) patch.stripe_subscription_id = subscriptionId;

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listing_id);

  if (upd.error) {
    console.error(
      "[stripe/webhook] checkout.session.completed update failed:",
      upd.error
    );
  }
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const meta = sub.metadata ?? {};
  const listing_id = meta.listing_id;
  if (!listing_id) return;

  // Read the current addons_enabled so we only touch the slugs that
  // map to a Stripe price — free add-ons (trusted_trades) and UI prefs
  // (compare_section, spec_tab, warranty_returns, etc.) stay untouched.
  const current = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("addons_enabled")
    .eq("id", listing_id)
    .maybeSingle();

  const merged: Record<string, boolean> = {
    ...((current.data?.addons_enabled as Record<string, boolean> | null) ?? {})
  };

  // Reset every Stripe-tracked add-on slug to false first; then flip on
  // whichever price IDs the subscription actually carries. Stripe wins.
  for (const slug of allAddonSlugs()) {
    merged[slug] = false;
  }
  for (const item of sub.items?.data ?? []) {
    const priceId = item.price?.id ?? "";
    const slug = resolveAddonSlugFromPriceId(priceId);
    if (slug) merged[slug] = true;
  }

  const patch: Record<string, unknown> = {
    addons_enabled: merged
  };

  const periodEnd = (sub as SubscriptionWithPeriod).current_period_end;
  if (periodEnd) {
    patch.paid_expires_at = new Date(periodEnd * 1000).toISOString();
  }

  // Mirror the subscription ID onto the listing in case this is the
  // first time we're seeing it (e.g. legacy rows that pre-date the
  // checkout webhook stamp). Customer ID may also be unset on those.
  if (sub.id) patch.stripe_subscription_id = sub.id;
  const customerId =
    typeof sub.customer === "string"
      ? sub.customer
      : sub.customer && "id" in sub.customer
        ? sub.customer.id
        : null;
  if (customerId) patch.stripe_customer_id = customerId;

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update(patch)
    .eq("id", listing_id);

  if (upd.error) {
    console.error(
      "[stripe/webhook] customer.subscription.updated update failed:",
      upd.error
    );
  }
}

async function handleSubscriptionDeleted(
  sub: Stripe.Subscription
): Promise<void> {
  const meta = sub.metadata ?? {};
  const listing_id = meta.listing_id;
  if (!listing_id) return;

  // No subscription = no paid add-ons. Clear every Stripe-tracked slug
  // (false), but preserve free add-ons and UI prefs that don't carry a
  // Stripe price.
  const current = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("addons_enabled")
    .eq("id", listing_id)
    .maybeSingle();

  const merged: Record<string, boolean> = {
    ...((current.data?.addons_enabled as Record<string, boolean> | null) ?? {})
  };
  for (const slug of allAddonSlugs()) {
    merged[slug] = false;
  }

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({ tier: "app_expired", addons_enabled: merged })
    .eq("id", listing_id);

  if (upd.error) {
    console.error(
      "[stripe/webhook] customer.subscription.deleted update failed:",
      upd.error
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Better to 500 loudly than silently 200 — if the secret is unset,
    // Stripe should retry once the env is fixed.
    console.error(
      "[stripe/webhook] STRIPE_WEBHOOK_SECRET is not set; cannot verify signature"
    );
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  // Raw body required for signature verification. Don't json() this.
  const raw = await req.text();

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/webhook] signature verify failed:", message);
    return NextResponse.json(
      { error: `Signature verification failed: ${message}` },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(
          event.data.object as Stripe.Checkout.Session
        );
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(
          event.data.object as Stripe.Subscription
        );
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(
          event.data.object as Stripe.Subscription
        );
        break;
      default:
        // Deliberately ignored — return 200 so Stripe doesn't retry.
        break;
    }
  } catch (err) {
    // Even on internal errors, return 200 so Stripe doesn't retry
    // forever — we have logs + the daily cron as a safety net.
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(
      `[stripe/webhook] handler for ${event.type} threw:`,
      message
    );
  }

  return NextResponse.json({ received: true });
}
