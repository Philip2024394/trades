// Klarna processor — Klarna Payments HPP (Hosted Payment Page) via REST.
//
// Credentials:
//   username, password, region ('na' | 'eu' | 'oc')
//
// Klarna is region-scoped. Endpoints:
//   NA:  https://api-na.playground.klarna.com or https://api-na.klarna.com
//   EU:  https://api.klarna.com
//   OC:  https://api-oc.klarna.com
// Playground vs prod is determined by the username prefix (K_… vs PK_…),
// but for v1 we default to production for K_/PK_ users. Merchants who
// need sandbox set username: "PK_TEST_…" — same endpoint shape.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

function baseFor(region: string): string {
  if (region === "na") return "https://api-na.klarna.com";
  if (region === "oc") return "https://api-oc.klarna.com";
  return "https://api.klarna.com"; // eu default
}

const processor: PaymentProcessor = {
  providerId: "klarna",
  async createSession(req, credentials) {
    const username = credentials.username as string | undefined;
    const password = credentials.password as string | undefined;
    const region = ((credentials.region as string | undefined) ?? "eu").toLowerCase();
    if (!username || !password) {
      return { kind: "error", error: "Klarna username/password missing" };
    }
    const base = baseFor(region);
    const auth = Buffer.from(`${username}:${password}`).toString("base64");
    // Create HPP session — Klarna returns a redirect_url the customer opens.
    const res = await fetch(`${base}/payments/v1/sessions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        purchase_country: currencyToCountry(req.currency),
        purchase_currency: req.currency,
        locale: "en-GB",
        order_amount: req.amountMinor,
        order_lines: [
          {
            type: "physical",
            reference: req.orderRef,
            name: req.description ?? req.orderRef,
            quantity: 1,
            unit_price: req.amountMinor,
            total_amount: req.amountMinor,
            tax_rate: 0,
            total_tax_amount: 0
          }
        ]
      })
    });
    if (!res.ok) {
      return { kind: "error", error: `Klarna error ${res.status}: ${await res.text()}` };
    }
    const session = (await res.json()) as { session_id: string; client_token: string };
    // Klarna HPP requires a second call to create the redirect URL.
    const hppRes = await fetch(`${base}/payments/v1/sessions/${session.session_id}/hpp-links`, {
      method: "POST",
      headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_urls: {
          success: req.returnUrl,
          cancel: req.cancelUrl,
          back: req.cancelUrl,
          failure: req.cancelUrl,
          error: req.cancelUrl
        },
        options: { place_order_mode: "PLACE_ORDER" }
      })
    });
    if (!hppRes.ok) {
      return { kind: "error", error: `Klarna HPP error: ${await hppRes.text()}` };
    }
    const hpp = (await hppRes.json()) as { redirect_url: string };
    return {
      kind: "redirect",
      checkoutUrl: hpp.redirect_url,
      externalRef: session.session_id
    };
  }
};

function currencyToCountry(c: string): string {
  const map: Record<string, string> = {
    EUR: "DE", GBP: "GB", USD: "US", AUD: "AU", CAD: "CA", SEK: "SE",
    NOK: "NO", DKK: "DK", CHF: "CH", NZD: "NZ"
  };
  return map[c.toUpperCase()] ?? "GB";
}

paymentProcessors.register(processor);
