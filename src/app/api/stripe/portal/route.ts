// POST /api/stripe/portal
//
// Mints a Stripe Billing Portal session for an existing subscriber so
// they can self-manage their subscription (update card, cancel, swap
// plan) without going through admin / WhatsApp.
//
// Request body:
//   {
//     listing_slug: string,
//     edit_token: string
//   }
//
// Response: { url: string } on success, { error: string } on failure.
//
// Auth: constant-time compare of `edit_token` against the listing's
// stored token — same pattern as /api/trade-off/update. The listing
// must already have `stripe_customer_id` set (i.e. Stripe Checkout
// must have run + the webhook must have stamped the row). If not,
// we return a 409 with a helpful message so the UI can hide the
// "Manage subscription" button cleanly.
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function constantTimeEq(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return timingSafeEqual(aBuf, bBuf);
}

function siteOrigin(req: NextRequest): string {
  // Mirrors the checkout route — prefer NEXT_PUBLIC_SITE_URL so the
  // return URL always lands on the real domain even when Stripe calls
  // us back through a load-balanced host.
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

type PortalBody = {
  listing_slug?: unknown;
  edit_token?: unknown;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: PortalBody;
  try {
    body = (await req.json()) as PortalBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const slug =
    typeof body.listing_slug === "string" ? body.listing_slug.trim() : "";
  const token =
    typeof body.edit_token === "string" ? body.edit_token.trim() : "";

  if (!slug || !token) {
    return NextResponse.json(
      { error: "listing_slug and edit_token are required" },
      { status: 400 }
    );
  }

  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, edit_token, stripe_customer_id")
    .eq("slug", slug)
    .maybeSingle();

  if (listing.error) {
    return NextResponse.json(
      { error: `Listing lookup failed: ${listing.error.message}` },
      { status: 500 }
    );
  }
  if (!listing.data) {
    return NextResponse.json(
      { error: `No listing found for slug "${slug}"` },
      { status: 404 }
    );
  }
  if (!constantTimeEq(listing.data.edit_token ?? "", token)) {
    return NextResponse.json(
      { error: "Invalid edit token." },
      { status: 403 }
    );
  }

  const customerId = listing.data.stripe_customer_id;
  if (!customerId) {
    // The caller's UI should hide the Manage Subscription button when
    // the listing has no stripe_customer_id — this 409 is a defensive
    // belt for clients that don't check.
    return NextResponse.json(
      {
        error:
          "No Stripe customer on file for this listing. Subscribe first via /api/stripe/checkout."
      },
      { status: 409 }
    );
  }

  const origin = siteOrigin(req);
  const returnUrl = `${origin}/trade-off/edit/${encodeURIComponent(
    listing.data.slug
  )}?token=${encodeURIComponent(token)}`;

  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl
    });
    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe returned no portal URL" },
        { status: 502 }
      );
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[stripe/portal] session create failed:", message);
    return NextResponse.json(
      { error: `Stripe portal failed: ${message}` },
      { status: 500 }
    );
  }
}
