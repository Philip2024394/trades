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
import { createYardWelcomeMessage } from "@/lib/yardWelcome";
import { recomputeAffiliateLevel } from "@/lib/affiliateLevel";
import { resolveActiveCampaign, priceCommissionWithCampaign } from "@/lib/affiliateCampaigns";
import { detectSelfReferral } from "@/lib/affiliateFraud";

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

async function handleBoostCompleted(
  session: Stripe.Checkout.Session,
  meta: { post_id: string; hours: string; unit_amount_pence?: string }
): Promise<void> {
  const postId = meta.post_id;
  const hours = Number(meta.hours);
  const paidPence = Number(meta.unit_amount_pence ?? 0);
  if (!postId || !Number.isFinite(hours) || hours <= 0) {
    console.warn(
      "[stripe/webhook] boost checkout without valid post_id/hours; skipping",
      { sessionId: session.id, meta }
    );
    return;
  }
  const { data: post } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, is_boosted_until, boost_count, boost_paid_pence")
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    console.warn(
      "[stripe/webhook] boost checkout for missing post; skipping",
      { sessionId: session.id, postId }
    );
    return;
  }
  // Extend from now OR the existing boost end — whichever is later —
  // so paying to boost a still-live boost adds duration on top rather
  // than replacing it.
  const now = Date.now();
  const existing = post.is_boosted_until
    ? Date.parse(post.is_boosted_until)
    : 0;
  const startFrom = Number.isFinite(existing) && existing > now ? existing : now;
  const newUntil = new Date(startFrom + hours * 60 * 60 * 1000).toISOString();
  const upd = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .update({
      is_boosted_until: newUntil,
      boost_count: (post.boost_count ?? 0) + 1,
      boost_paid_pence: (post.boost_paid_pence ?? 0) + paidPence
    })
    .eq("id", postId);
  if (upd.error) {
    console.error(
      "[stripe/webhook] boost apply failed:",
      upd.error.message
    );
  }
}

/** The Site — single-image £5.99 purchase. Records the paid session
 *  into hammerex_site_purchases which the access-check reads to
 *  authorise clean downloads. Idempotent via UNIQUE(stripe_session_id). */
async function handleSiteSingleCompleted(
  session: Stripe.Checkout.Session,
  meta: Stripe.Metadata
): Promise<void> {
  const imageId = String(meta.image_id ?? "").trim();
  if (!imageId) {
    console.warn("[stripe/webhook] site.single without image_id; skipping", { sessionId: session.id });
    return;
  }
  const buyerEmail = String(
    meta.email ?? session.customer_details?.email ?? ""
  ).trim().toLowerCase();
  if (!buyerEmail) {
    console.warn("[stripe/webhook] site.single without buyer email; skipping", { sessionId: session.id });
    return;
  }
  const merchantSlug = String(meta.merchant_slug ?? "").trim() || null;
  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent && "id" in session.payment_intent
        ? session.payment_intent.id
        : null;

  const ins = await supabaseAdmin
    .from("hammerex_site_purchases")
    .insert({
      image_id:              imageId,
      buyer_email:           buyerEmail,
      buyer_merchant_slug:   merchantSlug,
      amount_pence:          session.amount_total ?? 599,
      currency:              (session.currency ?? "gbp").toLowerCase(),
      stripe_session_id:     session.id,
      stripe_payment_intent: paymentIntent,
      status:                "paid"
    });
  // Duplicate insert on webhook retry is expected — UNIQUE constraint
  // catches it. Log only on other errors.
  if (ins.error && !/duplicate|unique/i.test(ins.error.message)) {
    console.error("[stripe/webhook] site.single insert failed:", ins.error.message);
  }
}

/** The Site — £14.99/mo unlimited subscription. Upserts a projection
 *  row keyed by stripe_subscription_id so the access-check can read
 *  status + period without going back to Stripe. */
async function handleSiteSubscribeCompleted(
  session: Stripe.Checkout.Session,
  meta: Stripe.Metadata
): Promise<void> {
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription && "id" in session.subscription
        ? session.subscription.id
        : null;
  const customerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer && "id" in session.customer
        ? session.customer.id
        : null;
  if (!subscriptionId || !customerId) {
    console.warn("[stripe/webhook] site.subscribe missing subscription/customer id; skipping", { sessionId: session.id });
    return;
  }

  // Fetch the fresh subscription so we get authoritative period bounds
  // rather than trusting the checkout session's shortcut fields.
  let periodStart = new Date();
  let periodEnd   = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let status      = "active";
  try {
    const stripe = getStripe();
    const sub = await stripe.subscriptions.retrieve(subscriptionId) as SubscriptionWithPeriod;
    if (sub.current_period_start) periodStart = new Date(sub.current_period_start * 1000);
    if (sub.current_period_end)   periodEnd   = new Date(sub.current_period_end * 1000);
    if (sub.status)               status      = sub.status;
  } catch (e) {
    console.error("[stripe/webhook] site.subscribe fetch retrieve failed, using fallbacks:", e);
  }

  const merchantSlug = String(meta.merchant_slug ?? "").trim() || null;
  const buyerEmail = String(
    meta.email ?? session.customer_details?.email ?? ""
  ).trim().toLowerCase() || null;

  const up = await supabaseAdmin
    .from("hammerex_site_subscriptions")
    .upsert(
      {
        merchant_slug:          merchantSlug,
        buyer_email:            buyerEmail,
        stripe_customer_id:     customerId,
        stripe_subscription_id: subscriptionId,
        status,
        current_period_start:   periodStart.toISOString(),
        current_period_end:     periodEnd.toISOString(),
        cancel_at_period_end:   false,
        updated_at:             new Date().toISOString()
      },
      { onConflict: "stripe_subscription_id" }
    );
  if (up.error) {
    console.error("[stripe/webhook] site.subscribe upsert failed:", up.error.message);
  }
}

