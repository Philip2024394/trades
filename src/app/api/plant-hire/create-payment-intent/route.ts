// POST /api/plant-hire/create-payment-intent — creates a Stripe
// Checkout Session for a plant-hire booking deposit. Returns { url }
// which the client redirects to; success + cancel URLs bounce back to
// /plant-hire/pay/success and /plant-hire/pay/cancel respectively.

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/plantStripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Body = { booking_id?: string; booking_reference?: string; origin?: string };

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      {
        error: "stripe_not_configured",
        message:
          "Platform Stripe not configured. Ask the merchant for a payment link — the accepted gateways strip on cart/booking will show BACS, PayPal, GoCardless or Stripe link if they've provided one."
      },
      { status: 503 }
    );
  }
  if (!body.booking_id && !body.booking_reference) {
    return NextResponse.json({ error: "missing_booking" }, { status: 400 });
  }

  const q = supabaseAdmin.from("hammerex_plant_hire_bookings").select("*");
  const bookingRes = body.booking_id
    ? await q.eq("id", body.booking_id).maybeSingle()
    : await q.eq("reference", body.booking_reference).maybeSingle();
  if (!bookingRes.data) {
    return NextResponse.json({ error: "booking_not_found" }, { status: 404 });
  }
  const booking = bookingRes.data;
  if (!booking.deposit_pence || booking.deposit_pence <= 0) {
    return NextResponse.json({ error: "no_deposit_required" }, { status: 400 });
  }
  const listing = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("slug, display_name")
    .eq("id", booking.listing_id)
    .maybeSingle();

  const origin =
    body.origin ??
    req.headers.get("origin") ??
    req.headers.get("x-forwarded-host") ??
    "https://thenetworkers.app";

  const slug = listing.data?.slug ?? "";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: booking.customer_email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "gbp",
            unit_amount: booking.deposit_pence,
            product_data: {
              name: `Deposit · ${booking.machine_label ?? booking.machine_slug} × ${booking.quantity}`,
              description: `Hire reference ${booking.reference}. Balance due ${
                booking.date_from ?? "on delivery"
              }.`
            }
          }
        }
      ],
      metadata: {
        booking_id: booking.id,
        booking_reference: booking.reference,
        listing_slug: slug
      },
      success_url: `${origin}/${slug}/plant-hire/pay/success?ref=${booking.reference}`,
      cancel_url: `${origin}/${slug}/plant-hire/pay/cancel?ref=${booking.reference}`
    });

    // Store the session id so the webhook can reconcile.
    await supabaseAdmin
      .from("hammerex_plant_hire_bookings")
      .update({ stripe_payment_intent_id: session.id })
      .eq("id", booking.id);

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "stripe error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
