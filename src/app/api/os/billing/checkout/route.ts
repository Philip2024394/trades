// POST /api/os/billing/checkout
// Body: { planKey: string }
// Response: { url } — Stripe Checkout Session URL for the merchant.
import { NextResponse, type NextRequest } from "next/server";
import { requireMerchantSession, MerchantNotAuthenticatedError } from "@/lib/os/merchantSession";
import { OS_BILLING_PLANS_BY_KEY } from "@/lib/os/billing/plans";
import { stripeClient } from "@/lib/os/billing/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { upsertCustomer } from "@/lib/os/billing/subscriptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = { planKey?: unknown };

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireMerchantSession();
  } catch (e) {
    if (e instanceof MerchantNotAuthenticatedError) {
      return NextResponse.json(
        { ok: false, error: "Not authenticated." },
        { status: 401 }
      );
    }
    throw e;
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }
  const planKey = typeof body.planKey === "string" ? body.planKey : "";
  const plan = OS_BILLING_PLANS_BY_KEY[planKey];
  if (!plan) {
    return NextResponse.json(
      { ok: false, error: "Unknown plan." },
      { status: 400 }
    );
  }
  const priceId = process.env[plan.stripePriceEnvVar];
  if (!priceId) {
    return NextResponse.json(
      { ok: false, error: `Plan not configured: ${plan.stripePriceEnvVar} missing.` },
      { status: 500 }
    );
  }

  const { data: merchant } = await supabaseAdmin
    .from("hammerex_trade_off_listings")
    .select("email")
    .eq("id", session.merchantId)
    .maybeSingle();

  const { data: existingCustomer } = await supabaseAdmin
    .from("os_billing_customers")
    .select("stripe_customer_id")
    .eq("merchant_id", session.merchantId)
    .maybeSingle();

  let customerId = existingCustomer?.stripe_customer_id;
  if (!customerId) {
    const created = await stripeClient().customers.create({
      email: merchant?.email ?? undefined,
      metadata: {
        merchant_id: session.merchantId
      }
    });
    customerId = created.id;
    await upsertCustomer({
      merchantId: session.merchantId,
      stripeCustomerId: customerId,
      email: merchant?.email ?? null
    });
  }

  const base = process.env.NEXT_PUBLIC_APP_URL || "https://thenetworkers.app";
  const checkout = await stripeClient().checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${base}/site-office/hub?billing=success`,
    cancel_url: `${base}/site-office/hub?billing=cancelled`,
    metadata: {
      merchant_id: session.merchantId,
      plan_key: plan.key
    },
    subscription_data: {
      metadata: {
        merchant_id: session.merchantId,
        plan_key: plan.key
      }
    }
  });

  return NextResponse.json({ ok: true, url: checkout.url });
}
