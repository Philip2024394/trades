// GET /api/merchant/assets/upsell/refresh/checkout?asset=<uuid>
//
// £1.99 one-off unlock — skips the 30-day cooldown for the next
// refresh of the specified asset. Webhook branch `asset.instant_refresh`
// sets instant_refresh_paid_at on the asset row (consumed on the
// next successful /generate call for the same merchant + kind).

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_PENCE = 199;

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: NextRequest): Promise<Response> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const assetId = new URL(req.url).searchParams.get("asset") ?? "";
  const { data: asset } = await supabaseAdmin
    .from("hammerex_merchant_assets")
    .select("id, merchant_slug, kind, instant_refresh_paid_at")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.merchant_slug !== slug) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }
  if (asset.instant_refresh_paid_at) {
    return NextResponse.redirect(`${siteOrigin(req)}/trade-off/edit/${slug}/assets?refresh=already`);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "gbp",
        product_data: {
          name:        "Instant refresh — skip 30-day cooldown",
          description: "Regenerate this asset now instead of waiting for the free monthly refresh."
        },
        unit_amount: PRICE_PENCE
      },
      quantity: 1
    }],
    metadata: {
      kind:              "asset.instant_refresh",
      merchant_slug:     slug,
      asset_id:          asset.id,
      unit_amount_pence: String(PRICE_PENCE)
    },
    success_url: `${siteOrigin(req)}/trade-off/edit/${slug}/assets?refresh=success`,
    cancel_url:  `${siteOrigin(req)}/trade-off/edit/${slug}/assets?refresh=cancelled`
  });

  if (!session.url) return NextResponse.json({ ok: false, error: "session_no_url" }, { status: 500 });
  return NextResponse.redirect(session.url, { status: 303 });
}
