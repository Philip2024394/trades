// POST /api/store/membership
//
// Create a Stripe Checkout session in subscription mode. Two tiers:
//   • monthly — £29/mo
//   • annual  — £249/yr (30% saving vs monthly)
//
// After payment, the webhook (/api/store/stripe-webhook) upserts a
// row into hammerex_store_memberships with status='active' + the
// current_period_end. Success page issues a member cookie via
// /store/membership-success so subsequent downloads are free.
//
// Falls back to a dev stub when Stripe isn't configured, mirroring
// the pattern in /api/store/checkout.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getStripe } from "@/lib/stripe";

const PRICE_MONTHLY_PENCE = 2900;   // £29
const PRICE_ANNUAL_PENCE  = 24900;  // £249

type Tier = "monthly" | "annual";

export async function POST(req: Request) {
  let body: { tier?: unknown; email?: unknown };
  try { body = await req.json(); }
  catch { return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 }); }

  const tier  = body.tier === "annual" ? "annual" : body.tier === "monthly" ? "monthly" : null;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!tier)   return NextResponse.json({ ok: false, error: "invalid-tier"  }, { status: 400 });
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid-email" }, { status: 400 });
  }

  // Pre-create an incomplete membership row so we have an id we can
  // attach to the Stripe session metadata + resolve back from the
  // webhook.
  const ins = await supabaseAdmin
    .from("hammerex_store_memberships")
    .insert({ email, tier: tier as Tier, status: "incomplete" })
    .select("id")
    .single();
  if (ins.error || !ins.data) {
    return NextResponse.json({ ok: false, error: "db-insert-failed", detail: ins.error?.message }, { status: 500 });
  }
  const membershipId = ins.data.id;

  const origin       = new URL(req.url).origin;
  const successUrl   = `${origin}/store/membership-success?membership=${membershipId}`;
  const cancelUrl    = `${origin}/store#pricing?cancelled=1`;
  const unitAmount   = tier === "annual" ? PRICE_ANNUAL_PENCE : PRICE_MONTHLY_PENCE;
  const interval     = tier === "annual" ? "year" : "month";
  const productLabel = tier === "annual" ? "Site Interest — Annual unlimited" : "Site Interest — Monthly unlimited";

  try {
    const stripe  = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode:                 "subscription",
      customer_email:       email,
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency:      "gbp",
          product_data:  { name: productLabel, description: "Unlimited downloads of all Site Interest images. Cancel any time." },
          unit_amount:   unitAmount,
          recurring:     { interval: interval as "month" | "year" }
        },
        quantity: 1
      }],
      success_url:                   successUrl,
      cancel_url:                    cancelUrl,
      allow_promotion_codes:         true,
      metadata:                      { membershipId, tier },
      subscription_data:             { metadata: { membershipId, tier } }
    });
    return NextResponse.json({ ok: true, redirect: session.url });
  } catch (err) {
    console.warn("[store/membership] Stripe unavailable, using dev stub:", (err as Error).message);
    const periodEndMs = tier === "annual"
      ? Date.now() + 365 * 24 * 60 * 60 * 1000
      : Date.now() +  30 * 24 * 60 * 60 * 1000;
    await supabaseAdmin
      .from("hammerex_store_memberships")
      .update({
        status:              "active",
        current_period_end:  new Date(periodEndMs).toISOString(),
        updated_at:          new Date().toISOString()
      })
      .eq("id", membershipId);
    return NextResponse.json({ ok: true, redirect: successUrl, dev_stub: true });
  }
}
