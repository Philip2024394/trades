// POST /api/payments/paypal/refresh-status — checks the merchant's
// integration status from PayPal (using the merchant_id echoed back
// on the return URL, or the previously-stored merchant_id) and mirrors
// payments_receivable + primary_email_confirmed onto our row.
//
// PayPal endpoint: GET /v1/customer/partners/{partner_merchant_id}/
// merchant-integrations/{seller_merchant_id}
//
// The seller-side capabilities we care about:
//   - payments_receivable: they can receive money
//   - primary_email_confirmed: PayPal email verified
//   - products[] with EXPRESS_CHECKOUT active

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paypalConfigured, paypalGet } from "@/lib/paypalClient";

export const runtime = "nodejs";

type Body = { slug: string; token: string; merchant_id?: string };

type MerchantIntegration = {
  payments_receivable?: boolean;
  primary_email_confirmed?: boolean;
  merchant_id?: string;
  products?: { name?: string; vetting_status?: string }[];
};

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json(
      { error: "paypal_platform_not_configured" },
      { status: 503 }
    );
  }
  const partnerId = process.env.PAYPAL_PARTNER_MERCHANT_ID;
  if (!partnerId) {
    return NextResponse.json(
      {
        error: "paypal_partner_merchant_id_missing",
        detail:
          "PAYPAL_PARTNER_MERCHANT_ID must be set (your platform PayPal merchant id) to look up seller integrations."
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
    .select("id, edit_token, payment_provider_data")
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }
  const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
  const merchantId =
    body.merchant_id ??
    (typeof data.paypal_merchant_id === "string"
      ? (data.paypal_merchant_id as string)
      : undefined);
  if (!merchantId) {
    return NextResponse.json(
      { error: "no_merchant_id_yet" },
      { status: 400 }
    );
  }
  try {
    const info = await paypalGet<MerchantIntegration>(
      `/v1/customer/partners/${encodeURIComponent(partnerId)}/merchant-integrations/${encodeURIComponent(merchantId)}`
    );
    const ready =
      info.payments_receivable === true &&
      info.primary_email_confirmed === true;
    await supabaseAdmin
      .from("hammerex_trade_off_listings")
      .update({
        payment_provider_data: {
          ...data,
          paypal_merchant_id: merchantId,
          paypal_payments_receivable: info.payments_receivable === true,
          paypal_primary_email_confirmed: info.primary_email_confirmed === true,
          paypal_status: ready ? "ready" : "pending_onboarding",
          paypal_refreshed_at: new Date().toISOString()
        }
      })
      .eq("id", row.data.id);
    return NextResponse.json({
      ok: true,
      ready,
      payments_receivable: info.payments_receivable === true,
      primary_email_confirmed: info.primary_email_confirmed === true
    });
  } catch (e) {
    return NextResponse.json(
      { error: "paypal_lookup_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
