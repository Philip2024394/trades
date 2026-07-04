// Adyen processor — Checkout API v71.
//
// Credentials:
//   api_key            — X-API-Key header
//   merchant_account   — the merchant account name
//   environment        — 'live' | 'test'
//
// Adyen supports pay-by-link → we create a link and return the URL.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const processor: PaymentProcessor = {
  providerId: "adyen",
  async createSession(req, credentials) {
    const apiKey = credentials.api_key as string | undefined;
    const merchantAccount = credentials.merchant_account as string | undefined;
    const env = ((credentials.environment as string | undefined) ?? "live").toLowerCase();
    if (!apiKey || !merchantAccount) {
      return { kind: "error", error: "Adyen credentials missing" };
    }
    const base =
      env === "test"
        ? "https://checkout-test.adyen.com/v71"
        : "https://checkout-live.adyen.com/checkout/v71";
    const res = await fetch(`${base}/paymentLinks`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        merchantAccount,
        reference: req.orderRef,
        amount: { value: req.amountMinor, currency: req.currency },
        description: req.description ?? req.orderRef,
        shopperEmail: req.customerEmail,
        returnUrl: req.returnUrl,
        expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString()
      })
    });
    if (!res.ok) {
      return { kind: "error", error: `Adyen error: ${await res.text()}` };
    }
    const link = (await res.json()) as { id: string; url: string };
    return { kind: "redirect", checkoutUrl: link.url, externalRef: link.id };
  }
};

paymentProcessors.register(processor);
