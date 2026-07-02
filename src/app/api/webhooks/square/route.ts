// POST /api/webhooks/square — Square webhook receiver.
//
// Square signs each webhook with the notification URL + raw body
// hashed via HMAC-SHA256 using the subscription's signature key. We
// verify server-side then handle relevant event types:
//   payment.updated  → flip order to paid on COMPLETED
//   order.updated    → informational
//
// Signature key configured per subscription in Square Developer
// dashboard; env: SQUARE_WEBHOOK_SIGNATURE_KEY.

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { siteUrl } from "@/lib/seo";
import { squareGet } from "@/lib/squareClient";
import { notifyOrderPaid } from "@/lib/notifyOrderPaid";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verify(rawBody: string, header: string | null, url: string): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
  if (!key || !header) return false;
  const h = createHmac("sha256", key).update(url + rawBody).digest("base64");
  try {
    return timingSafeEqual(Buffer.from(h), Buffer.from(header));
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-square-hmacsha256-signature");
  const notificationUrl = `${siteUrl()}/api/webhooks/square`;
  if (!verify(raw, sig, notificationUrl)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 400 });
  }
  let event: {
    type: string;
    merchant_id?: string;
    data?: {
      object?: {
        payment?: {
          status?: string;
          order_id?: string;
        };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    if (event.type === "payment.updated") {
      const payment = event.data?.object?.payment;
      if (payment?.status === "COMPLETED" && payment.order_id && event.merchant_id) {
        // Square's payment.updated carries the order_id but NOT the
        // reference_id we set at checkout. Look up the order via
        // Square's Orders API using the seller's own access token,
        // then match reference_id → our order_ref.
        const listingRes = await supabaseAdmin
          .from("hammerex_trade_off_listings")
          .select("id, payment_provider_data")
          .filter("payment_provider_data->>square_merchant_id", "eq", event.merchant_id)
          .maybeSingle();
        if (listingRes.data) {
          const data = (listingRes.data.payment_provider_data ?? {}) as Record<string, unknown>;
          const token = data.square_access_token as string | undefined;
          if (token) {
            type OrderLookup = { order?: { reference_id?: string } };
            const info = await squareGet<OrderLookup>(
              `/v2/orders/${encodeURIComponent(payment.order_id)}`,
              token
            );
            const orderRef = info.order?.reference_id;
            if (orderRef) {
              const upd = await supabaseAdmin
                .from("hammerex_xrated_orders")
                .update({
                  status: "paid",
                  paid_at: new Date().toISOString(),
                  metadata: {
                    square_order_id: payment.order_id,
                    square_merchant_id: event.merchant_id
                  }
                })
                .eq("order_ref", orderRef)
                .eq("status", "pending")
                .select("id");
              if (upd.data && upd.data.length > 0) {
                await notifyOrderPaid(orderRef);
              }
            }
          }
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
