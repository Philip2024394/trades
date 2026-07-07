// POST /api/os/vault/checkout
//
// Creates a Stripe Checkout Session for a homeowner subscribing to a
// Property Vault plan (base, addon, lifetime, trial).
//
// The requested plan's Stripe price ID for the chosen interval must
// exist. If the Stripe products haven't been created yet, the route
// returns a specific error the UI can show ("Plan not yet available
// for purchase — coming soon"). This lets the upgrade page ship
// before Stripe products are configured without breaking.

import { NextResponse } from "next/server";
import Stripe from "stripe";
import { loadHomeownerSession } from "@/lib/os/homeownerSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CheckoutBody = {
  planKey?: string;
  interval?: "monthly" | "annual" | "one_off";
};

type PlanRow = {
  plan_key: string;
  plan_type: string;
  headline: string;
  stripe_price_id_monthly: string | null;
  stripe_price_id_annual: string | null;
  stripe_price_id_one_off: string | null;
  entitlements: { requires_plan?: string };
};

function absoluteUrl(request: Request, path: string): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return `${configured.replace(/\/$/, "")}${path}`;
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${path}`;
}

export async function POST(request: Request) {
  const party = await loadHomeownerSession();
  if (!party) {
    return NextResponse.json(
      { ok: false, error: "Not authenticated." },
      { status: 401 }
    );
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json(
      { ok: false, error: "stripe_not_configured" },
      { status: 503 }
    );
  }

  let body: CheckoutBody;
  try {
    body = (await request.json()) as CheckoutBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const planKey = body.planKey;
  const interval: "monthly" | "annual" | "one_off" =
    body.interval ?? "monthly";

  if (!planKey) {
    return NextResponse.json(
      { ok: false, error: "planKey is required." },
      { status: 400 }
    );
  }

  const { data: plan } = await supabaseAdmin
    .from("os_homeowner_plans")
    .select(
      "plan_key, plan_type, headline, stripe_price_id_monthly, stripe_price_id_annual, stripe_price_id_one_off, entitlements"
    )
    .eq("plan_key", planKey)
    .eq("active", true)
    .maybeSingle();
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "Unknown plan." },
      { status: 404 }
    );
  }
  const planRow = plan as PlanRow;

  // Add-ons require the base plan to already be active
  const requiredPlan = planRow.entitlements?.requires_plan;
  if (requiredPlan) {
    const { data: baseSub } = await supabaseAdmin
      .from("os_homeowner_subscriptions")
      .select("id")
      .eq("party_id", party.id)
      .eq("plan_key", requiredPlan)
      .in("status", ["active", "trialing"])
      .maybeSingle();
    if (!baseSub) {
      return NextResponse.json(
        {
          ok: false,
          error: "requires_base_plan",
          message: `This add-on requires the ${requiredPlan} plan.`
        },
        { status: 409 }
      );
    }
  }

  const priceId =
    interval === "annual"
      ? planRow.stripe_price_id_annual
      : interval === "one_off"
        ? planRow.stripe_price_id_one_off
        : planRow.stripe_price_id_monthly;

  if (!priceId) {
    return NextResponse.json(
      {
        ok: false,
        error: "price_not_configured",
        message:
          "This plan is not yet available for purchase. Stripe product setup pending."
      },
      { status: 503 }
    );
  }

  const stripe = new Stripe(stripeKey);

  // Reuse an existing Stripe customer for this party if one exists
  let stripeCustomerId: string | undefined;
  const { data: existingSub } = await supabaseAdmin
    .from("os_homeowner_subscriptions")
    .select("stripe_customer_id")
    .eq("party_id", party.id)
    .not("stripe_customer_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (existingSub?.stripe_customer_id) {
    stripeCustomerId = existingSub.stripe_customer_id as string;
  }

  const isSubscription = planRow.plan_type !== "lifetime";
  const successUrl = absoluteUrl(
    request,
    `/home/vault?checkout=success&plan=${encodeURIComponent(planKey)}`
  );
  const cancelUrl = absoluteUrl(request, "/home/vault/upgrade?checkout=cancel");

  try {
    const session = await stripe.checkout.sessions.create({
      mode: isSubscription ? "subscription" : "payment",
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : (party.email ?? undefined),
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: party.id,
      metadata: { party_id: party.id, plan_key: planKey },
      subscription_data: isSubscription
        ? { metadata: { party_id: party.id, plan_key: planKey } }
        : undefined,
      success_url: successUrl,
      cancel_url: cancelUrl
    });

    return NextResponse.json({ ok: true, url: session.url });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        error: "checkout_failed",
        message: e instanceof Error ? e.message : "unknown"
      },
      { status: 500 }
    );
  }
}
