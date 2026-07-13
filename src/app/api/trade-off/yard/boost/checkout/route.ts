// POST /api/trade-off/yard/boost/checkout
//
// Creates a Stripe one-time Checkout Session for a Yard post boost.
// After the customer pays, /api/stripe/webhook receives
// checkout.session.completed and branches on metadata.kind === 'boost'
// to extend hammerex_trade_off_yard_posts.is_boosted_until.
//
// Request body: { slug, edit_token, post_id, hours }
//   hours ∈ { 24, 48 }
//
// Prices (pence):
//   24h → 200p (£2)
//   48h → 500p (£5)
//
// Auth: constant-time slug + edit_token, ownership check on the post.

import { NextResponse, type NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_HOURS = new Set([24, 48]);
const PRICES_PENCE: Record<number, number> = {
  24: 200,
  48: 500
};

function s(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function constantTimeEq(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  let diff = 0;
  for (let i = 0; i < ha.length; i++) diff |= ha[i] ^ hb[i];
  return diff === 0;
}

function siteOrigin(req: NextRequest): string {
  const envOrigin = process.env.NEXT_PUBLIC_SITE_URL;
  if (envOrigin && /^https?:\/\//.test(envOrigin)) {
    return envOrigin.replace(/\/$/, "");
  }
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid_body" },
      { status: 400 }
    );
  }

  const slug = s(body.slug).trim();
  const editToken = s(body.edit_token).trim();
  const postId = s(body.post_id).trim();
  const hours = typeof body.hours === "number" ? body.hours : 24;

  if (!slug || !editToken || !postId) {
    return NextResponse.json(
      { ok: false, error: "missing_args" },
      { status: 400 }
    );
  }
  if (!ALLOWED_HOURS.has(hours)) {
    return NextResponse.json(
      { ok: false, error: "invalid_hours" },
      { status: 400 }
    );
  }

  const { data: listing } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("id, edit_token, status, display_name")
    .eq("slug", slug)
    .maybeSingle();
  if (!listing || !constantTimeEq(listing.edit_token, editToken)) {
    return NextResponse.json(
      { ok: false, error: "unauthorised" },
      { status: 401 }
    );
  }
  if (listing.status !== "live") {
    return NextResponse.json(
      { ok: false, error: "listing_not_live" },
      { status: 403 }
    );
  }

  const { data: post } = await supabaseAdmin
    .from("hammerex_trade_off_yard_posts")
    .select("id, listing_id, title")
    .eq("id", postId)
    .maybeSingle();
  if (!post) {
    return NextResponse.json(
      { ok: false, error: "post_not_found" },
      { status: 404 }
    );
  }
  if (post.listing_id !== listing.id) {
    return NextResponse.json(
      { ok: false, error: "not_post_owner" },
      { status: 403 }
    );
  }

  const priceP = PRICES_PENCE[hours];
  const origin = siteOrigin(req);

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Boost your Yard post — ${hours}h`,
            description: `Floats "${post.title.slice(0, 90)}" to the top of The Yard for ${hours} hours.`
          },
          unit_amount: priceP
        },
        quantity: 1
      }
    ],
    // Metadata surfaces on the webhook so we know how to apply the boost.
    metadata: {
      kind: "boost",
      post_id: postId,
      listing_id: listing.id,
      hours: String(hours),
      unit_amount_pence: String(priceP)
    },
    success_url: `${origin}/trade-off/yard?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}&boost=success`,
    cancel_url: `${origin}/trade-off/yard?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(editToken)}&boost=cancelled`
  });

  if (!session.url) {
    return NextResponse.json(
      { ok: false, error: "session_no_url" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, url: session.url });
}
