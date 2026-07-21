// POST /api/site/checkout/single
//
// Creates a Stripe Checkout Session in `payment` mode for a single-
// image purchase on The Site (£5.99 one-off). Stripe redirects back to
// /trade-off/search?tab=inspiration&purchased={image_id} on success.
//
// The webhook (/api/stripe/webhook) reads metadata.kind === "site.single"
// on checkout.session.completed and inserts a hammerex_site_purchases
// row granting the buyer perpetual clean-download rights on image_id.
//
// Request body:
//   { image_id: string, email?: string }
//     • email required when the caller is not a logged-in merchant
//     • merchant identity resolved server-side from the trade session
//
// Response: { url: string } → client redirects to Stripe hosted page.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveSiteSinglePriceId } from "@/lib/stripePrices";
import { getMerchantSlug } from "@/lib/merchantSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function siteOrigin(req: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { image_id?: unknown; email?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const imageId = typeof body.image_id === "string" ? body.image_id.trim() : "";
  const emailIn = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!imageId) {
    return NextResponse.json({ error: "image_id_required" }, { status: 400 });
  }

  // Confirm the image exists + is a sellable tier (2 or 3). Prevents a
  // client from creating a checkout against an arbitrary slug.
  const image = await supabaseAdmin
    .from("hammerex_feed_tile_library")
    .select("slug, alt, url, tier, active")
    .eq("slug", imageId)
    .maybeSingle();
  if (image.error || !image.data) {
    return NextResponse.json({ error: "image_not_found" }, { status: 404 });
  }
  if (!image.data.active || (image.data.tier !== 2 && image.data.tier !== 3)) {
    return NextResponse.json({ error: "image_not_for_sale" }, { status: 400 });
  }

  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug && !emailIn) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (emailIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const priceId = resolveSiteSinglePriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "site_single_price_not_configured" },
      { status: 500 }
    );
  }

  const origin = siteOrigin(req);
  // Route through /api/site/return so the buyer email captured by
  // Stripe becomes a signed cookie — anonymous buyer can redownload
  // later without retyping their email.
  const successUrl = `${origin}/api/site/return?purchased=${encodeURIComponent(imageId)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/trade-off/search?tab=inspiration`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: emailIn || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      metadata: {
        kind:                "site.single",
        image_id:            imageId,
        merchant_slug:       merchantSlug ?? "",
        email:               emailIn || ""
      }
    });
    if (!session.url) {
      return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[site/checkout/single] failed:", message);
    return NextResponse.json({ error: `stripe_failed: ${message}` }, { status: 500 });
  }
}
