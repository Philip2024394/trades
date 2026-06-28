// POST /api/stripe/checkout
//
// Creates a Stripe Checkout Session in subscription mode for a given
// listing + tier + billing cadence + optional add-ons. The client POSTs
// here from the pricing tier cards / add-on hub, then redirects the
// browser to the returned `url`. After the customer pays, Stripe fires
// `checkout.session.completed` at /api/stripe/webhook which flips the
// listing's tier + paid_expires_at.
//
// Request body:
//   {
//     tier: 'paid' | 'verified',
//     billing: 'monthly' | 'annual',
//     listing_slug: string,
//     addon_slugs: string[]   // may be empty
//   }
//
// Response: { url: string } on success, { error: string } on failure.
//
// We intentionally do NOT mutate the listing here — the listing only
// flips after Stripe confirms payment via the webhook. That's the
// idempotent source of truth.
import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  resolveAddonPriceId,
  resolveTierPriceId
} from "@/lib/stripePrices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  tier?: unknown;
  billing?: unknown;
  listing_slug?: unknown;
  addon_slugs?: unknown;
};

function siteOrigin(req: NextRequest): string {
  // Prefer the deploy-time env var so success/cancel URLs always land
  // on the real domain — falling back to the request origin keeps
  // local dev sane.
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: CheckoutBody;
  try {
    body = (await req.json()) as CheckoutBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const tier = body.tier;
  const billing = body.billing;
  const listing_slug = body.listing_slug;
  const addon_slugs = Array.isArray(body.addon_slugs)
    ? body.addon_slugs.filter((s): s is string => typeof s === "string")
    : [];

  if (tier !== "paid" && tier !== "verified") {
    return NextResponse.json(
      { error: "tier must be 'paid' or 'verified'" },
      { status: 400 }
    );
  }
  if (billing !== "monthly" && billing !== "annual") {
    return NextResponse.json(
      { error: "billing must be 'monthly' or 'annual'" },
      { status: 400 }
    );
  }
  if (typeof listing_slug !== "string" || !listing_slug) {
    return NextResponse.json(
      { error: "listing_slug is required" },
      { status: 400 }
    );
  }

  // Look up the listing so we can stamp listing_id on the session
  // metadata. Doing this server-side (not trusting the slug from the
  // client) means the webhook can resolve back to a guaranteed-real row.
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name")
    .eq("slug", listing_slug)
    .maybeSingle();

  if (listing.error) {
    return NextResponse.json(
      { error: `Listing lookup failed: ${listing.error.message}` },
      { status: 500 }
    );
  }
  if (!listing.data) {
    return NextResponse.json(
      { error: `No listing found for slug "${listing_slug}"` },
      { status: 404 }
    );
  }

  const tierPriceId = resolveTierPriceId(tier, billing);
  if (!tierPriceId) {
    return NextResponse.json(
      {
        error: `Stripe price not configured for ${tier}:${billing}. See docs/STRIPE_SETUP.md.`
      },
      { status: 400 }
    );
  }

  // Validate every requested add-on resolves to a real price ID before
  // we call Stripe — fail fast with a clear error rather than a vague
  // Stripe 400.
  const addonLineItems: Array<{ price: string; quantity: number }> = [];
  for (const slug of addon_slugs) {
    const priceId = resolveAddonPriceId(slug);
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Stripe price not configured for add-on "${slug}". See docs/STRIPE_SETUP.md.`
        },
        { status: 400 }
      );
    }
    addonLineItems.push({ price: priceId, quantity: 1 });
  }

  const origin = siteOrigin(req);
  const successUrl = `${origin}/trade-off/edit/${encodeURIComponent(
    listing.data.slug
  )}?stripe=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/trade-off/edit/${encodeURIComponent(
    listing.data.slug
  )}?stripe=cancelled`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: tierPriceId, quantity: 1 }, ...addonLineItems],
      success_url: successUrl,
      cancel_url: cancelUrl,
      // Worldwide payment-method reach is driven by the account's
      // default Payment Method Configuration (`pmc_…NVvN81uB`), which
      // enables card + Link + iDEAL + Bancontact + Giropay + EPS +
      // Klarna + P24. Stripe auto-selects the relevant subset per
      // customer geo at Checkout. The PMC is the account default, so
      // we don't need to pass it explicitly here.
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      // Webhook is the source of truth — `listing_id` here is what
      // `checkout.session.completed` reads to flip the row. Keep this
      // contract tight; don't rename keys without updating the webhook.
      metadata: {
        listing_id: listing.data.id,
        listing_slug: listing.data.slug,
        tier,
        billing,
        addon_slugs: addon_slugs.join(",")
      },
      // Mirror on the subscription too so future
      // `customer.subscription.*` events can resolve back to the
      // listing without re-reading the session.
      subscription_data: {
        metadata: {
          listing_id: listing.data.id,
          listing_slug: listing.data.slug,
          tier,
          billing,
          addon_slugs: addon_slugs.join(",")
        }
      }
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe returned no checkout URL" },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/checkout] session create failed:", message);
    return NextResponse.json(
      { error: `Stripe checkout failed: ${message}` },
      { status: 500 }
    );
  }
}
