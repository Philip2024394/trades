// POST /api/checkout/paypal — BYO model: creates a PayPal Order using
// the merchant's own client_id + secret. Money settles direct to the
// merchant's PayPal Business account. Platform holds no PayPal
// credentials.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/seo";
import { generateOrderRef } from "@/lib/paymentProviders";
import { decryptCredential } from "@/lib/credentialCrypto";

export const runtime = "nodejs";

type CartLineInput = { product_id: string; name: string; price_pence: number; qty: number };
type Body = { listing_slug: string; cart_items: CartLineInput[]; customer_email?: string };
type OrderResponse = { id: string; links?: { href: string; rel: string }[] };

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
  if (listing.payment_provider !== "paypal") {
    return NextResponse.json({ error: "paypal_not_active_provider" }, { status: 400 });
  }
  const data = (listing.payment_provider_data ?? {}) as Record<string, unknown>;
  const clientId = data.paypal_client_id as string | undefined;
  const clientSecretEnc = data.paypal_client_secret_encrypted as string | undefined;
  const env = (data.paypal_env as string | undefined) ?? "sandbox";
  if (!clientId || !clientSecretEnc) {
    return NextResponse.json({ error: "paypal_credentials_missing" }, { status: 400 });
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
  const totalPounds = (totalPence / 100).toFixed(2);
  const orderRef = generateOrderRef();

  const orderInsert = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .insert({
      listing_id: listing.id,
      order_ref: orderRef,
      amount_pence: totalPence,
      currency: "GBP",
      provider: "paypal",
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

  const base = env === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  try {
    // OAuth: platform-agnostic — uses the merchant's own client_id + secret.
    const basic = Buffer.from(`${clientId}:${decryptCredential(clientSecretEnc)}`).toString("base64");
    const tokRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!tokRes.ok) {
      await supabaseAdmin
        .from("hammerex_xrated_orders")
        .update({ status: "failed" })
        .eq("id", orderInsert.data.id);
      return NextResponse.json({ error: "paypal_auth_failed" }, { status: 400 });
    }
    const tok = (await tokRes.json()) as { access_token: string };

    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tok.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: orderRef,
            custom_id: orderRef,
            amount: {
              currency_code: "GBP",
              value: totalPounds,
              breakdown: {
                item_total: { currency_code: "GBP", value: totalPounds }
              }
            },
            items: body.cart_items.map((it) => {
              const qty = Math.max(1, Math.min(99, Math.floor(it.qty)));
              return {
                name: it.name.slice(0, 127),
                quantity: String(qty),
                unit_amount: {
                  currency_code: "GBP",
                  value: (Math.max(0, Math.floor(it.price_pence)) / 100).toFixed(2)
                }
              };
            })
          }
        ],
        application_context: {
          return_url: `${siteUrl()}/${listing.slug}/cart/success?ref=${encodeURIComponent(orderRef)}`,
          cancel_url: `${siteUrl()}/${listing.slug}/cart`,
          brand_name: listing.display_name ?? listing.slug,
          user_action: "PAY_NOW",
          shipping_preference: "NO_SHIPPING"
        }
      })
    });
    if (!orderRes.ok) {
      const t = await orderRes.text();
      await supabaseAdmin
        .from("hammerex_xrated_orders")
        .update({ status: "failed" })
        .eq("id", orderInsert.data.id);
      return NextResponse.json({ error: "paypal_order_failed", detail: t }, { status: 500 });
    }
    const paypalOrder = (await orderRes.json()) as OrderResponse;
    const approveUrl = paypalOrder.links?.find((l) => l.rel === "approve")?.href;
    if (!approveUrl) {
      await supabaseAdmin
        .from("hammerex_xrated_orders")
        .update({ status: "failed" })
        .eq("id", orderInsert.data.id);
      return NextResponse.json({ error: "paypal_no_approve_url" }, { status: 500 });
    }
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ provider_session_id: paypalOrder.id })
      .eq("id", orderInsert.data.id);
    return NextResponse.json({
      ok: true,
      order_ref: orderRef,
      redirect_url: approveUrl
    });
  } catch (e) {
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ status: "failed" })
      .eq("id", orderInsert.data.id);
    return NextResponse.json(
      { error: "paypal_error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
