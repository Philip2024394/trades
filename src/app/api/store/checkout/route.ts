// POST /api/store/checkout
//
// Create a Stripe Checkout session for a Store purchase.
// Accepts either:
//   • { imageId, email }            — legacy single-image path
//   • { imageIds: string[], email } — pack path (1-50 images, priced
//                                     via PACK_TIERS ladder)
//
// One order row per checkout; multiple items live in items_json.
// Falls through to a dev-stub (mark paid + redirect) when Stripe
// isn't configured — lets us iterate the UX without a Stripe key.

import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";
import { storeImageById } from "@/lib/storeLibrary.server";

// Pack pricing ladder — must match src/app/store/useStoreCart.ts.
// Duplicated here (server) rather than imported because useStoreCart
// is a client-only module ("use client").
const PACK_TIERS: Array<{ size: number; priceGbp: number; label: string }> = [
  { size: 1,  priceGbp: 10,  label: "Single image"  },
  { size: 5,  priceGbp: 39,  label: "Pack of 5"     },
  { size: 10, priceGbp: 69,  label: "Pack of 10"    },
  { size: 25, priceGbp: 149, label: "Pack of 25"    },
  { size: 50, priceGbp: 249, label: "Pack of 50"    }
];
function priceForCount(count: number): { size: number; priceGbp: number; label: string } {
  if (count <= 0) return PACK_TIERS[0];
  for (const t of PACK_TIERS) if (count <= t.size) return t;
  return PACK_TIERS[PACK_TIERS.length - 1];
}

export async function POST(req: Request) {
  let body: { imageId?: string; imageIds?: string[]; email?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const email = body.email?.trim().toLowerCase();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  // Resolve list of image ids — support both shapes.
  const rawIds = Array.isArray(body.imageIds) ? body.imageIds : (body.imageId ? [body.imageId] : []);
  const ids = rawIds
    .map((x) => String(x).trim())
    .filter((x) => x.length > 0);
  if (ids.length === 0) {
    return NextResponse.json({ ok: false, error: "no-items" }, { status: 400 });
  }
  if (ids.length > 50) {
    return NextResponse.json({ ok: false, error: "pack-too-large", detail: "Maximum 50 images per order" }, { status: 400 });
  }

  // Resolve each id to a full image entry. Reject if any id doesn't exist.
  const resolved = await Promise.all(ids.map((id) => storeImageById(id)));
  const items = resolved
    .filter((e): e is NonNullable<typeof e> => Boolean(e))
    .map((e) => ({ id: e.id, url: e.url, alt: e.alt }));

  if (items.length !== ids.length) {
    return NextResponse.json({ ok: false, error: "unknown-image", detail: "One or more images not found" }, { status: 404 });
  }

  const tier = priceForCount(items.length);
  const singleImage = items.length === 1 ? items[0] : null;

  // Insert pending order row.
  const downloadToken = crypto.randomBytes(24).toString("hex");
  const ins = await supabaseAdmin
    .from("hammerex_store_orders")
    .insert({
      buyer_email:         email,
      item_id:             singleImage?.id  ?? null,
      item_url:            singleImage?.url ?? null,
      item_alt:            singleImage?.alt ?? null,
      items_json:          items,
      pack_size:           items.length,
      price_gbp:           tier.priceGbp,
      download_token:      downloadToken,
      download_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
    })
    .select("id")
    .single();

  if (ins.error || !ins.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: ins.error?.message }, { status: 500 });
  }
  const orderId = ins.data.id;

  const origin = new URL(req.url).origin;
  const successUrl = `${origin}/store/success?order=${orderId}&token=${downloadToken}`;
  const cancelUrl  = items.length === 1
    ? `${origin}/store/i/${encodeURIComponent(items[0].id)}?cancelled=1`
    : `${origin}/store/cart?cancelled=1`;

  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode:                 "payment",
      customer_email:       email,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency:     "gbp",
          product_data: {
            name:        tier.label,
            description: items.length === 1
              ? (items[0].alt ?? "Site Interest image").slice(0, 100)
              : `${items.length} images — commercial licence`
          },
          unit_amount: tier.priceGbp * 100
        },
        quantity: 1
      }],
      success_url: successUrl,
      cancel_url:  cancelUrl,
      metadata:    { orderId, packSize: String(items.length) }
    });
    await supabaseAdmin
      .from("hammerex_store_orders")
      .update({ stripe_session_id: session.id })
      .eq("id", orderId);
    return NextResponse.json({ ok: true, redirect: session.url });
  } catch (err) {
    console.warn("[store/checkout] Stripe unavailable, using dev stub:", (err as Error).message);
    await supabaseAdmin
      .from("hammerex_store_orders")
      .update({ paid: true, paid_at: new Date().toISOString() })
      .eq("id", orderId);
    return NextResponse.json({ ok: true, redirect: successUrl, dev_stub: true });
  }
}
