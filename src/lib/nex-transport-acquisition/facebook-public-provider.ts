// src/lib/nex-transport-acquisition/facebook-public-provider.ts
//
// FACEBOOK PUBLIC PROVIDER · public-source-only · gated abstraction.
//
// Doctrine (INVIOLABLE):
//   · NEX must NEVER scrape Facebook. Meta's Terms of Service prohibit
//     unauthorized scraping. The only compliant path is Meta's official
//     Graph API with a registered Meta developer app + app-review approval.
//   · Even with API access · only public endpoints are consumed
//     (public Page posts · Public Search endpoints where available and permitted).
//   · Private profiles · private groups · login-gated content · hidden phone
//     numbers · signed-in-only data · all remain OFF-LIMITS regardless of
//     technical capability.
//   · Records ingested from Facebook enter at discovery_stage='discovered'
//     with source_kind='public_facebook_business_page'.
//   · A public post saying "Saya driver Jogja, WA 08xxxx" is legitimate
//     public evidence. NEX may store name + normalised phone + area +
//     vehicle-if-explicitly-stated. Nothing more.
//
// Kill switches (default OFF):
//   NEX_FACEBOOK_PROVIDER_ENABLED === 'true'
//   NEX_FACEBOOK_APP_ID           set
//   NEX_FACEBOOK_APP_SECRET       set
//   NEX_FACEBOOK_ACCESS_TOKEN     set (short-lived · rotated by ops)
//
// Missing any of the above → provider returns NOT_CONFIGURED honestly. HQ
// page displays that status · never fabricates results.

import type { GeneratedQuery } from "./query-universe";

export interface FbPublicRecord {
  businessOrPersonName: string;
  pageOrPostUrl: string;
  publicPhoneRaw: string | null;
  areaText: string | null;
  vehicleTextIfExplicit: string | null;
  capturedAt: Date;
  sourceEvidenceNote: string;
}

export interface FbProviderOK {
  status: "OK";
  provider: "facebook_public";
  records: FbPublicRecord[];
  queriesConsumed: number;
  rateLimitRemaining: number | null;
}

export interface FbProviderNotConfigured {
  status: "NOT_CONFIGURED";
  provider: "facebook_public";
  missing: string[];    // list of env vars that are not set
  detail: string;
}

export interface FbProviderRefused {
  status: "REFUSED";
  provider: "facebook_public";
  reason:
    | "META_APP_REVIEW_REQUIRED"
    | "RATE_LIMIT_EXHAUSTED"
    | "TOKEN_INVALID"
    | "SCOPE_INSUFFICIENT";
  detail: string;
}

export interface FbProviderError {
  status: "ERROR";
  provider: "facebook_public";
  detail: string;
}

export type FbProviderResult = FbProviderOK | FbProviderNotConfigured | FbProviderRefused | FbProviderError;

export interface FbProviderRunInput {
  queries: GeneratedQuery[];
  jurisdictionHint: string;   // e.g. 'ID/DIY/Yogyakarta'
}

/**
 * Check whether the Facebook provider is legitimately configured to make real
 * API calls. This function NEVER makes a network request · it only inspects
 * environment. Callers use it to short-circuit before doing any work.
 */
export function checkFacebookProviderConfig(): FbProviderNotConfigured | { status: "OK" } {
  const missing: string[] = [];
  if (process.env.NEX_FACEBOOK_PROVIDER_ENABLED !== "true") missing.push("NEX_FACEBOOK_PROVIDER_ENABLED=true");
  if (!process.env.NEX_FACEBOOK_APP_ID)                     missing.push("NEX_FACEBOOK_APP_ID");
  if (!process.env.NEX_FACEBOOK_APP_SECRET)                 missing.push("NEX_FACEBOOK_APP_SECRET");
  if (!process.env.NEX_FACEBOOK_ACCESS_TOKEN)               missing.push("NEX_FACEBOOK_ACCESS_TOKEN");
  if (missing.length > 0) {
    return {
      status: "NOT_CONFIGURED",
      provider: "facebook_public",
      missing,
      detail: `Facebook public-provider is not configured. Missing: ${missing.join(", ")}. Provider refuses to make any request without full configuration. This is honest silence · not "0 discovered".`,
    };
  }
  return { status: "OK" };
}

/**
 * Run the Facebook public provider against a set of queries.
 * When not configured, returns NOT_CONFIGURED honestly.
 * When configured, the REAL implementation would call Meta Graph API
 * endpoints such as `/search?type=page` (subject to Meta's app-review + rate
 * limits). This implementation stops at config check because no live Meta
 * app is registered · the honest state.
 */
export async function runFacebookPublicProvider(input: FbProviderRunInput): Promise<FbProviderResult> {
  const cfg = checkFacebookProviderConfig();
  if (cfg.status === "NOT_CONFIGURED") return cfg;

  // Real Meta Graph API call would go here · gated behind app review + scope grants.
  // Public endpoints that would apply:
  //   - GET /pages/search        (deprecated for most apps · requires elevated review)
  //   - GET /{page-id}/posts     (public page posts · requires page-level access)
  //   - GET /{page-id}?fields=name,phone,website,about
  // NEX MUST NOT:
  //   - Query private profiles (/{user-id} without user consent)
  //   - Query private groups (/{group-id}/members without group-admin permission)
  //   - Circumvent authentication (never · under any circumstance)
  //
  // Until Meta app is registered + reviewed:
  return {
    status: "REFUSED",
    provider: "facebook_public",
    reason: "META_APP_REVIEW_REQUIRED",
    detail: `Facebook provider is env-enabled but no Meta app-review approval is on record. NEX refuses to make live Graph API calls without demonstrable app-review + scope grants. ${input.queries.length} queries queued for the next authorised run.`,
  };
}
