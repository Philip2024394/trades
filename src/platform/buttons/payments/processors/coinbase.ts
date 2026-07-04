// Coinbase Commerce processor — hosted Checkout via Charge API.
//
// Credentials:
//   api_key        — X-CC-Api-Key header
//   webhook_secret — shared secret for signature verification

import { createHmac, timingSafeEqual } from "crypto";
import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const BASE = "https://api.commerce.coinbase.com";

const processor: PaymentProcessor = {
  providerId: "coinbase",
  async createSession(req, credentials) {
    const apiKey = credentials.api_key as string | undefined;
    if (!apiKey) {
      return { kind: "error", error: "Coinbase api_key missing" };
    }
    const res = await fetch(`${BASE}/charges`, {
      method: "POST",
      headers: {
        "X-CC-Api-Key": apiKey,
        "X-CC-Version": "2018-03-22",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: req.description ?? req.orderRef,
        description: req.description ?? req.orderRef,
        pricing_type: "fixed_price",
        local_price: {
          amount: (req.amountMinor / 100).toFixed(2),
          currency: req.currency
        },
        metadata: { orderRef: req.orderRef, brandId: req.brandId },
        redirect_url: req.returnUrl,
        cancel_url: req.cancelUrl
      })
    });
    if (!res.ok) {
      return { kind: "error", error: `Coinbase error: ${await res.text()}` };
    }
    const json = (await res.json()) as {
      data: { id: string; hosted_url: string };
    };
    return {
      kind: "redirect",
      checkoutUrl: json.data.hosted_url,
      externalRef: json.data.id
    };
  },

  async verifyAndParseWebhook(rawBody, headers, credentials) {
    const secret = credentials.webhook_secret as string | undefined;
    if (!secret) return { kind: "error", error: "webhook_secret missing" };
    const signature = headers.get("x-cc-webhook-signature");
    if (!signature) return { kind: "ignore", reason: "no-signature-header" };
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (
      expected.length !== signature.length ||
      !timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
    ) {
      return { kind: "error", error: "signature-mismatch" };
    }
    const event = JSON.parse(rawBody) as {
      event: { type: string; data: { id: string } };
    };
    const type = event.event?.type;
    const externalRef = event.event?.data?.id;
    if (!externalRef) return { kind: "ignore", reason: "no-data-id" };
    if (type === "charge:confirmed" || type === "charge:resolved") {
      return { kind: "update", externalRef, status: "paid" };
    }
    if (type === "charge:failed") {
      return { kind: "update", externalRef, status: "failed" };
    }
    return { kind: "ignore", reason: `unhandled-${type}` };
  }
};

paymentProcessors.register(processor);
