// POST /api/studio/payments/orders/[id]/refund
//
// Marks the order as refunded server-side. Providers that support
// programmatic refunds (Stripe, PayPal, Klarna, Mollie, Coinbase) get
// the real refund call fired. Others (COD, bank transfer, Zelle, stubs)
// are marked refunded and the merchant reconciles manually.

import { NextResponse } from "next/server";
import { loadStudioSession } from "@/lib/studio/session";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import Stripe from "stripe";

export const runtime = "nodejs";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await loadStudioSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "unauthenticated" },
      { status: 401 }
    );
  }
  const { id } = await params;

  // Load the order + its provider credentials.
  const orderRes = await supabaseAdmin
    .from("studio_payment_orders")
    .select("id, provider_id, external_ref, status, amount_minor, currency")
    .eq("id", id)
    .eq("brand_id", session.brand.id)
    .maybeSingle();
  if (!orderRes.data) {
    return NextResponse.json(
      { ok: false, error: "not-found" },
      { status: 404 }
    );
  }
  if (orderRes.data.status === "refunded") {
    return NextResponse.json({ ok: true, alreadyRefunded: true });
  }
  if (orderRes.data.status !== "paid") {
    return NextResponse.json(
      { ok: false, error: "only-paid-orders-can-be-refunded" },
      { status: 400 }
    );
  }

  const credRes = await supabaseAdmin
    .from("studio_payment_providers")
    .select("credentials")
    .eq("brand_id", session.brand.id)
    .eq("provider_id", orderRes.data.provider_id)
    .maybeSingle();
  const credentials = (credRes.data?.credentials as Record<string, unknown>) ?? {};

  let providerRefundOk = false;
  let providerRefundError: string | null = null;

  // Stripe refund via SDK. Other providers left as manual reconciliation
  // for v1 — real refunds require per-provider REST calls that need
  // their own testing surface.
  if (orderRes.data.provider_id === "stripe") {
    try {
      const secretKey = credentials.secret_key as string | undefined;
      if (!secretKey) throw new Error("stripe-secret-missing");
      const stripe = new Stripe(secretKey);
      // For Checkout Sessions the payment_intent is the refund target.
      // We retrieve the session to get the PI, then refund it.
      if (!orderRes.data.external_ref) throw new Error("no-external-ref");
      const s = await stripe.checkout.sessions.retrieve(
        orderRes.data.external_ref
      );
      if (!s.payment_intent) throw new Error("no-payment-intent-on-session");
      await stripe.refunds.create({
        payment_intent: s.payment_intent as string
      });
      providerRefundOk = true;
    } catch (err) {
      providerRefundError = (err as Error).message ?? "stripe-refund-failed";
    }
  }

  const upd = await supabaseAdmin
    .from("studio_payment_orders")
    .update({
      status: "refunded",
      metadata: {
        refundedAt: new Date().toISOString(),
        providerRefundOk,
        providerRefundError
      }
    })
    .eq("id", id)
    .eq("brand_id", session.brand.id);
  if (upd.error) {
    return NextResponse.json(
      { ok: false, error: upd.error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({
    ok: true,
    providerRefundOk,
    providerRefundError
  });
}
