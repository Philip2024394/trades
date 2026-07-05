// PayPal processor — Orders v2 via fetch (no SDK).
//
// Credentials:
//   client_id       (required)
//   client_secret   (required)
//   mode            ('live' | 'sandbox', required)
//
// Flow: create Order → return approval URL → customer approves →
// return redirect fires → merchant captures the order via webhook or
// server-side call. For v1 we return the "approve" href and let the
// return URL trigger capture on our /api/pay/paypal/capture route
// (out of scope for this session — sketched below).

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";
import { formatMajorString } from "../currency";

const BASE_LIVE = "https://api-m.paypal.com";
const BASE_SANDBOX = "https://api-m.sandbox.paypal.com";

const processor: PaymentProcessor = {
  providerId: "paypal",
  async createSession(req, credentials) {
    const clientId = credentials.client_id as string | undefined;
    const secret = credentials.client_secret as string | undefined;
    const mode = ((credentials.mode as string | undefined) ?? "live").toLowerCase();
    if (!clientId || !secret) {
      return { kind: "error", error: "PayPal client_id/secret missing" };
    }
    const base = mode === "sandbox" ? BASE_SANDBOX : BASE_LIVE;

    // 1. Get access token.
    const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: "grant_type=client_credentials"
    });
    if (!tokenRes.ok) {
      return { kind: "error", error: `PayPal token error ${tokenRes.status}` };
    }
    const tokenJson = (await tokenRes.json()) as { access_token: string };

    // 2. Create order.
    const orderRes = await fetch(`${base}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenJson.access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: req.orderRef,
            description: req.description ?? req.orderRef,
            amount: {
              currency_code: req.currency,
              // PayPal expects the MAJOR-unit string with the right
              // number of decimals per ISO 4217 (2 for USD, 0 for JPY /
              // IDR / KRW, 3 for BHD / KWD).
              value: formatMajorString(req.amountMinor, req.currency)
            }
          }
        ],
        application_context: {
          return_url: req.returnUrl,
          cancel_url: req.cancelUrl,
          user_action: "PAY_NOW"
        }
      })
    });
    if (!orderRes.ok) {
      const text = await orderRes.text();
      return { kind: "error", error: `PayPal order error: ${text}` };
    }
    const order = (await orderRes.json()) as {
      id: string;
      links: { rel: string; href: string }[];
    };
    const approve = order.links.find((l) => l.rel === "approve" || l.rel === "payer-action");
    if (!approve) {
      return { kind: "error", error: "PayPal order missing approve link" };
    }
    return {
      kind: "redirect",
      checkoutUrl: approve.href,
      externalRef: order.id
    };
  }
  // Webhook verification omitted for brevity — real production would
  // implement PayPal's transmission_id + certificate chain check.
};

paymentProcessors.register(processor);
