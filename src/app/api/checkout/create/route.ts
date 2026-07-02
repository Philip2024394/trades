// POST /api/checkout/create — creates an Order row and returns the
// next-hop redirect URL the customer should be sent to.
//
// PHASE 1 — works for Payment Link mode only. The customer is sent to
// the merchant's hosted-pay URL with amount + ref appended. We mark
// the order 'pending'; on success-return the cart-success page flips
// it to 'paid'.
//
// PHASES 2-5 — same endpoint will branch on listing.payment_provider
// and call /api/checkout/stripe, /paypal, /square as needed.
//
// Hard rule: this endpoint never sees a card. The next-hop URL is
// always a provider-hosted checkout page.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildPaymentLink,
  generateOrderRef,
  type PaymentProviderKey
} from "@/lib/paymentProviders";
import { hasConfiguredPaymentProvider } from "@/lib/xratedAddons";

type CartLineInput = {
  product_id: string;
  name: string;
  price_pence: number;
  qty: number;
};

type CreateBody = {
  listing_slug: string;
  cart_items: CartLineInput[];
  customer_email?: string;
  customer_name?: string;
  customer_whatsapp?: string;
};

export const runtime = "nodejs";

export async function POST(req: Request) {
  let body: CreateBody;
  try {
    body = (await req.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.listing_slug || !Array.isArray(body.cart_items) || body.cart_items.length === 0) {
    return NextResponse.json(
      { error: "missing_listing_slug_or_cart" },
      { status: 400 }
    );
  }

  const lookup = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select(
      "id, slug, display_name, payment_provider, payment_provider_data, payment_link_template, addons_enabled"
    )
    .eq("slug", body.listing_slug)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 });
  }
  const listing = lookup.data;

  const addons = (listing.addons_enabled ?? {}) as Record<string, boolean>;
  if (addons.online_payments !== true) {
    return NextResponse.json(
      { error: "online_payments_not_enabled" },
      { status: 400 }
    );
  }
  if (!hasConfiguredPaymentProvider(listing)) {
    return NextResponse.json(
      { error: "payment_provider_not_configured" },
      { status: 400 }
    );
  }

  // Compute total. Server-side recomputation — never trust the client's
  // total. Cap qty 1-99 (matches the cart's clamp).
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
  const provider = listing.payment_provider as PaymentProviderKey;

  // Insert the order row with status 'pending'. Webhook (native
  // providers) or success-return (Payment Link mode) will flip it to
  // 'paid'.
  const insert = await supabaseAdmin
    .from("hammerex_xrated_orders")
    .insert({
      listing_id: listing.id,
      order_ref: orderRef,
      amount_pence: totalPence,
      currency: "GBP",
      provider,
      status: "pending",
      customer_email: body.customer_email ?? null,
      customer_name: body.customer_name ?? null,
      customer_whatsapp: body.customer_whatsapp ?? null,
      cart_items: body.cart_items
    })
    .select("id")
    .single();

  if (insert.error || !insert.data) {
    return NextResponse.json(
      { error: "order_insert_failed", detail: insert.error?.message },
      { status: 500 }
    );
  }

  // Stripe / PayPal / Square — delegate to the provider-specific route
  // which owns the SDK setup. We rollback the pending order row (the
  // provider route creates its own) so we don't double-book.
  if (provider === "stripe" || provider === "paypal" || provider === "square") {
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .delete()
      .eq("id", insert.data.id);
    const target =
      provider === "stripe"
        ? "/api/checkout/stripe"
        : provider === "paypal"
          ? "/api/checkout/paypal"
          : "/api/checkout/square";
    const res = await fetch(new URL(target, req.url), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        listing_slug: body.listing_slug,
        cart_items: body.cart_items,
        customer_email: body.customer_email
      })
    });
    const json = await res.json();
    return NextResponse.json(json, { status: res.status });
  }

  // Payment Link — universal fallback. Substitute placeholders in the
  // merchant's hosted-pay URL and send the customer there.
  if (provider === "payment_link") {
    const redirectUrl = buildPaymentLink({
      template: listing.payment_link_template ?? "",
      amountPence: totalPence,
      ref: orderRef
    });
    if (!redirectUrl) {
      return NextResponse.json(
        { error: "payment_link_template_invalid" },
        { status: 500 }
      );
    }
    return NextResponse.json({
      ok: true,
      order_ref: orderRef,
      redirect_url: redirectUrl
    });
  }

  // Unknown provider — safety fallback.
  await supabaseAdmin
    .from("hammerex_xrated_orders")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
    .eq("id", insert.data.id);
  return NextResponse.json(
    { error: "unknown_provider", detail: String(provider) },
    { status: 400 }
  );
}
