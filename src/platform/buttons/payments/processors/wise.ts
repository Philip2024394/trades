// Wise processor — Payment Link (public API).
//
// Credentials:
//   api_token       (required)
//   profile_id      (required — merchant's business profile)
//
// Wise doesn't have a hosted checkout — we create a Payment Request and
// return the shareable link. Merchants send/redirect customers to it.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";
import { amountToMajor } from "../currency";

const BASE = "https://api.wise.com";

const processor: PaymentProcessor = {
  providerId: "wise",
  async createSession(req, credentials) {
    const token = credentials.api_token as string | undefined;
    const profileId = credentials.profile_id as string | undefined;
    if (!token || !profileId) {
      return { kind: "error", error: "Wise credentials missing" };
    }
    const res = await fetch(
      `${BASE}/v1/profiles/${profileId}/payment-requests`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          amountValue: amountToMajor(req.amountMinor, req.currency),
          currency: req.currency,
          description: req.description ?? req.orderRef,
          reference: req.orderRef
        })
      }
    );
    if (!res.ok) {
      return { kind: "error", error: `Wise error: ${await res.text()}` };
    }
    const link = (await res.json()) as { id: string; link: string };
    return { kind: "redirect", checkoutUrl: link.link, externalRef: link.id };
  }
};

paymentProcessors.register(processor);
