// GET /api/merchant/trust-ladder/custom-badge/checkout
//
// Platinum-only £2.99 one-time unlock — the merchant chooses a
// custom hex colour for their trust badge chip.
//
// After the checkout webhook confirms payment, the success page
// shows a colour picker. The picked hex is written to
// hammerex_trade_off_listings.trust_badge_color and rendered on
// public canteen + yard cards.
//
// Auth: signed merchant cookie. Gated to platinum only.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe }         from "@/lib/stripe";
import { supabaseAdmin }     from "@/lib/supabaseAdmin";
import { getMerchantSlug }   from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_PENCE = 299;

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
    .select("id, trust_tier, trust_badge_color")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing) {
    return NextResponse.json({ ok: false, error: "listing_not_found" }, { status: 404 });
  }
  if (listing.trust_tier !== "platinum") {
    return NextResponse.json({ ok: false, error: "platinum_only" }, { status: 403 });
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
            name:        "Custom badge colour · Platinum unlock",
            description: "Choose the exact hex colour of your Trust Ladder badge chip shown on your canteen page and every yard listing."
          },
          unit_amount: PRICE_PENCE
        },
        quantity: 1
      }
    ],
    metadata: {
      kind:              "trust.custom_badge",
      merchant_slug:     slug,
      listing_id:        listing.id,
      unit_amount_pence: String(PRICE_PENCE)
    },
    success_url: `${origin}/trade-off/edit/${slug}/trust-ladder?badge=picker`,
    cancel_url:  `${origin}/trade-off/edit/${slug}/trust-ladder?badge=cancelled`
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "session_no_url" }, { status: 500 });
  }
  return NextResponse.redirect(session.url, { status: 303 });
}
