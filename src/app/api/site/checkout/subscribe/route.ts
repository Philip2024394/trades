// POST /api/site/checkout/subscribe
//
// Creates a Stripe Checkout Session in `subscription` mode for The
// Site's £14.99/mo unlimited plan. Stripe redirects back to
// /trade-off/search?tab=inspiration&subscribed=1 on success.
//
// The webhook (/api/stripe/webhook) reads metadata.kind === "site.subscribe"
// on checkout.session.completed and upserts a hammerex_site_subscriptions
// row. Subsequent customer.subscription.* events keep the projection in
// sync until cancel.
//
// Request body:
//   { email?: string }
//     • email required when the caller is not a logged-in merchant
//
// Response: { url: string } → client redirects to Stripe hosted page.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { resolveSiteUnlimitedPriceId } from "@/lib/stripePrices";
import { getMerchantSlug } from "@/lib/merchantSession";

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
  let body: { email?: unknown };
  try {
    body = (await req.json().catch(() => ({}))) as typeof body;
  } catch {
    body = {};
  }
  const emailIn = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  const merchantSlug = await getMerchantSlug();
  if (!merchantSlug && !emailIn) {
    return NextResponse.json({ error: "email_required" }, { status: 400 });
  }
  if (emailIn && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailIn)) {
    return NextResponse.json({ error: "invalid_email" }, { status: 400 });
  }

  const priceId = resolveSiteUnlimitedPriceId();
  if (!priceId) {
    return NextResponse.json(
      { error: "site_unlimited_price_not_configured" },
      { status: 500 }
    );
  }

  const origin = siteOrigin(req);
  const successUrl = `${origin}/api/site/return?subscribed=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl  = `${origin}/trade-off/search?tab=inspiration`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: emailIn || undefined,
      billing_address_collection: "auto",
      allow_promotion_codes: true,
      metadata: {
        kind:          "site.subscribe",
        merchant_slug: merchantSlug ?? "",
        email:         emailIn || ""
      },
      subscription_data: {
        metadata: {
          kind:          "site.subscribe",
          merchant_slug: merchantSlug ?? "",
          email:         emailIn || ""
        }
      }
    });
    if (!session.url) {
      return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("[site/checkout/subscribe] failed:", message);
    return NextResponse.json({ error: `stripe_failed: ${message}` }, { status: 500 });
  }
}
