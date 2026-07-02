// POST /api/webhooks/paypal — PayPal Commerce webhook receiver.
//
// Verifies the signature via PayPal's /v1/notifications/verify-webhook-
// signature endpoint (PayPal's canonical validator — no local library
// needed). Handles:
//   PAYMENT.CAPTURE.COMPLETED  → mark order paid
//   PAYMENT.CAPTURE.DENIED     → mark order failed
//   CHECKOUT.ORDER.APPROVED    → informational (customer approved, not
//                                yet captured)
//   MERCHANT.ONBOARDING.COMPLETED → mirror seller capabilities
//
// Requires PAYPAL_WEBHOOK_ID from the Partner dashboard.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { paypalConfigured, paypalPost } from "@/lib/paypalClient";
import { notifyOrderPaid } from "@/lib/notifyOrderPaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VerifyResponse = { verification_status: "SUCCESS" | "FAILURE" };

export async function POST(req: Request) {
  if (!paypalConfigured()) {
    return NextResponse.json(
      { error: "paypal_not_configured" },
      { status: 503 }
    );
  }
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) {
    return NextResponse.json(
      { error: "paypal_webhook_id_missing" },
      { status: 503 }
    );
  }

  const raw = await req.text();
  let event: {
    id: string;
    event_type: string;
    resource: Record<string, unknown>;
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // Signature verification via PayPal.
  try {
    const verify = await paypalPost<VerifyResponse>(
      "/v1/notifications/verify-webhook-signature",
      {
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        cert_url: req.headers.get("paypal-cert-url"),
        auth_algo: req.headers.get("paypal-auth-algo"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        webhook_id: webhookId,
        webhook_event: event
      }
    );
    if (verify.verification_status !== "SUCCESS") {
      return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: "verify_failed", detail: (e as Error).message },
      { status: 400 }
    );
  }

  try {
    if (event.event_type === "PAYMENT.CAPTURE.COMPLETED") {
      const resource = event.resource as {
        id?: string;
        custom_id?: string;
        supplementary_data?: { related_ids?: { order_id?: string } };
      };
      const orderRef = resource.custom_id;
      const orderId = resource.supplementary_data?.related_ids?.order_id;
      if (orderRef) {
        const upd = await supabaseAdmin
          .from("hammerex_xrated_orders")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
            metadata: {
              paypal_capture_id: resource.id,
              paypal_order_id: orderId
            }
          })
          .eq("order_ref", orderRef)
          .eq("status", "pending")
          .select("id");
        if (upd.data && upd.data.length > 0) {
          await notifyOrderPaid(orderRef);
        }
      }
    } else if (event.event_type === "PAYMENT.CAPTURE.DENIED") {
      const resource = event.resource as { custom_id?: string };
      const orderRef = resource.custom_id;
      if (orderRef) {
        await supabaseAdmin
          .from("hammerex_xrated_orders")
          .update({
            status: "failed",
            cancelled_at: new Date().toISOString()
          })
          .eq("order_ref", orderRef);
      }
    } else if (event.event_type === "MERCHANT.ONBOARDING.COMPLETED") {
      const resource = event.resource as {
        merchant_id?: string;
        tracking_id?: string;
        payments_receivable?: boolean;
        primary_email_confirmed?: boolean;
      };
      if (resource.tracking_id?.startsWith("xrated-")) {
        const listingId = resource.tracking_id.slice("xrated-".length);
        const row = await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .select("payment_provider_data")
          .eq("id", listingId)
          .maybeSingle();
        if (row.data) {
          const data = (row.data.payment_provider_data ?? {}) as Record<string, unknown>;
          const ready =
            resource.payments_receivable === true &&
            resource.primary_email_confirmed === true;
          await supabaseAdmin
            .from("hammerex_trade_off_listings")
            .update({
              payment_provider_data: {
                ...data,
                paypal_merchant_id: resource.merchant_id,
                paypal_payments_receivable: resource.payments_receivable === true,
                paypal_primary_email_confirmed: resource.primary_email_confirmed === true,
                paypal_status: ready ? "ready" : "pending_onboarding",
                paypal_refreshed_at: new Date().toISOString()
              }
            })
            .eq("id", listingId);
        }
      }
    }
    return NextResponse.json({ received: true });
  } catch (e) {
    return NextResponse.json(
      { error: "handler_error", detail: (e as Error).message },
      { status: 500 }
    );
  }
}
