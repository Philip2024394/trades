// GET /api/merchant/trust-ladder/skip-queue/checkout
//
// Merchant pays £4.99 to jump the manual insurance verification
// queue. Immediate effect on payment (webhook): sets
// listings.trust_skip_queue_paid_at → the `insurance_verified`
// criterion resolves true → merchant instantly qualifies for the
// Gold criterion (if they meet the rest).
//
// Auth: signed merchant cookie. GET so the "Skip £4.99" link on
// the ladder can be a plain <a href>.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe }         from "@/lib/stripe";
import { supabaseAdmin }     from "@/lib/supabaseAdmin";
import { getMerchantSlug }   from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_PENCE = 499;

function siteOrigin(req: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const slug = await getMerchantSlug();
  if (!slug) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, display_name, insurance_verified, trust_skip_queue_paid_at")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });
  }
  if (listing.insurance_verified || listing.trust_skip_queue_paid_at) {
    // Already verified / already paid — bounce them back to the ladder
    return NextResponse.redirect(`${siteOrigin(req)}/trade-off/edit/${slug}/trust-ladder?skip=already`);
  }

  const stripe = getStripe();
  const origin = siteOrigin(req);
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name:        "Skip the insurance verification queue",
            description: "Instantly qualifies this criterion on the Trust Ladder. Insurance still required — this only skips the manual review queue."
          },
          unit_amount: PRICE_PENCE
        },
        quantity: 1
      }
    ],
    metadata: {
      kind:              "trust.skip_queue",
      merchant_slug:     slug,
      listing_id:        listing.id,
      unit_amount_pence: String(PRICE_PENCE)
    },
    success_url: `${origin}/trade-off/edit/${slug}/trust-ladder?skip=success`,
    cancel_url:  `${origin}/trade-off/edit/${slug}/trust-ladder?skip=cancelled`
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "session_no_url" }, { status: 500 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
