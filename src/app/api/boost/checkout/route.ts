// POST /api/boost/checkout
//
// Creates a Stripe Checkout Session for a canteen product boost.
// Returns a hosted URL — client redirects the user via
// window.location.href. On success the customer lands back at the
// manage page with ?boost_ok=1&session_id=cs_xxx and the boost is
// activated (either by the webhook or by a synchronous verify call
// against the returned session_id).
//
// Auth: signed trade session. Ownership check runs on the eventual
// boost-apply endpoint (which the return handler / webhook calls).

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { CANTEEN_BOOST_PLANS } from "@/lib/canteens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Payload = {
  planId: string;
  canteenSlug: string;
  productId: string;
};

export async function POST(req: Request) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }

  let payload: Payload;
  try {
    payload = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }

  const plan = CANTEEN_BOOST_PLANS.find((p) => p.id === payload.planId);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "invalid-plan" }, { status: 400 });
  }
  if (!payload.canteenSlug || !payload.productId) {
    return NextResponse.json({ ok: false, error: "missing-target" }, { status: 400 });
  }

  // Ownership pre-check — refuse the checkout up-front if the caller
  // doesn't own the canteen. Saves the buyer a chargeable event they
  // couldn't apply anyway.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", payload.canteenSlug)
    .maybeSingle();
  if (!canteen.data || canteen.data.host_slug !== identity.slug) {
    return NextResponse.json({ ok: false, error: "not-host" }, { status: 403 });
  }
  const product = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("id, name")
    .eq("id", payload.productId)
    .eq("canteen_id", canteen.data.id)
    .maybeSingle();
  if (!product.data) {
    return NextResponse.json({ ok: false, error: "product-not-in-canteen" }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  const successPath = `/trade-off/yard/canteens/${encodeURIComponent(payload.canteenSlug)}/manage?boost_ok=1&session_id={CHECKOUT_SESSION_ID}`;
  const cancelPath = `/trade-off/yard/canteens/${encodeURIComponent(payload.canteenSlug)}/manage?boost_cancelled=1`;

  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "gbp",
          product_data: {
            name: `Canteen boost · ${plan.label}`,
            description: `${product.data.name} — ${plan.reach === "all-canteens" ? "All canteens" : "Trade-targeted"}`
          },
          unit_amount: plan.priceGbp * 100
        },
        quantity: 1
      }],
      success_url: `${origin}${successPath}`,
      cancel_url: `${origin}${cancelPath}`,
      metadata: {
        purpose: "canteen-boost",
        plan_id: plan.id,
        canteen_slug: payload.canteenSlug,
        product_id: payload.productId,
        merchant_slug: identity.slug
      }
    });

    return NextResponse.json({
      ok: true,
      url: session.url,
      sessionId: session.id
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[boost.checkout] stripe error", err);
    return NextResponse.json(
      { ok: false, error: "stripe-create-failed", detail: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
