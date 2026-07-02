// POST /api/checkout/square — BYO model: creates a Square Payment Link
// using the merchant's own access token. Money settles direct to the
// merchant's Square balance. Platform holds no Square credentials.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/seo";
import { generateOrderRef } from "@/lib/paymentProviders";
import { decryptCredential } from "@/lib/credentialCrypto";

export const runtime = "nodejs";

type CartLineInput = { product_id: string; name: string; price_pence: number; qty: number };
type Body = { listing_slug: string; cart_items: CartLineInput[]; customer_email?: string };
type PaymentLinkResponse = {
  payment_link?: { id: string; url: string; order_id: string };
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.listing_slug || !Array.isArray(body.cart_items) || body.cart_items.length === 0) {
    return NextResponse.json({ error: "missing_cart" }, { status: 400 });
  }
  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, slug, display_name, payment_provider, payment_provider_data, addons_enabled")
    .eq("slug", body.listing_slug)
    .maybeSingle();
  if (lookup.error || !lookup.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  const listing = lookup.data;
  const addons = (listing.addons_enabled ?? {}) as Record<string, boolean>;
  if (addons.online_payments !== true) {
    return NextResponse.json({ error: "online_payments_not_enabled" }, { status: 400 });
  }
  if (listing.payment_provider !== "square") {
    return NextResponse.json({ error: "square_not_active_provider" }, { status: 400 });
  }
  const data = (listing.payment_provider_data ?? {}) as Record<string, unknown>;
  const tokenEnc = data.square_access_token_encrypted as string | undefined;
  const locationId = data.square_location_id as string | undefined;
  const env = (data.square_env as string | undefined) ?? "sandbox";
  if (!tokenEnc || !locationId) {
    return NextResponse.json({ error: "square_credentials_missing" }, { status: 400 });
  }

  let totalPence = 0;
  for (const line of body.cart_items) {
    const qty = Math.max(1, Math.min(99, Math.floor(Number(line.qty) || 1)));
    const price = Math.max(0, Math.floor(Number(line.price_pence) || 0));
    totalPence += qty * price;
  }
  if (totalPence === 0) {
    return NextResponse.json({ error: "cart_total_zero" }, { status: 400 });
  }
  const orderRef = generateOrderRef();

  const orderInsert = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .insert({
      listing_id: listing.id,
      order_ref: orderRef,
      amount_pence: totalPence,
      currency: "GBP",
      provider: "square",
      status: "pending",
      customer_email: body.customer_email ?? null,
      cart_items: body.cart_items
    })
    .select("id")
    .single();
  if (orderInsert.error || !orderInsert.data) {
    return NextResponse.json(
      { error: "order_insert_failed", detail: orderInsert.error?.message },
      { status: 500 }
    );
  }

  const base = env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const accessToken = decryptCredential(tokenEnc);

  try {
    const res = await fetch(`${base}/v2/online-checkout/payment-links`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Square-Version": "2025-06-18"
      },
      body: JSON.stringify({
        idempotency_key: orderRef,
        order: {
          location_id: locationId,
          reference_id: orderRef,
          line_items: body.cart_items.map((it) => {
            const qty = Math.max(1, Math.min(99, Math.floor(it.qty)));
            return {
              name: it.name.slice(0, 512),
              quantity: String(qty),
              base_price_money: {
                amount: Math.max(0, Math.floor(it.price_pence)),
                currency: "GBP"
              }
            };
          })
        },
        checkout_options: {
          allow_tipping: false,
          redirect_url: `${siteUrl()}/${listing.slug}/cart/success?ref=${encodeURIComponent(orderRef)}`,
          ask_for_shipping_address: false
        },
        pre_populated_data: body.customer_email
          ? { buyer_email: body.customer_email }
          : undefined
      })
    });
    if (!res.ok) {
      const t = await res.text();
      await supabaseAdmin
        .from("hammerex_xrated_orders")
        .update({ status: "failed" })
        .eq("id", orderInsert.data.id);
      return NextResponse.json({ error: "square_link_failed", detail: t }, { status: 500 });
    }
    const json = (await res.json()) as PaymentLinkResponse;
    const url = json.payment_link?.url;
    if (!url) {
      await supabaseAdmin
        .from("hammerex_xrated_orders")
        .update({ status: "failed" })
        .eq("id", orderInsert.data.id);
      return NextResponse.json({ error: "square_no_url" }, { status: 500 });
    }
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ provider_session_id: json.payment_link?.id ?? null })
      .eq("id", orderInsert.data.id);
    return NextResponse.json({
      ok: true,
      order_ref: orderRef,
      redirect_url: url
    });
  } catch (e) {
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ status: "failed" })
      .eq("id", orderInsert.data.id);
    return NextResponse.json(
      { error: "square_error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
