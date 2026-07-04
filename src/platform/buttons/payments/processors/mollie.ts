// Mollie processor — Payments API (single api_key, hosted checkout).

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const BASE = "https://api.mollie.com/v2";

const processor: PaymentProcessor = {
  providerId: "mollie",
  async createSession(req, credentials) {
    const apiKey = credentials.api_key as string | undefined;
    if (!apiKey) return { kind: "error", error: "Mollie api_key missing" };
    const res = await fetch(`${BASE}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: {
          currency: req.currency,
          value: (req.amountMinor / 100).toFixed(2)
        },
        description: req.description ?? req.orderRef,
        redirectUrl: req.returnUrl,
        webhookUrl: `${new URL(req.returnUrl).origin}/api/pay/webhook/mollie`,
        metadata: { orderRef: req.orderRef, brandId: req.brandId }
      })
    });
    if (!res.ok) {
      return { kind: "error", error: `Mollie error: ${await res.text()}` };
    }
    const json = (await res.json()) as {
      id: string;
      _links: { checkout: { href: string } };
    };
    return {
      kind: "redirect",
      checkoutUrl: json._links.checkout.href,
      externalRef: json.id
    };
  }
};

paymentProcessors.register(processor);
