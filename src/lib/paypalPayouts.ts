// PayPal Payouts API helper — STUB.
//
// Until PAYPAL_CLIENT_ID + PAYPAL_SECRET are configured in the env,
// sendPayout() short-circuits with { ok: true, skipped: true }.
//
// When you're ready to wire it for real:
//   1. Set PAYPAL_CLIENT_ID, PAYPAL_SECRET, PAYPAL_PAYOUT_MODE in Vercel.
//   2. Replace the marked block below with the OAuth + Payouts call.
import "server-only";

export type SendPayoutInput = {
  paypal_email: string;
  amount_gbp: number;
  note?: string;
};

export type SendPayoutResult = {
  ok: boolean;
  skipped?: boolean;
  payout_batch_id?: string;
  error?: string;
};

export async function sendPayout(
  input: SendPayoutInput
): Promise<SendPayoutResult> {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_SECRET;
  const mode = process.env.PAYPAL_PAYOUT_MODE === "live" ? "live" : "sandbox";

  if (!clientId || !secret) {
    return { ok: true, skipped: true };
  }
  if (!input.paypal_email || input.amount_gbp <= 0) {
    return { ok: false, error: "Invalid payout payload." };
  }

  // TODO: implement when env vars set.
  //
  // Skeleton (uncomment when going live):
  //
  // const baseUrl =
  //   mode === "live"
  //     ? "https://api-m.paypal.com"
  //     : "https://api-m.sandbox.paypal.com";
  //
  // 1. Exchange client credentials for an access token.
  // const auth = await fetch(`${baseUrl}/v1/oauth2/token`, {
  //   method: "POST",
  //   headers: {
  //     Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
  //     "Content-Type": "application/x-www-form-urlencoded"
  //   },
  //   body: "grant_type=client_credentials"
  // });
  // const authJson = (await auth.json()) as { access_token?: string };
  // if (!auth.ok || !authJson.access_token) {
  //   return { ok: false, error: "PayPal auth failed." };
  // }
  //
  // 2. Send the payout.
  // const res = await fetch(`${baseUrl}/v1/payments/payouts`, {
  //   method: "POST",
  //   headers: {
  //     Authorization: `Bearer ${authJson.access_token}`,
  //     "Content-Type": "application/json"
  //   },
  //   body: JSON.stringify({
  //     sender_batch_header: {
  //       sender_batch_id: `xrated-${Date.now()}`,
  //       email_subject: "Your Xrated Trades affiliate payout"
  //     },
  //     items: [
  //       {
  //         recipient_type: "EMAIL",
  //         amount: { value: input.amount_gbp.toFixed(2), currency: "GBP" },
  //         receiver: input.paypal_email,
  //         note: input.note ?? "Affiliate payout"
  //       }
  //     ]
  //   })
  // });
  // const json = (await res.json()) as {
  //   batch_header?: { payout_batch_id?: string };
  //   message?: string;
  // };
  // if (!res.ok) return { ok: false, error: json.message ?? `HTTP ${res.status}` };
  // return { ok: true, payout_batch_id: json.batch_header?.payout_batch_id };

  void mode;
  return { ok: true, skipped: true };
}
