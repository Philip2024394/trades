// Offline processors — Cash on Delivery + Bank Transfer.
//
// Neither online-processes a payment. Instead they register the order
// server-side and return handoff instructions that the storefront
// displays inline.
//
// Cash on Delivery:
//   Just marks the order 'pending' and shows a "Pay driver on arrival"
//   confirmation. Merchants reconcile via /studio/payments/orders.
//
// Bank Transfer:
//   Returns the merchant's configured bank account + reference so the
//   customer can transfer manually.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const cod: PaymentProcessor = {
  providerId: "cod",
  async createSession(req) {
    const externalRef = `cod_${req.orderRef}_${Date.now()}`;
    return {
      kind: "handoff",
      instructions:
        "Your order is placed. Pay in cash when the driver hands it over. " +
        "You'll get a confirmation SMS + a receipt on delivery.",
      externalRef
    };
  }
};

const bankTransfer: PaymentProcessor = {
  providerId: "bank-transfer",
  async createSession(req, credentials) {
    const bankName = credentials.bank_name as string | undefined;
    const account = credentials.account_number as string | undefined;
    const holder = credentials.account_holder as string | undefined;
    if (!bankName || !account || !holder) {
      return {
        kind: "error",
        error: "Bank details missing — configure in /studio/payments"
      };
    }
    const externalRef = `bt_${req.orderRef}_${Date.now()}`;
    const amount = (req.amountMinor / 100).toLocaleString();
    return {
      kind: "handoff",
      instructions:
        `Transfer ${req.currency} ${amount} to:\n` +
        `Bank: ${bankName}\n` +
        `Account: ${account}\n` +
        `Holder: ${holder}\n` +
        `Reference: ${req.orderRef}\n\n` +
        `Your order will be confirmed within 1 hour of the transfer landing.`,
      externalRef
    };
  }
};

paymentProcessors.register(cod);
paymentProcessors.register(bankTransfer);
