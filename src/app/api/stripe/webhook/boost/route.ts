// POST /api/stripe/webhook/boost
//
// Stripe webhook for canteen boost checkout events. Verifies signature
// with STRIPE_BOOST_WEBHOOK_SECRET. Handles:
//
//   checkout.session.completed  → activates the boost row (redundant
//                                  safety — the client's redirect
//                                  handler also fires the apply)
//   payment_intent.payment_failed → logs; no-op on our side (Stripe
//                                    handles the refund via its own
//                                    machinery)

import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { CANTEEN_BOOST_PLANS } from "@/lib/canteens";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Stripe needs the raw body for signature verification — Next.js
// serves it correctly when we read via `req.text()` inside the
// handler (no need for body parsing config).

async function handleCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
  if (session.metadata?.purpose !== "canteen-boost") return;
  if (session.payment_status !== "paid") return;

  const planId = session.metadata.plan_id;
  const canteenSlug = session.metadata.canteen_slug;
  const productId = session.metadata.product_id;
  const merchantSlug = session.metadata.merchant_slug;
  const plan = CANTEEN_BOOST_PLANS.find((p) => p.id === planId);
  if (!plan || !canteenSlug || !productId || !merchantSlug) {
    // eslint-disable-next-line no-console
    console.warn("[stripe.webhook.boost] incomplete metadata", session.id);
    return;
  }

  // Ownership + amount check even in the webhook path — never trust
  // client-supplied identifiers, and never trust Stripe metadata
  // without cross-verifying against the DB.
  const canteen = await supabaseAdmin
    .from("hammerex_canteens")
    .select("id, host_slug")
    .eq("slug", canteenSlug)
    .maybeSingle();
  if (!canteen.data || canteen.data.host_slug !== merchantSlug) return;

  const product = await supabaseAdmin
    .from("hammerex_canteen_products")
    .select("id, boost")
    .eq("id", productId)
    .eq("canteen_id", canteen.data.id)
    .maybeSingle();
  if (!product.data) return;

  // Idempotent — if a boost with this session id is already recorded
  // don't overwrite.
  const existingBoost = (product.data.boost ?? null) as { checkoutSessionId?: string } | null;
  if (existingBoost?.checkoutSessionId === session.id) return;

  if (session.amount_total !== plan.priceGbp * 100) return;

  const expiresAt = new Date(Date.now() + plan.days * 24 * 60 * 60 * 1000).toISOString();
  const boost = {
    expiresAt,
    paidGbp: plan.priceGbp,
    targetTradeSlugs: plan.reach === "all-canteens" ? undefined : [],
    checkoutSessionId: session.id
  };

  await supabaseAdmin
    .from("hammerex_canteen_products")
    .update({ boost })
    .eq("id", productId);
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_BOOST_WEBHOOK_SECRET;
  if (!secret) {
    // eslint-disable-next-line no-console
    console.error("[stripe.webhook.boost] STRIPE_BOOST_WEBHOOK_SECRET not configured");
    return NextResponse.json({ ok: false, error: "webhook-not-configured" }, { status: 500 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ ok: false, error: "missing-signature" }, { status: 400 });
  }

  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(raw, signature, secret);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe.webhook.boost] signature verify failed", err);
    return NextResponse.json({ ok: false, error: "signature-verify-failed" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "payment_intent.payment_failed":
        // No-op — Stripe handles refunds/retries in-app. We log for
        // future observability + rate-limit heuristics.
        // eslint-disable-next-line no-console
        console.warn("[stripe.webhook.boost] payment failed", (event.data.object as { id: string }).id);
        break;
      default:
        // Ignore other events silently.
        break;
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[stripe.webhook.boost] handler threw", err);
    // 500 lets Stripe retry the delivery.
    return NextResponse.json({ ok: false, error: "handler-failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
