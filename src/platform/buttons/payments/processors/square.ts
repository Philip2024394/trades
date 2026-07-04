// Square processor — Checkout API (Payment Links).
//
// Also serves Cash App Pay because on Square the Cash App button is
// just a payment method selectable inside the Payment Link flow.
//
// Credentials:
//   access_token
//   location_id

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const BASE = "https://connect.squareup.com/v2";

function factory(providerId: string): PaymentProcessor {
  return {
    providerId,
    async createSession(req, credentials) {
      const token = credentials.access_token as string | undefined;
      const locationId = credentials.location_id as string | undefined;
      if (!token || !locationId) {
        return { kind: "error", error: "Square credentials missing" };
      }
      const res = await fetch(`${BASE}/online-checkout/payment-links`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Square-Version": "2024-01-17"
        },
        body: JSON.stringify({
          idempotency_key: `${req.orderRef}-${Date.now()}`,
          quick_pay: {
            name: req.description ?? req.orderRef,
            price_money: {
              amount: req.amountMinor,
              currency: req.currency
            },
            location_id: locationId
          },
          checkout_options: {
            redirect_url: req.returnUrl,
            accepted_payment_methods:
              providerId === "cash_app"
                ? {
                    apple_pay: false,
                    google_pay: false,
                    cash_app_pay: true,
                    afterpay_clearpay: false
                  }
                : undefined
          }
        })
      });
      if (!res.ok) {
        return { kind: "error", error: `Square error: ${await res.text()}` };
      }
      const json = (await res.json()) as {
        payment_link: { id: string; url: string };
      };
      return {
        kind: "redirect",
        checkoutUrl: json.payment_link.url,
        externalRef: json.payment_link.id
      };
    }
  };
}

paymentProcessors.register(factory("square"));
paymentProcessors.register(factory("cash_app"));
