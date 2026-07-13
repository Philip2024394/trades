// POST   /api/canteens/[slug]/products/[id]/boost — apply a boost plan
// DELETE /api/canteens/[slug]/products/[id]/boost — cancel active boost
//
// Host-only. Product must live in the caller's canteen. Boost plans
// are the canonical set defined in lib/canteens.ts — clients pick by
// plan id (boost-7d / boost-30d / boost-90d) to avoid clients
// spoofing arbitrary durations or amounts.
//
// Payment is a follow-up ship — this endpoint only writes the boost
// state. When Stripe is wired, apply becomes: verify Stripe intent →
// write boost. For now, the write is trusted (guarded by session).

import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getMerchantIdentity } from "@/lib/merchantSession";
import { CANTEEN_BOOST_PLANS } from "@/lib/canteens";

type BoostPayload = {
  planId: string;
  /** Stripe Checkout Session id returned from POST /api/boost/checkout
   *  after the customer completed payment. When present, the endpoint
   *  verifies the session was paid + matches the plan/target/merchant
   *  before writing the boost row. When absent, the write is refused
   *  unless BOOST_STRIPE_OPTIONAL=1 (tests only). */
  checkoutSessionId?: string;
};

async function assertOwnership(slug: string, productId: string, merchantSlug: string) {
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", slug)
    .maybeSingle();
  if (canteen.error || !canteen.data) {
    return { ok: false as const, status: 404, error: "canteen-not-found" };
  }
  if (canteen.data.host_slug !== merchantSlug) {
    return { ok: false as const, status: 403, error: "not-host" };
  }
  const product = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("id, canteen_id, boost")
    .eq("id", productId)
    .maybeSingle();
  if (product.error || !product.data) {
    return { ok: false as const, status: 404, error: "product-not-found" };
  }
  if (product.data.canteen_id !== canteen.data.id) {
    return { ok: false as const, status: 403, error: "product-not-in-canteen" };
  }
  return { ok: true as const, product: product.data };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug, id } = await params;

  let payload: BoostPayload;
  try {
    payload = (await req.json()) as BoostPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const plan = CANTEEN_BOOST_PLANS.find((p) => p.id === payload.planId);
  if (!plan) {
    return NextResponse.json({ ok: false, error: "invalid-plan" }, { status: 400 });
  }

  const gate = await assertOwnership(slug, id, identity.slug);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  // Stripe verification — the Checkout Session must be paid AND
  // match the plan/target/merchant. Skippable only for tests via
  // BOOST_STRIPE_OPTIONAL=1.
  const stripeOptional = process.env.BOOST_STRIPE_OPTIONAL === "1";
  if (!stripeOptional) {
    if (!payload.checkoutSessionId) {
      return NextResponse.json({ ok: false, error: "payment-required" }, { status: 402 });
    }
    try {
      const session = await getStripe().checkout.sessions.retrieve(payload.checkoutSessionId);
      if (session.payment_status !== "paid") {
        return NextResponse.json({ ok: false, error: "payment-not-paid", detail: session.payment_status }, { status: 402 });
      }
      if (session.amount_total !== plan.priceGbp * 100) {
        return NextResponse.json({ ok: false, error: "amount-mismatch" }, { status: 400 });
      }
      if (session.metadata?.merchant_slug !== identity.slug) {
        return NextResponse.json({ ok: false, error: "wrong-merchant" }, { status: 403 });
      }
      if (session.metadata?.canteen_slug !== slug || session.metadata?.product_id !== id) {
        return NextResponse.json({ ok: false, error: "wrong-target" }, { status: 400 });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[boost.apply] stripe retrieve failed", err);
      return NextResponse.json({ ok: false, error: "stripe-verify-failed" }, { status: 500 });
    }
  }

  const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();
  const boost = {
    expiresAt,
    paidGbp: plan.priceGbp,
    targetTradeSlugs: plan.reach === "all-canteens" ? undefined : [],
    checkoutSessionId: payload.checkoutSessionId ?? null
  };

  const update = await supabaseAdmin
    .from("hammerex_canteen_products")
    .update({ boost })
    .eq("id", id);

  if (update.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.boost.apply] update failed", update.error);
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, plan: plan.id, expiresAt });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const identity = await getMerchantIdentity();
  if (!identity) {
    return NextResponse.json({ ok: false, error: "not-authenticated" }, { status: 401 });
  }
  const { slug, id } = await params;

  const gate = await assertOwnership(slug, id, identity.slug);
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.error }, { status: gate.status });
  }

  const update = await supabaseAdmin
    .from("hammerex_canteen_products")
    .update({ boost: null })
    .eq("id", id);

  if (update.error) {
    // eslint-disable-next-line no-console
    console.error("[canteens.boost.cancel] update failed", update.error);
    return NextResponse.json(
      { ok: false, error: "db-update-failed", detail: update.error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
