// Midtrans processor — Snap checkout (covers GoPay, OVO, DANA, ShopeePay,
// virtual accounts, credit card, QRIS in one integration).
//
// Credentials:
//   midtrans_server_key
//   midtrans_client_key (unused server-side but declared for the button)
//
// Server posts to https://app.midtrans.com/snap/v1/transactions with
// Basic auth (serverKey:) and receives a redirect_url the client follows.
//
// This one processor handles GoPay / OVO / DANA / QRIS in the button
// registry because on Midtrans they all resolve to the same Snap flow —
// the customer picks the specific method inside the Snap UI.

import {
  paymentProcessors,
  type PaymentProcessor
} from "../processor";

const BASE = "https://app.midtrans.com/snap/v1";

const factory = (providerId: string): PaymentProcessor => ({
  providerId,
  async createSession(req, credentials) {
    const serverKey = credentials.midtrans_server_key as string | undefined;
    if (!serverKey) {
      return { kind: "error", error: "Midtrans server_key missing" };
    }
    const res = await fetch(`${BASE}/transactions`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${serverKey}:`).toString("base64")}`,
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        transaction_details: {
          order_id: req.orderRef,
          gross_amount: Math.round(req.amountMinor / 100) // Midtrans uses full rupiah
        },
        customer_details: {
          email: req.customerEmail
        },
        callbacks: { finish: req.returnUrl },
        enabled_payments:
          providerId === "gopay"
            ? ["gopay"]
            : providerId === "ovo"
              ? ["ovo"]
              : providerId === "dana"
                ? ["dana"]
                : providerId === "qris"
                  ? ["qris"]
                  : undefined
      })
    });
    if (!res.ok) {
      const text = await res.text();
      return { kind: "error", error: `Midtrans error: ${text}` };
    }
    const json = (await res.json()) as { token: string; redirect_url: string };
    return {
      kind: "redirect",
      checkoutUrl: json.redirect_url,
      externalRef: json.token
    };
  }
});

// Register one processor per Indonesian e-wallet + QRIS — same
// underlying Snap flow but the button knows what to bill for.
for (const id of ["gopay", "ovo", "dana", "qris"] as const) {
  paymentProcessors.register(factory(id));
}
