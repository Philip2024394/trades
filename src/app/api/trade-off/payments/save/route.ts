// POST /api/trade-off/payments/save — persists Online Payments add-on
// settings from the dashboard. Validates edit_token, accepts the
// add-on master toggle + provider + Payment-Link template/name.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validatePaymentLinkTemplate } from "@/lib/paymentProviders";

export const runtime = "nodejs";

type Body = {
  slug: string;
  token: string;
  addon_enabled: boolean;
  payment_provider: "stripe" | "paypal" | "square" | "payment_link" | null;
  payment_link_template?: string;
  payment_link_provider_name?: string;
};

export async function POST(req: Request) {
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
    .select("id, edit_token, addons_enabled, payment_provider_data")
    .eq("slug", body.slug)
    .maybeSingle();
  if (row.error || !row.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  if (row.data.edit_token !== body.token) {
    return NextResponse.json({ error: "bad_token" }, { status: 403 });
  }

  // Validate Payment Link template if that's the chosen provider.
  if (body.payment_provider === "payment_link") {
    const err = validatePaymentLinkTemplate(body.payment_link_template ?? "");
    if (err) return NextResponse.json({ error: err }, { status: 400 });
  }

  // BYO Model: gate each native provider on the presence of encrypted
  // credentials. Merchant added them via /api/trade-off/payments/byo-save
  // which stored *_encrypted fields on the listing.
  if (body.payment_provider === "stripe") {
    const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
    if (typeof data.stripe_key_encrypted !== "string" || data.stripe_charges_enabled !== true) {
      return NextResponse.json(
        {
          error: "stripe_not_ready",
          detail: "Add your Stripe secret key on the Stripe card first."
        },
        { status: 400 }
      );
    }
  }
  if (body.payment_provider === "paypal") {
    const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
    if (
      typeof data.paypal_client_id !== "string" ||
      typeof data.paypal_client_secret_encrypted !== "string"
    ) {
      return NextResponse.json(
        {
          error: "paypal_not_ready",
          detail: "Add your PayPal Client ID + Secret on the PayPal card first."
        },
        { status: 400 }
      );
    }
  }
  if (body.payment_provider === "square") {
    const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
    if (
      typeof data.square_access_token_encrypted !== "string" ||
      typeof data.square_location_id !== "string"
    ) {
      return NextResponse.json(
        {
          error: "square_not_ready",
          detail: "Add your Square access token + location ID on the Square card first."
        },
        { status: 400 }
      );
    }
  }

  const addons = (row.data.addons_enabled ?? {}) as Record<string, boolean>;
  addons.online_payments = body.addon_enabled === true;

  const upd = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .update({
      addons_enabled: addons,
      payment_provider: body.payment_provider,
      payment_link_template:
        body.payment_provider === "payment_link"
          ? (body.payment_link_template ?? "").trim()
          : null,
      payment_link_provider_name:
        body.payment_provider === "payment_link"
          ? (body.payment_link_provider_name ?? "").trim() || null
          : null
    })
    .eq("id", row.data.id);

  if (upd.error) {
    return NextResponse.json(
      { error: "update_failed", detail: upd.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
