// Indonesian standalone e-wallets — LinkAja + GrabPay + DANA-standalone.
//
// The base Midtrans processor already covers GoPay / OVO / DANA / QRIS
// via a single Snap integration. This file adds the direct API paths
// for merchants who want to skip Midtrans:
//
//   • LinkAja — requires Telkomsel partner agreement + certificate.
//     For v1 we register a stub; production merchants use Midtrans /
//     Xendit / Faspay as an acquirer.
//   • GrabPay — has a hosted redirect flow via GrabPay Merchant Portal.
//     Also stub for v1 — most merchants use Grab's regional acquirers.
//
// If a merchant configures Midtrans server_key credentials for the
// GoPay / OVO / DANA button variants, the Midtrans processor picks
// them up first. This file registers separate providerIds so the
// buttons don't error out when Midtrans isn't configured.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

function stub(providerId: string, reason: string): PaymentProcessor {
  return {
    providerId,
    async createSession() {
      return { kind: "not-implemented", reason };
    }
  };
}

paymentProcessors.register(
  stub(
    "linkaja",
    "LinkAja direct integration requires Telkomsel partner agreement — recommend routing via Midtrans, Xendit, or Faspay."
  )
);
paymentProcessors.register(
  stub(
    "grabpay",
    "GrabPay direct integration requires Grab merchant portal + partner secret — recommend routing via Xendit or DOKU."
  )
);
