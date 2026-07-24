// Per-project contribution consent.
//
// Defaults to opt-out. No project silently contributes.
//
// Persistence hook: when a hammerex_nex_xp_consent table lands, wire
// it in resolveConsent(). Until then merchants can opt in per-request
// (e.g. via an admin API that passes an override).

import type { ContributionConsent } from "./types";

export type ResolveConsentInput = {
  projectId:    string;
  merchantSlug: string;
  /** Optional per-request override (e.g. from an admin action). */
  override?:    "opt_in" | "opt_out";
};

export function resolveConsent(input: ResolveConsentInput): ContributionConsent {
  if (input.override) {
    return {
      project_id:    input.projectId,
      merchant_slug: input.merchantSlug,
      status:        input.override,
      source:        "merchant_choice",
      set_at:        new Date().toISOString()
    };
  }
  return {
    project_id:    input.projectId,
    merchant_slug: input.merchantSlug,
    status:        "opt_out",
    source:        "engine_default",
    set_at:        new Date().toISOString()
  };
}

/** Predicate — is this project allowed into the aggregate today? */
export function isContributing(consent: ContributionConsent): boolean {
  return consent.status === "opt_in";
}
