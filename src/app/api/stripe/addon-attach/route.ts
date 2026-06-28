// POST /api/stripe/addon-attach
//
// Attaches a paid add-on to an existing subscription as a new line item.
// Used when a tradesperson on app_paid / app_verified clicks "Enable" on
// a paid add-on from the AddOnsHub. We call
// `stripe.subscriptions.update` directly with the add-on price ID — this
// is the clean upgrade path, no new Checkout Session required.
//
// Request body:
//   { listing_slug: string, edit_token: string, addon_slug: string }
//
// Response: { ok: true } on success, { ok: false, error: string } on failure.
//
// Auth: constant-time compare of `edit_token` against the listing's
// stored token — same pattern as the rest of the trade-off APIs.
//
// Tier gate: only `app_paid` and `app_verified` (and `app_trial` while
// still inside the trial window) can attach paid add-ons. Standard /
// expired listings get a 402 telling them to subscribe first.
//
// Source of truth: the webhook (`customer.subscription.updated`) reads
// the resulting subscription's line items back into the listing's
// `addons_enabled` map. We don't flip the addons_enabled bit here
// optimistically — Stripe wins the eventual consistency race.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { resolveAddonPriceId } from "@/lib/stripePrices";
import { XRATED_ADDONS } from "@/lib/xratedAddons";
import { effectiveTier } from "@/lib/xratedTrades";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const slug = s(body.listing_slug);
  const token = s(body.edit_token);
  const addonSlug = s(body.addon_slug);

  if (!slug || !token || !addonSlug) {
    return NextResponse.json(
      { ok: false, error: "listing_slug, edit_token, and addon_slug are required" },
      { status: 400 }
    );
  }

  const addon = XRATED_ADDONS.find((a) => a.slug === addonSlug);
  if (!addon) {
    return NextResponse.json(
      { ok: false, error: "Unknown add-on." },
      { status: 400 }
    );
  }
  if (addon.availability === "coming_soon") {
    return NextResponse.json(
      { ok: false, error: "This add-on is coming soon." },
      { status: 400 }
    );
  }
  if (addon.pricing.kind !== "paid") {
    return NextResponse.json(
      {
        ok: false,
        error: "Free add-ons must use /api/trade-off/addons/toggle, not addon-attach."
      },
      { status: 400 }
    );
  }

  const priceId = resolveAddonPriceId(addonSlug);
  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: `Stripe price not configured for add-on "${addonSlug}". See docs/STRIPE_SETUP.md.`
      },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, edit_token, tier, trial_expires_at, stripe_subscription_id"
    )
    .eq("slug", slug)
    .maybeSingle();

  if (listing.error) {
    return NextResponse.json(
      { ok: false, error: `Listing lookup failed: ${listing.error.message}` },
      { status: 500 }
    );
  }
  if (!listing.data) {
    return NextResponse.json(
      { ok: false, error: "Listing not found." },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token ?? "", token)) {
    return NextResponse.json(
      { ok: false, error: "Invalid edit token." },
      { status: 403 }
    );
  }

  // Tier gate — only paying or in-trial listings can attach paid add-ons.
  const tier = effectiveTier({
    tier: listing.data.tier ?? "standard",
    trial_expires_at: listing.data.trial_expires_at ?? null
  });
  const canAttach =
    tier === "app_paid" || tier === "app_verified" || tier === "app_trial";
  if (!canAttach) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Subscribe to a paid plan first before attaching add-ons.",
        redirect_to: `/trade-off/upgrade?slug=${encodeURIComponent(slug)}`
      },
      { status: 402 }
    );
  }

  const subId = listing.data.stripe_subscription_id;
  if (!subId) {
    // No subscription yet (e.g. trial-only listing). Tell the caller
    // to go through Checkout instead so we can create the sub fresh
    // with the add-on bundled in.
    return NextResponse.json(
      {
        ok: false,
        error:
          "No active Stripe subscription on file. Use /api/stripe/checkout to start one.",
        needs_checkout: true
      },
      { status: 409 }
    );
  }

  // Idempotency — if the subscription already carries this add-on price,
  // return ok so the UI doesn't double-bill on a re-click.
  try {
    const stripe = getStripe();
    const existing = await stripe.subscriptions.retrieve(subId);
    const already = existing.items.data.some(
      (it) => it.price?.id === priceId
    );
    if (already) {
      return NextResponse.json({ ok: true, already_attached: true });
    }

    await stripe.subscriptions.update(subId, {
      items: [{ price: priceId, quantity: 1 }],
      proration_behavior: "create_prorations"
    });

    // The webhook (`customer.subscription.updated`) is the canonical
    // path that rebuilds addons_enabled from the resulting sub state.
    // Returning ok here is enough — the UI can either optimistically
    // flip the toggle or wait for the webhook-driven reload.
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/addon-attach] subscription update failed:", message);
    return NextResponse.json(
      { ok: false, error: `Stripe addon-attach failed: ${message}` },
      { status: 500 }
    );
  }
}
