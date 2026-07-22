// GET /api/merchant/assets/upsell/footer/checkout?asset=<uuid>
//
// £2.99 one-off unlock — removes the "Powered by The Networkers"
// footer from the specified asset. Webhook branch `asset.footer_removal`
// sets footer_removed_paid_at on the asset row.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE_PENCE = 299;

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
    .select("id, merchant_slug, kind, footer_removed_paid_at")
    .eq("id", assetId)
    .maybeSingle();
  if (!asset || asset.merchant_slug !== slug) {
    return NextResponse.json({ ok: false, error: "not_owner" }, { status: 403 });
  }
  if (asset.footer_removed_paid_at) {
    return NextResponse.redirect(`${siteOrigin(req)}/trade-off/edit/${slug}/assets?footer=already`);
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "gbp",
        product_data: {
          name:        "Remove footer from print asset",
          description: "Hides the 'Powered by The Networkers' line on the selected asset."
        },
        unit_amount: PRICE_PENCE
      },
      quantity: 1
    }],
    metadata: {
      kind:              "asset.footer_removal",
      merchant_slug:     slug,
      asset_id:          asset.id,
      unit_amount_pence: String(PRICE_PENCE)
    },
    success_url: `${siteOrigin(req)}/trade-off/edit/${slug}/assets?footer=success`,
    cancel_url:  `${siteOrigin(req)}/trade-off/edit/${slug}/assets?footer=cancelled`
  });

  if (!session.url) return NextResponse.json({ ok: false, error: "session_no_url" }, { status: 500 });
  return NextResponse.redirect(session.url, { status: 303 });
}
