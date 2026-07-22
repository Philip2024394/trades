// POST /api/merchant/featured-slots/bid
//
// Body: { amount_gbp }   // £1 minimum, £999 maximum
//
// Places (or updates) a bid for next Monday's featured-slot auction.
// Every bid goes to Stripe checkout; only paid bids compete. Weekly
// cron picks the highest paid bid as the week's winner.
//
// Auth: signed merchant cookie.

import { NextResponse, type NextRequest } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantSlug } from "@/lib/merchantSession";
import { nextMonday } from "@/lib/featuredSlotWeek";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_BID_PENCE = 999;   // £9.99 floor to avoid junk 1p bids
const MAX_BID_PENCE = 99900;

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env && /^https?:\/\//.test(env)) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function POST(req: NextRequest): Promise<Response> {
  const slug = await getMerchantSlug();
  if (!slug) return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });

  const body = await req.json().catch(() => null) as { amount_gbp?: unknown } | null;
  const amountGbp = Number(body?.amount_gbp ?? 0);
  const amountPence = Math.round(amountGbp * 100);
  if (!Number.isFinite(amountPence) || amountPence < MIN_BID_PENCE || amountPence > MAX_BID_PENCE) {
    return NextResponse.json({ ok: false, error: "invalid_amount", floor_gbp: MIN_BID_PENCE / 100 }, { status: 400 });
  }

  const weekStarting = nextMonday();

  // Upsert the bid row — one bid per merchant per week
  const { data: bidRow, error: upErr } = await supabaseAdmin
    .from("hammerex_featured_slot_bids")
    .upsert({
      merchant_slug:    slug,
      week_starting:    weekStarting,
      bid_amount_pence: amountPence,
      status:           "pending"
    }, { onConflict: "merchant_slug,week_starting" })
    .select("id, week_starting, bid_amount_pence")
    .single();

  if (upErr || !bidRow) {
    return NextResponse.json({ ok: false, error: upErr?.message ?? "upsert_failed" }, { status: 500 });
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [{
      price_data: {
        currency: "gbp",
        product_data: {
          name:        `Trade Center featured slot — week starting ${weekStarting}`,
          description: "7-day placement in the featured strip. Auction closes Sunday 23:59 UTC — highest paid bid wins."
        },
        unit_amount: amountPence
      },
      quantity: 1
    }],
    metadata: {
      kind:              "featured_slot.bid",
      merchant_slug:     slug,
      bid_id:            bidRow.id,
      week_starting:     bidRow.week_starting,
      unit_amount_pence: String(amountPence)
    },
    success_url: `${siteOrigin(req)}/trade-off/edit/${slug}/featured-slots?bid=success`,
    cancel_url:  `${siteOrigin(req)}/trade-off/edit/${slug}/featured-slots?bid=cancelled`
  });

  if (!session.url) return NextResponse.json({ ok: false, error: "session_no_url" }, { status: 500 });
  return NextResponse.json({ ok: true, checkout_url: session.url });
}