/** Sync updates (renewal, plan swap, past_due) into the projection. */
async function handleSiteSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const s = sub as SubscriptionWithPeriod;
  const periodEnd   = s.current_period_end   ? new Date(s.current_period_end   * 1000).toISOString() : null;
  const periodStart = s.current_period_start ? new Date(s.current_period_start * 1000).toISOString() : null;

  const patch: Record<string, unknown> = {
    status:               sub.status,
    cancel_at_period_end: sub.cancel_at_period_end === true,
    updated_at:           new Date().toISOString()
  };
  if (periodEnd)   patch.current_period_end   = periodEnd;
  if (periodStart) patch.current_period_start = periodStart;

  const upd = await supabaseAdmin
    .from("hammerex_site_subscriptions")
    .update(patch)
    .eq("stripe_subscription_id", sub.id);
  if (upd.error) {
    console.error("[stripe/webhook] site.subscription.updated failed:", upd.error.message);
  }
}

/** Cancellation — flip status to canceled so the access check stops
 *  granting clean downloads at the next request. */
async function handleSiteSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const upd = await supabaseAdmin
    .from("hammerex_site_subscriptions")
    .update({
      status:     "canceled",
      updated_at: new Date().toISOString()
    })
    .eq("stripe_subscription_id", sub.id);
  if (upd.error) {
    console.error("[stripe/webhook] site.subscription.deleted failed:", upd.error.message);
  }
}

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  const meta = session.metadata ?? {};

  // Fork on kind — boost is a one-time payment for a specific post;
  // site.single is a one-off image licence; site.subscribe is the
  // £14.99/mo unlimited plan; subscription paths (below) upgrade a
  // listing tier.
  if (meta.kind === "boost") {
    await handleBoostCompleted(session, {
      post_id: String(meta.post_id ?? ""),
      hours: String(meta.hours ?? "0"),
      unit_amount_pence: String(meta.unit_amount_pence ?? "0")
    });
    return;
  }
  if (meta.kind === "site.single") {
    await handleSiteSingleCompleted(session, meta);
    return;
  }
  if (meta.kind === "site.subscribe") {
    await handleSiteSubscribeCompleted(session, meta);
    return;
  }

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
    return;
  }

  // Attribute the upgrade to any upgrade-prompt this merchant saw.
  // Reads the `src=<promptKey>` query param the pricing/dashboard CTA
  // routes carry, or falls back to marking ALL undismissed prompts
  // for this listing as `upgraded`. Best-effort — never blocks the
  // webhook. Powers per-prompt conversion analytics.
  try {
    const src = String(meta.src ?? "").trim();
    const { supabaseAdmin: sa } = await import("@/lib/supabaseAdmin");
    if (src && ["views5", "products10", "beacon-nowashers", "contacts10", "firstProduct", "referSuccess"].includes(src)) {
      await sa.from("hammerex_upgrade_prompts")
        .update({ upgraded_at: new Date().toISOString() })
        .eq("listing_id", listing_id)
        .eq("prompt_key", src);
    } else {
      // No explicit src — attribute to every shown-but-not-upgraded prompt
      await sa.from("hammerex_upgrade_prompts")
        .update({ upgraded_at: new Date().toISOString() })
        .eq("listing_id", listing_id)
        .is("upgraded_at", null);
    }
  } catch (err) {
    console.error("[stripe/webhook] upgrade-prompt attribution failed:", err);
  }

  // New paid member → drop the Trade Off team welcome post into the
  // Yard chat feed. Idempotent (skips if a welcome already exists for
  // this listing_id) and demo-aware (slug LIKE 'demo-%' skipped).
  // Errors are logged but never thrown — the webhook must still 200.
  try {
    const welcome = await createYardWelcomeMessage(listing_id);
    if (welcome.ok && welcome.created) {
      console.log(
        `[stripe/webhook] yard welcome posted for listing_id=${listing_id} post_id=${welcome.id}`
      );
    } else if (welcome.ok && !welcome.created) {
      console.log(
        `[stripe/webhook] yard welcome skipped for listing_id=${listing_id} reason=${welcome.reason}`
      );
    }
  } catch (e) {
    console.error("[stripe/webhook] yard welcome threw:", e);
  }

  // Affiliate commission attribution. If the listing carries an
  // affiliate_referrer_id, insert a £10 pending commission row. We
  // de-dupe by stripe_subscription_id + listing_id so retries don't
  // double-count.
  try {
    const { data: listingRow } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("affiliate_referrer_id, merchant_referrer_slug, slug, display_name")
      .eq("id", listing_id)
      .maybeSingle();
    if (listingRow?.affiliate_referrer_id && subscriptionId) {
      const existing = await supabaseAdmin
        .from("hammerex_affiliate_commissions")
        .select("id")
        .eq("listing_id", listing_id)
        .eq("stripe_subscription_id", subscriptionId)
        .maybeSingle();
      if (!existing.data) {
        // Self-referral guard: cancel the commission if the listing
        // belongs to the affiliate themselves (matching WhatsApp).
        const selfReferral = await detectSelfReferral(
          listingRow.affiliate_referrer_id,
          listing_id
        );
        // Campaign-aware pricing. Falls back to flat £10 when no
        // bonus/seasonal campaign is active.
        const campaign = await resolveActiveCampaign();
        const priced = priceCommissionWithCampaign(campaign);

        await supabaseAdmin.from("hammerex_affiliate_commissions").insert({
          affiliate_id: listingRow.affiliate_referrer_id,
          listing_id,
          stripe_subscription_id: subscriptionId,
          amount_pence: priced.amount_pence,
          currency: "gbp",
          status: selfReferral ? "cancelled" : "pending",
          cancelled_reason: selfReferral ? "self_referral" : null,
          campaign_id: priced.campaign_id
        });
        await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
          actor_type: "system",
          actor_id: "stripe.webhook",
          action: selfReferral ? "commission.cancel.self_referral" : "commission.create",
          target_id: listing_id,
          details: {
            affiliate_id: listingRow.affiliate_referrer_id,
            amount_pence: priced.amount_pence,
            stripe_subscription_id: subscriptionId,
            campaign_id: priced.campaign_id ?? null
          }
        });
      }
    }
  } catch (e) {
    console.error("[stripe/webhook] affiliate commission insert threw:", e);
  }

  // Merchant-to-merchant referral upgrade reward. If the newly-paid
  // listing carries a merchant_referrer_slug, queue a `first-paid-upgrade`
  // reward row for the referrer and email them. Idempotent — checks
  // for an existing reward before insert. Never blocks the webhook.
  try {
    const { data: mrefRow } = await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .select("merchant_referrer_slug, slug, display_name")
      .eq("id", listing_id)
      .maybeSingle();
    const referrerSlug = mrefRow?.merchant_referrer_slug as string | null | undefined;
    const referredSlug = mrefRow?.slug as string | null | undefined;
    if (referrerSlug && referredSlug && referrerSlug !== referredSlug) {
      const existing = await supabaseAdmin
        .from("hammerex_merchant_referral_rewards")
        .select("id")
        .eq("referrer_slug", referrerSlug)
        .eq("referred_slug", referredSlug)
        .eq("reward_type", "first-paid-upgrade")
        .maybeSingle();
      if (!existing.data) {
        await supabaseAdmin.from("hammerex_merchant_referral_rewards").insert({
          referrer_slug: referrerSlug,
          referred_slug: referredSlug,
          reward_type:   "first-paid-upgrade",
          reward_status: "pending",
          reward_meta:   { washers: 200, trigger: "app_paid", subscription_id: subscriptionId ?? null }
        });
        const { sendReferralUpgradedEmail } = await import("@/lib/merchantReferralEmails");
        await sendReferralUpgradedEmail({
          referrerSlug,
          referredSlug,
          referredName: (mrefRow?.display_name as string | null) ?? null
        });
      }
    }
  } catch (e) {
    console.error("[stripe/webhook] merchant referral upgrade reward threw:", e);
  }
}

