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
import {
  refundPaypal,
  refundMollie,
  refundRazorpay,
  refundCoinbase,
  refundKlarna,
  refundAdyen
} from "@/platform/buttons/payments/refunds";

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

  const pid = orderRes.data.provider_id;
  const externalRef = orderRes.data.external_ref;

  if (!externalRef) {
    providerRefundError = "no-external-ref-on-order";
  } else if (pid === "stripe") {
    try {
      const secretKey = credentials.secret_key as string | undefined;
      if (!secretKey) throw new Error("stripe-secret-missing");
      const stripe = new Stripe(secretKey);
      const s = await stripe.checkout.sessions.retrieve(externalRef);
      if (!s.payment_intent) throw new Error("no-payment-intent-on-session");
      await stripe.refunds.create({
        payment_intent: s.payment_intent as string
      });
      providerRefundOk = true;
    } catch (err) {
      providerRefundError = (err as Error).message ?? "stripe-refund-failed";
    }
  } else if (pid === "paypal") {
    const r = await refundPaypal({
      credentials,
      externalRef,
      amountMinor: orderRes.data.amount_minor,
      currency: orderRes.data.currency
    });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else if (pid === "mollie") {
    const r = await refundMollie({
      credentials,
      externalRef,
      amountMinor: orderRes.data.amount_minor,
      currency: orderRes.data.currency
    });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else if (pid === "razorpay") {
    const r = await refundRazorpay({
      credentials,
      externalRef,
      amountMinor: orderRes.data.amount_minor
    });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else if (pid === "coinbase") {
    const r = await refundCoinbase({ credentials, externalRef });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else if (pid === "klarna") {
    const r = await refundKlarna({
      credentials,
      externalRef,
      amountMinor: orderRes.data.amount_minor
    });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else if (pid === "adyen") {
    const r = await refundAdyen({
      credentials,
      externalRef,
      amountMinor: orderRes.data.amount_minor,
      currency: orderRes.data.currency
    });
    providerRefundOk = r.ok;
    providerRefundError = r.ok ? null : r.error;
  } else {
    // Offline / stub providers — no API call. Order is still marked
    // refunded and the merchant reconciles manually.
    providerRefundError = `${pid} refunds are manual — marked in Studio, action the payout yourself.`;
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
