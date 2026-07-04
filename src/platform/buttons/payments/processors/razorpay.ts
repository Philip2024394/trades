// Razorpay processor — Order Create via REST (no SDK required).
//
// Credentials:
//   key_id      — rzp_live_… (also given to the client)
//   key_secret  — server-only

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const BASE = "https://api.razorpay.com/v1";

const processor: PaymentProcessor = {
  providerId: "razorpay",
  async createSession(req, credentials) {
    const keyId = credentials.key_id as string | undefined;
    const secret = credentials.key_secret as string | undefined;
    if (!keyId || !secret) {
      return { kind: "error", error: "Razorpay credentials missing" };
    }
    const res = await fetch(`${BASE}/orders`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: req.amountMinor, // Razorpay uses paise (already minor)
        currency: req.currency,
        receipt: req.orderRef,
        notes: {
          orderRef: req.orderRef,
          brandId: req.brandId
        }
      })
    });
    if (!res.ok) {
      const text = await res.text();
      return { kind: "error", error: `Razorpay error: ${text}` };
    }
    const order = (await res.json()) as { id: string };
    // Razorpay does not return a hosted checkout URL — the client uses
    // razorpay/checkout.js with the order_id. For v1 we return a
    // Checkout URL that our own /pay/razorpay/[orderId] page renders
    // with the client script.
    return {
      kind: "redirect",
      checkoutUrl: `/pay/razorpay/handoff?orderId=${encodeURIComponent(order.id)}&keyId=${encodeURIComponent(keyId)}&returnUrl=${encodeURIComponent(req.returnUrl)}`,
      externalRef: order.id
    };
  }
};

paymentProcessors.register(processor);
