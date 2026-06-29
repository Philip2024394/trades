// Wise Business API helper — STUB.
//
// Until WISE_API_TOKEN + WISE_PROFILE_ID are configured in the env,
// sendWisePayout() short-circuits with { ok: true, skipped: true }.
//
// When you're ready to wire it for real, replace the marked block with
// the four-step Wise transfer flow (quote → recipient → transfer →
// fund).
import "server-only";

export type SendWisePayoutInput = {
  email: string;
  amount_gbp: number;
  note?: string;
};

export type SendWisePayoutResult = {
  ok: boolean;
  skipped?: boolean;
  transfer_id?: string;
  error?: string;
};

export async function sendWisePayout(
  input: SendWisePayoutInput
): Promise<SendWisePayoutResult> {
  const token = process.env.WISE_API_TOKEN;
  const profileId = process.env.WISE_PROFILE_ID;

  if (!token || !profileId) {
    return { ok: true, skipped: true };
  }
  if (!input.email || input.amount_gbp <= 0) {
    return { ok: false, error: "Invalid Wise payout payload." };
  }

  // TODO: implement when env vars set.
  //
  // Skeleton:
  //   1. POST /v3/profiles/<profileId>/quotes  — get a quote ID.
  //   2. POST /v1/accounts — create recipient with the email.
  //   3. POST /v1/transfers — create transfer using quote + recipient.
  //   4. POST /v3/profiles/<profileId>/transfers/<id>/payments — fund.
  //
  // const baseUrl = "https://api.transferwise.com";

  void profileId;
  return { ok: true, skipped: true };
}
