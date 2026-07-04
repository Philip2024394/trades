// Amazon Pay — hosted Checkout Session via Amazon Pay v2 API.
//
// Amazon Pay v2 requires signing every request with the merchant's
// private key. The full implementation involves canonicalising the
// request, hashing it, signing with RSA-SHA256, and injecting the
// signature into an `x-amz-pay-signature` header. It's beyond a
// single-file stub without a proper crypto library test.
//
// For v1 we register a stub that returns "not-implemented" so payment
// buttons degrade gracefully to href navigation. Amazon Pay merchants
// typically point their button href at the Amazon Pay JS SDK's
// createCheckoutSession call embedded in their storefront directly.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const stub: PaymentProcessor = {
  providerId: "amazon_pay",
  async createSession() {
    return {
      kind: "not-implemented",
      reason:
        "Amazon Pay direct integration requires RSA-SHA256 request signing — recommend embedding Amazon Pay JS SDK on the checkout page and pointing the button href at that flow."
    };
  }
};

paymentProcessors.register(stub);
