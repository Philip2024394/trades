// POST /api/payments/paypal/onboard — PayPal Commerce Platform
// Partner Referrals onboarding.
//
// Same UX shape as Stripe Connect Express: merchant clicks Connect
// PayPal → redirected into PayPal's hosted onboarding → returns with
// their merchant_id in the query string → we call /partner-referrals
// again (or /customer/partners/<id>/merchant-integrations/<mid>) to
// confirm capabilities and mark them 'ready'.
//
// Requires (one-time platform-level):
//   PAYPAL_CLIENT_ID          Platform partner client_id
//   PAYPAL_CLIENT_SECRET      Platform partner secret
//   PAYPAL_ENV=live|sandbox   Which PayPal env to hit
//   PAYPAL_BN_CODE            Optional BN attribution code
//
// PayPal Partner enrolment (once): https://www.paypal.com/us/webapps/mpp/partner-program

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paypalConfigured, paypalPost } from "@/lib/paypalClient";
import { siteUrl } from "@/lib/seo";

export const runtime = "nodejs";

type Body = { slug: string; token: string };

type ReferralLink = { href: string; rel: string };
type ReferralResponse = { links?: ReferralLink[] };

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json(
      {
        error: "paypal_platform_not_configured",
        detail:
          "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET / PAYPAL_ENV are not set. Enrol at https://www.paypal.com/us/webapps/mpp/partner-program and set the env vars to activate one-click PayPal onboarding for every merchant."
      },
      { status: 503 }
    );
  }
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.slug || !body.token) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 });
  }
  const row = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, edit_token, display_name, email, payment_provider_data"
    )
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  // Tracking id — echoed back as ?merchantIdInPayPal / merchantId when
  // the merchant returns from onboarding. Use listing.id so we can look
  // them up. PayPal caps tracking_id to 127 chars.
  const trackingId = `xrated-${row.data.id}`.slice(0, 127);
  const returnUrl = `${siteUrl()}/trade-off/edit/${encodeURIComponent(
    row.data.slug
  )}/payments?token=${encodeURIComponent(body.token)}&paypal_connected=1`;

  try {
    const referral = await paypalPost<ReferralResponse>(
      "/v2/customer/partner-referrals",
      {
        tracking_id: trackingId,
        partner_config_override: {
          return_url: returnUrl,
          return_url_description: "Return to thenetworkers.app"
        },
        operations: [
          {
            operation: "API_INTEGRATION",
            api_integration_preference: {
              rest_api_integration: {
                integration_method: "PAYPAL",
                integration_type: "THIRD_PARTY",
                third_party_details: {
                  features: ["PAYMENT", "REFUND", "READ_SELLER_DISPUTE"]
                }
              }
            }
          }
        ],
        products: ["EXPRESS_CHECKOUT"],
        legal_consents: [{ type: "SHARE_DATA_CONSENT", granted: true }]
      }
    );

    const actionUrl = referral.links?.find((l) => l.rel === "action_url")?.href;
    if (!actionUrl) {
      return NextResponse.json(
        { error: "paypal_no_action_url" },
        { status: 500 }
      );
    }

    // Stamp the tracking id + provider on the row so the callback
    // handler can match returned merchant IDs back to this listing.
    const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        payment_provider_data: {
          ...data,
          paypal_tracking_id: trackingId,
          paypal_status: "pending_onboarding",
          paypal_started_at: new Date().toISOString()
        }
      })
      .eq("id", row.data.id);

    return NextResponse.json({ ok: true, url: actionUrl });
  } catch (e) {
    return NextResponse.json(
      { error: "paypal_referral_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
