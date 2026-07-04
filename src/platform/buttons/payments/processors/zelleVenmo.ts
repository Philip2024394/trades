// Zelle + Venmo — merchant-configured handoff.
//
// Zelle has no merchant API — it's peer-to-peer bank transfer. We
// return a handoff with the recipient email/phone the merchant
// configured, plus the amount + reference. The customer opens their
// bank app and sends.
//
// Venmo (business) IS integrable but only via Braintree (PayPal
// subsidiary). Full Braintree wiring requires the braintree SDK and
// its own client-side SDK — we stub Venmo here so buttons degrade to
// href navigation (merchants typically use PayPal Braintree Drop-In).

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const zelle: PaymentProcessor = {
  providerId: "zelle",
  async createSession(req, credentials) {
    const recipient = credentials.recipient_email as string | undefined;
    if (!recipient) {
      return { kind: "error", error: "Zelle recipient not configured" };
    }
    const externalRef = `zelle_${req.orderRef}_${Date.now()}`;
    const amount = (req.amountMinor / 100).toLocaleString();
    return {
      kind: "handoff",
      instructions:
        `Send ${req.currency} ${amount} via Zelle to:\n` +
        `${recipient}\n\n` +
        `Include this reference in the memo: ${req.orderRef}\n\n` +
        `Your order will be confirmed within 1 hour of the transfer landing.`,
      externalRef
    };
  }
};

const venmo: PaymentProcessor = {
  providerId: "venmo",
  async createSession() {
    return {
      kind: "not-implemented",
      reason:
        "Venmo business requires Braintree Drop-In on the checkout page — direct API integration needs the braintree SDK."
    };
  }
};

paymentProcessors.register(zelle);
paymentProcessors.register(venmo);
