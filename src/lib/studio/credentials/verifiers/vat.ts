// HMRC VAT number verifier.
//
// Uses the public HMRC Check VAT Number endpoint. No auth required for
// the basic lookup — HMRC exposes it under the "Check a UK VAT number"
// service.
//
//   docs: https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/check-vat-number-api/
//
// Endpoint: GET /organisations/vat/check-vat-number/lookup/{vrn}
// Response fields we care about:
//   target: { name, vatNumber, address, ... } — present when valid
//   404 when the number is not a valid UK VAT registration
//
// Requires nothing extra in env. Server-only fetch.

import type { Verifier } from "./types";

const BASE = "https://api.service.hmrc.gov.uk";

export const vatVerifier: Verifier = async ({ number }) => {
  // Strip GB prefix + non-digits — HMRC endpoint expects 9-digit number
  const digits = number.replace(/^GB/i, "").replace(/[^0-9]/g, "");
  if (!/^\d{9}$/.test(digits)) {
    return { status: "error", error: "invalid-format" };
  }
  let res: Response;
  try {
    res = await fetch(
      `${BASE}/organisations/vat/check-vat-number/lookup/${digits}`,
      { headers: { Accept: "application/vnd.hmrc.2.0+json" } }
    );
  } catch (err) {
    return { status: "error", error: (err as Error).message ?? "fetch-failed" };
  }
  if (res.status === 404) return { status: "not-found" };
  if (res.status === 429) {
    return { status: "error", error: "rate-limited" };
  }
  if (!res.ok) return { status: "error", error: `http-${res.status}` };

  const raw = (await res.json()) as {
    target?: { name?: string; vatNumber?: string };
  };
  if (!raw.target) return { status: "not-found", raw };
  return {
    status: "verified",
    displayLabel: raw.target.name ?? `VAT ${digits}`,
    raw
  };
};
