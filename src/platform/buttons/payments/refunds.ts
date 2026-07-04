// Per-provider refund implementations.
//
// Each function attempts the real refund. Returns { ok, error? }.
// Callers persist the outcome to the order metadata.
//
// Stripe stays in the refund route (uses SDK); everything here is
// fetch-based so no additional dependencies required.

import { createHmac } from "crypto";

export type RefundResult =
  | { ok: true }
  | { ok: false; error: string };

// ─── PayPal ──────────────────────────────────────────────

export async function refundPaypal(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
  amountMinor: number;
  currency: string;
}): Promise<RefundResult> {
  const clientId = args.credentials.client_id as string | undefined;
  const secret = args.credentials.client_secret as string | undefined;
  const mode = ((args.credentials.mode as string | undefined) ?? "live").toLowerCase();
  if (!clientId || !secret) {
    return { ok: false, error: "paypal-credentials-missing" };
  }
  const base =
    mode === "sandbox"
      ? "https://api-m.sandbox.paypal.com"
      : "https://api-m.paypal.com";
  const tokenRes = await fetch(`${base}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  if (!tokenRes.ok) return { ok: false, error: `paypal-token-${tokenRes.status}` };
  const { access_token } = (await tokenRes.json()) as { access_token: string };

  // PayPal captures live under an Order id — we need to find the capture id.
  // For simplicity: assume the externalRef is the Order id and fetch the
  // most recent capture.
  const orderRes = await fetch(`${base}/v2/checkout/orders/${args.externalRef}`, {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  if (!orderRes.ok) {
    return { ok: false, error: `paypal-order-fetch-${orderRes.status}` };
  }
  const order = (await orderRes.json()) as {
    purchase_units?: {
      payments?: { captures?: { id: string }[] };
    }[];
  };
  const captureId = order.purchase_units?.[0]?.payments?.captures?.[0]?.id;
  if (!captureId) {
    return { ok: false, error: "paypal-no-capture-found" };
  }
  const refundRes = await fetch(
    `${base}/v2/payments/captures/${captureId}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${access_token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: {
          value: (args.amountMinor / 100).toFixed(2),
          currency_code: args.currency
        }
      })
    }
  );
  if (!refundRes.ok) {
    return { ok: false, error: `paypal-refund-${refundRes.status}: ${await refundRes.text()}` };
  }
  return { ok: true };
}

// ─── Mollie ──────────────────────────────────────────────

export async function refundMollie(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
  amountMinor: number;
  currency: string;
}): Promise<RefundResult> {
  const apiKey = args.credentials.api_key as string | undefined;
  if (!apiKey) return { ok: false, error: "mollie-api-key-missing" };
  const res = await fetch(
    `https://api.mollie.com/v2/payments/${args.externalRef}/refunds`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        amount: {
          currency: args.currency,
          value: (args.amountMinor / 100).toFixed(2)
        }
      })
    }
  );
  if (!res.ok) {
    return { ok: false, error: `mollie-refund-${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

// ─── Razorpay ────────────────────────────────────────────

export async function refundRazorpay(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
  amountMinor: number;
}): Promise<RefundResult> {
  const keyId = args.credentials.key_id as string | undefined;
  const secret = args.credentials.key_secret as string | undefined;
  if (!keyId || !secret) return { ok: false, error: "razorpay-creds-missing" };
  // Razorpay refunds attach to a Payment id (not Order id). We'd need
  // to look up the payment from the order first. For v1 we attempt the
  // refund against the externalRef assuming it's the payment id; if
  // it's an order id we need a lookup step.
  const res = await fetch(
    `https://api.razorpay.com/v1/payments/${args.externalRef}/refund`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${keyId}:${secret}`).toString("base64")}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ amount: args.amountMinor })
    }
  );
  if (!res.ok) {
    return { ok: false, error: `razorpay-refund-${res.status}: ${await res.text()}` };
  }
  return { ok: true };
}

// ─── Coinbase Commerce ──────────────────────────────────

export async function refundCoinbase(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
}): Promise<RefundResult> {
  // Coinbase Commerce doesn't support programmatic refunds — the
  // merchant refunds crypto manually from their Coinbase account.
  // We mark the order refunded server-side; merchant reconciles.
  return {
    ok: false,
    error: "Coinbase Commerce has no refund API — refund manually from Coinbase account."
  };
}

// ─── Klarna ─────────────────────────────────────────────

export async function refundKlarna(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
  amountMinor: number;
}): Promise<RefundResult> {
  const username = args.credentials.username as string | undefined;
  const password = args.credentials.password as string | undefined;
  const region = ((args.credentials.region as string | undefined) ?? "eu").toLowerCase();
  if (!username || !password) return { ok: false, error: "klarna-creds-missing" };
  const base =
    region === "na"
      ? "https://api-na.klarna.com"
      : region === "oc"
        ? "https://api-oc.klarna.com"
        : "https://api.klarna.com";
  // Klarna refunds live under Order Management (post-capture). This
  // requires the ORDER id, not the session id. In v1 we return an
  // honest error until we track Klarna order ids alongside session ids.
  return {
    ok: false,
    error:
      "Klarna refunds need the post-capture Order ID (tracked separately from session). Refund via Klarna Merchant Portal for v1."
  };
}

// ─── Adyen ──────────────────────────────────────────────

export async function refundAdyen(args: {
  credentials: Record<string, unknown>;
  externalRef: string;
  amountMinor: number;
  currency: string;
}): Promise<RefundResult> {
  const apiKey = args.credentials.api_key as string | undefined;
  const merchantAccount = args.credentials.merchant_account as string | undefined;
  const env = ((args.credentials.environment as string | undefined) ?? "live").toLowerCase();
  if (!apiKey || !merchantAccount) {
    return { ok: false, error: "adyen-creds-missing" };
  }
  const base =
    env === "test"
      ? "https://checkout-test.adyen.com/v71"
      : "https://checkout-live.adyen.com/checkout/v71";
  // Adyen refunds use /payments/{pspReference}/refunds — Payment Link
  // reconciliation needs the paymentPspReference from the link, which we
  // don't store yet. Same v1 constraint as Klarna.
  return {
    ok: false,
    error:
      "Adyen refunds need the psp reference from the underlying capture (not the payment link id). Refund via Adyen Customer Area for v1."
  };
}
