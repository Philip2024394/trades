// Credential verifier registry.
//
// Each scheme is either:
//   • auto-verifiable — we have a public API (Companies House, HMRC VAT)
//   • self-declared — no public API exists that we can use ethically at
//     scale. The merchant enters their number, we mark it 'self-declared'
//     and link to the scheme's public register so end-users can verify
//     independently. Cron does NOT scrape private searches.
//
// This is deliberate: the PRD's no-assumptions rule + the CAP/ASA
// evidence rules make it safer to be transparent about verification
// coverage than to fake it.

import type { CredentialScheme } from "@/lib/studio/blueprints";
import { companiesHouseVerifier } from "./companiesHouse";
import { vatVerifier } from "./vat";
import type { Verifier, VerifierResult } from "./types";

const AUTO_VERIFIERS: Partial<Record<CredentialScheme, Verifier>> = {
  "companies-house": companiesHouseVerifier,
  vat: vatVerifier
};

/** Public register URL used by the Manager UI + widget tooltip. */
export const REGISTER_URLS: Record<CredentialScheme, string | null> = {
  "gas-safe": "https://www.gassaferegister.co.uk/find-an-engineer/",
  niceic: "https://niceic.com/find-a-contractor",
  napit: "https://napit.org.uk/find-an-installer",
  stroma: "https://www.stroma-certification.co.uk/find-a-tradesperson",
  trustmark: "https://www.trustmark.org.uk/homeowner/find-a-tradesperson",
  fmb: "https://www.fmb.org.uk/find-a-builder.html",
  mcs: "https://mcscertified.com/find-an-installer/",
  hetas: "https://www.hetas.co.uk/find/",
  oftec: "https://www.oftec.org/consumers/find-a-technician",
  fensa: "https://www.fensa.org.uk/find-installer",
  certass: "https://www.certass.co.uk/find-an-installer",
  chas: "https://www.chas.co.uk/find-a-supplier/",
  safecontractor: "https://www.safecontractor.com/contractor-search/",
  smas: "https://www.smasltd.com/find-a-contractor/",
  constructionline: "https://www.constructionline.co.uk/",
  ipaf: "https://www.ipaf.org/en/pal-card-check",
  pasma: "https://pasma.co.uk/pasma-cardholder-check/",
  "waste-carrier": "https://environment.data.gov.uk/public-register/view/search-waste-carriers-brokers",
  "companies-house": "https://find-and-update.company-information.service.gov.uk",
  vat: "https://www.gov.uk/check-uk-vat-number",
  "public-liability": null,
  cscs: "https://www.cscs.uk.com/applying-for-cards/smart-check/"
};

/** True when we have a real auto-verification path. */
export function isAutoVerified(scheme: CredentialScheme): boolean {
  return scheme in AUTO_VERIFIERS;
}

/** Run the appropriate verifier for the scheme. If no auto-verifier
 *  exists, returns { status: "self-declared" } — the daily cron treats
 *  this as "keep, don't touch". */
export async function verifyCredential(
  scheme: CredentialScheme,
  number: string
): Promise<VerifierResult> {
  const fn = AUTO_VERIFIERS[scheme];
  if (!fn) return { status: "self-declared" };
  return fn({ number });
}