async function handleSubscriptionUpdated(
  sub: Stripe.Subscription
): Promise<void> {
  const meta = sub.metadata ?? {};
  // Fork Site subs off to their own projection — they're keyed by
  // stripe_subscription_id (no listing_id), and updates go to the
  // hammerex_site_subscriptions table not the listings table.
  if (meta.kind === "site.subscribe") {
    await handleSiteSubscriptionUpdated(sub);
    return;
  }
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
  if (meta.kind === "site.subscribe") {
    await handleSiteSubscriptionDeleted(sub);
    return;
  }
  const listing_id = meta.listing_id;
  if (!listing_id) return;

  // Affiliate-commission rollback: any pending / approved commission
  // tied to this subscription gets cancelled when the customer cancels
  // their plan. Already-paid commissions are NOT clawed back — those
  // are paid out.
  try {
    await supabaseAdmin
      .from("hammerex_affiliate_commissions")
      .update({ status: "cancelled", cancelled_reason: "subscription_cancelled" })
      .eq("stripe_subscription_id", sub.id)
      .in("status", ["pending", "approved"]);
    await supabaseAdmin.from("hammerex_affiliate_audit_log").insert({
      actor_type: "system",
      actor_id: "stripe.webhook",
      action: "commission.cancel",
      target_id: sub.id,
      details: { reason: "subscription_cancelled" }
    });
  } catch (e) {
    console.error("[stripe/webhook] affiliate commission cancel threw:", e);
  }

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
