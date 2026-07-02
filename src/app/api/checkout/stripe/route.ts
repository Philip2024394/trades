// POST /api/checkout/stripe — creates a Stripe Checkout Session for
// the merchant's connected Express account. Funds settle direct to the
// merchant. xratedtrade.com never sees the money.
//
// Customer flow:
//   1. Cart "Pay Now" hits /api/checkout/create which routes here when
//      listing.payment_provider === 'stripe'
//   2. We create a session via Stripe with stripeAccount: <merchant>
//   3. We return the session.url which is the hosted checkout.stripe.com
//      page rendered with the merchant's brand
//   4. Customer pays (card / Apple Pay / Google Pay / Klarna / Clearpay
//      auto-shown via Stripe payment methods)
//   5. Stripe redirects to /<slug>/cart/success?session_id=<id>
//   6. Webhook (separate handler) flips order to 'paid'

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/seo";
import { generateOrderRef } from "@/lib/paymentProviders";
import { decryptCredential } from "@/lib/credentialCrypto";

export const runtime = "nodejs";

type CartLineInput = {
  product_id: string;
  name: string;
  price_pence: number;
  qty: number;
};

type Body = {
  listing_slug: string;
  cart_items: CartLineInput[];
  customer_email?: string;
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
  if (listing.payment_provider !== "stripe") {
    return NextResponse.json(
      { error: "stripe_not_active_provider" },
      { status: 400 }
    );
  }
  const data = (listing.payment_provider_data ?? {}) as Record<string, unknown>;
  const encrypted = data.stripe_key_encrypted as string | undefined;
  if (!encrypted || data.stripe_charges_enabled !== true) {
    return NextResponse.json(
      { error: "stripe_account_not_ready" },
      { status: 400 }
    );
  }
  let key: string;
  try {
    key = decryptCredential(encrypted);
  } catch {
    return NextResponse.json(
      { error: "stripe_key_decrypt_failed" },
      { status: 500 }
    );
  }

  // Server-side total computation — never trust client.
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
      provider: "stripe",
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

  const stripe = new Stripe(key);
  try {
    // BYO model: the API call runs as the merchant (their secret key)
    // → money settles into their Stripe account by default. No
    // stripeAccount header needed — that's only for platform Connect.
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: body.cart_items.map((it) => {
        const qty = Math.max(1, Math.min(99, Math.floor(it.qty)));
        return {
          quantity: qty,
          price_data: {
            currency: "gbp",
            product_data: { name: it.name },
            unit_amount: Math.max(0, Math.floor(it.price_pence))
          }
        };
      }),
      success_url: `${siteUrl()}/${listing.slug}/cart/success?session_id={CHECKOUT_SESSION_ID}&ref=${encodeURIComponent(orderRef)}`,
      cancel_url: `${siteUrl()}/${listing.slug}/cart`,
      client_reference_id: orderRef,
      metadata: {
        listing_id: listing.id,
        order_ref: orderRef
      },
      customer_email: body.customer_email
    });

    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ provider_session_id: session.id })
      .eq("id", orderInsert.data.id);

    return NextResponse.json({
      ok: true,
      order_ref: orderRef,
      redirect_url: session.url
    });
  } catch (e) {
    await supabaseAdmin
      .from("hammerex_xrated_orders")
      .update({ status: "failed" })
      .eq("id", orderInsert.data.id);
    return NextResponse.json(
      { error: "stripe_session_failed", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
