// Alipay + WeChat Pay — production integrations require RSA signature
// generation and provider-side merchant onboarding that can't be
// implemented from credentials alone (both require certificate files,
// cross-border agreements, and MITM-hardened crypto).
//
// For merchants ready to go live, the canonical path is:
//   • Alipay Global — https://global.alipay.com (self-service)
//   • WeChat Pay — via a certified acquirer like PayerMax or Stripe's
//     Alipay/WeChat rails inside Stripe Checkout
//
// This processor returns a `not-implemented` result for now so buttons
// gracefully degrade to the payment link the merchant configures in
// their href. When Alipay / WeChat certificates land in
// studio_payment_providers.credentials we swap this stub for the real
// implementation. The button UX is otherwise fully wired.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

function stub(providerId: string, reason: string): PaymentProcessor {
  return {
    providerId,
    async createSession() {
      return {
        kind: "not-implemented",
        reason
      };
    }
  };
}

paymentProcessors.register(
  stub(
    "alipay",
    "Alipay direct integration requires RSA certificate onboarding — recommend routing via Stripe (which supports Alipay natively) or PayerMax for cross-border."
  )
);
paymentProcessors.register(
  stub(
    "wechat",
    "WeChat Pay requires a certified acquirer or Stripe's WeChat rails — direct integration needs Chinese entity + certificate signing."
  )
);
