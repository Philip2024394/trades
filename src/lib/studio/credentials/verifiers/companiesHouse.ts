// Companies House verifier.
//
// Uses the free public Companies House REST API. Auth: HTTP Basic with
// the API key as the username and an empty password.
//
//   docs: https://developer-specs.company-information.service.gov.uk/
//
// Endpoint: GET /company/{company_number}
// Response fields we care about:
//   company_status:  "active" | "dissolved" | "liquidation" | ...
//   company_name:    exact name — used as display_label
//   date_of_creation: yyyy-mm-dd
//
// Requires COMPANIES_HOUSE_API_KEY env var. Absent key → 'error' result
// (surfaces cleanly in the manager; the merchant can still self-declare).

import type { Verifier, VerifierResult } from "./types";

const BASE = "https://api.company-information.service.gov.uk";

export const companiesHouseVerifier: Verifier = async ({ number }) => {
  const apiKey = process.env.COMPANIES_HOUSE_API_KEY;
  if (!apiKey) {
    return { status: "error", error: "companies-house-api-key-missing" };
  }

  const clean = number.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6,10}$/.test(clean)) {
    return { status: "error", error: "invalid-format" };
  }

  const auth = Buffer.from(`${apiKey}:`).toString("base64");
  let res: Response;
  try {
    res = await fetch(`${BASE}/company/${encodeURIComponent(clean)}`, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json"
      }
    });
  } catch (err) {
    return { status: "error", error: (err as Error).message ?? "fetch-failed" };
  }

  if (res.status === 404) {
    return { status: "not-found" };
  }
  if (res.status === 429) {
    return { status: "error", error: "rate-limited" };
  }
  if (!res.ok) {
    return { status: "error", error: `http-${res.status}` };
  }

  const raw = (await res.json()) as {
    company_status?: string;
    company_name?: string;
  };

  const activeStates = new Set(["active", "voluntary-arrangement"]);
  const suspendedStates = new Set([
    "administration",
    "receiver-action",
    "liquidation",
    "insolvency-proceedings"
  ]);
  const expiredStates = new Set([
    "dissolved",
    "converted-closed",
    "removed"
  ]);

  const status = raw.company_status ?? "unknown";
  let result: VerifierResult;
  if (activeStates.has(status)) {
    result = {
      status: "verified",
      displayLabel: raw.company_name,
      raw
    };
  } else if (suspendedStates.has(status)) {
    result = { status: "suspended", raw };
  } else if (expiredStates.has(status)) {
    result = { status: "expired", raw };
  } else {
    result = { status: "error", error: `unknown-status-${status}`, raw };
  }
  return result;
};
