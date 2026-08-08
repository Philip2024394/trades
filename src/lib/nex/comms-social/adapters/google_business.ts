// NEX Comms Centre · Social · Google Business Profile adapter.
//
// Google Business Profile "Local Posts" · Business Profile API:
//   * OAuth 2.0 · https://developers.google.com/identity/protocols/oauth2
//   * POST /v4/accounts/{accountId}/locations/{locationId}/localPosts
// Docs: https://developers.google.com/my-business/reference/rest/v4/accounts.locations.localPosts

import { loadCreds } from "./env";
import { providerFetch, type FetchAdapterResult } from "./http";
import type {
  AdapterAuthCapabilities, AdapterAuthorizeUrlRequest, AdapterAuthorizeUrlResult,
  AdapterCapabilities, AdapterExchangeCodeRequest, AdapterExchangeCodeResult,
  AdapterHealthResult, AdapterPublishRequest, AdapterPublishResult,
  AdapterVerifyRequest, AdapterVerifyResult, SocialProvider,
} from "./interface";

const AUTH_ENDPOINT   = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT  = "https://oauth2.googleapis.com/token";
const MYBUSINESS_BASE = "https://mybusiness.googleapis.com/v4";
const ACCOUNT_MGMT    = "https://mybusinessaccountmanagement.googleapis.com/v1";

function classifyGB(input: { status: number; json: unknown; body_text: string }): {
  error_class: "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown";
  provider_code: string | null; message: string;
} {
  const err = (input.json as { error?: { code?: number; status?: string; message?: string } })?.error;
  const code = err?.status ?? String(input.status);
  const msg  = err?.message ?? input.body_text.slice(0, 200);
  if (input.status === 401 || input.status === 403 || code === "UNAUTHENTICATED" || code === "PERMISSION_DENIED")
    return { error_class: "invalid_token", provider_code: code, message: msg };
  if (input.status === 429 || code === "RESOURCE_EXHAUSTED")
    return { error_class: "rate_limited", provider_code: code, message: msg };
  if (code === "INVALID_ARGUMENT" || code === "FAILED_PRECONDITION")
    return { error_class: "content_rejected", provider_code: code, message: msg };
  if (input.status >= 500 || code === "INTERNAL" || code === "UNAVAILABLE")
    return { error_class: "transient", provider_code: code, message: msg };
  return { error_class: "unknown", provider_code: code, message: msg };
}

export function createGoogleBusinessAdapter(): SocialProvider {
  const creds = loadCreds("google_business", ["location_name"]);
  if (!creds) throw new Error("google_business adapter cannot start · missing GOOGLEBUSINESS_APP_ID / _APP_SECRET / _REDIRECT_URI");

  return {
    capabilities(): AdapterCapabilities {
      return {
        name: "google_business", platform: "google_business",
        supports_server_side_idempotency: false,
        verify_pagination: { kind: "cursor", page_size: 20 },
        duplicate_risk_disclosure_required: true,
        rate_limit_per_minute: null,
        rate_limit_backoff_seconds: [60, 300, 900],
        caption_max_chars: 1500,
        hashtags_max: 0,                             // GBP local posts don't support hashtags in a first-class way
        images_max: 10,
        video_max_seconds: null,
        image_aspect_hint: null,
        error_codes_meaning_invalid_token: ["401", "403", "UNAUTHENTICATED", "PERMISSION_DENIED"],
        error_codes_meaning_rate_limited:  ["429", "RESOURCE_EXHAUSTED"],
        error_codes_meaning_transient:     ["500", "503", "INTERNAL", "UNAVAILABLE"],
        oauth_scopes_required_publish:     ["https://www.googleapis.com/auth/business.manage"],
      };
    },
    authCapabilities(): AdapterAuthCapabilities {
      return {
        oauth_authorize_endpoint: AUTH_ENDPOINT,
        supports_pkce: true,
        supports_refresh_tokens: true,
        scopes_available: ["https://www.googleapis.com/auth/business.manage", "openid", "email", "profile"],
      };
    },
    authorizeUrl(req: AdapterAuthorizeUrlRequest): AdapterAuthorizeUrlResult {
      const p = new URLSearchParams({
        client_id:     creds.app_id,
        redirect_uri:  req.redirect_uri,
        state:         req.state,
        response_type: "code",
        scope:         req.scopes.join(" "),
        access_type:   "offline",                   // returns refresh_token
        prompt:        "consent",                   // force refresh_token issuance
      });
      if (req.code_challenge) {
        p.set("code_challenge",        req.code_challenge);
        p.set("code_challenge_method", "S256");
      }
      return { url: `${AUTH_ENDPOINT}?${p.toString()}` };
    },
    async exchangeCode(req: AdapterExchangeCodeRequest): Promise<AdapterExchangeCodeResult> {
      const body = new URLSearchParams({
        code:          req.code,
        client_id:     creds.app_id,
        client_secret: creds.app_secret,
        redirect_uri:  req.redirect_uri,
        grant_type:    "authorization_code",
      });
      if (req.code_verifier) body.set("code_verifier", req.code_verifier);
      const tokR = await providerFetch({
        method: "POST", url: TOKEN_ENDPOINT,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      }, classifyGB);
      if (!tokR.ok) return failEx(tokR, "code_exchange");
      const tok = tokR.json as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string } | null;
      if (!tok?.access_token) return { ok: false, error_class: "unknown", error_message: "no access_token in Google response", raw_metadata: {} };

      // Fetch first available account · location must be chosen by merchant in Phase 6 UI
      const acctR = await providerFetch({
        method: "GET",
        url: `${ACCOUNT_MGMT}/accounts`,
        headers: { "authorization": `Bearer ${tok.access_token}` },
      }, classifyGB);
      if (!acctR.ok) return failEx(acctR, "accounts_fetch");
      const accounts = (acctR.json as { accounts?: Array<{ name: string; accountName?: string }> })?.accounts ?? [];
      const acct = accounts[0];
      if (!acct) return { ok: false, error_class: "policy", error_message: "no Google Business account accessible to this merchant", raw_metadata: {} };

      return {
        ok: true,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
        scopes: (tok.scope ?? "").split(/[\s,]+/).filter(Boolean),
        platform_account_id: acct.name,                       // e.g. "accounts/12345"
        display_name: acct.accountName ?? null,
        raw_metadata: { account_name: acct.name, location_name_hint: creds.extra.location_name ?? null },
      };
    },
    async publish(req: AdapterPublishRequest): Promise<AdapterPublishResult> {
      // Google Business publishes are per-location · we require merchant
      // to have supplied location_name via env (Phase 5 · Phase 6 UI lets
      // merchant pick from list).
      const accountName = req.account.platform_account_id;
      if (!accountName) return failPub("policy", "google_business: no account name on account");
      const locName = creds.extra.location_name;
      if (!locName) return failPub("policy", "google_business: GOOGLEBUSINESS_LOCATION_NAME env var required until Phase 6 UI lands");

      const captionOnly = req.caption;                     // hashtags dropped · GBP doesn't render them
      const captionWithMarker = `${captionOnly}\n​${req.idempotency_marker}`;

      const localPost = {
        languageCode: "en",
        summary: captionWithMarker,
        media: req.media.length > 0 ? req.media.slice(0, 10).map((m) => ({
          mediaFormat: m.kind === "image" ? "PHOTO" : "VIDEO",
          sourceUrl:   m.url,
        })) : undefined,
        topicType: "STANDARD",
      };
      const r = await providerFetch({
        method: "POST",
        url:    `${MYBUSINESS_BASE}/${locName}/localPosts`,
        headers: {
          "authorization": `Bearer ${req.access_token}`,
          "content-type":  "application/json",
        },
        body: JSON.stringify(localPost),
      }, classifyGB);
      if (!r.ok) return failFromPub(r);
      const posted = r.json as { name?: string; searchUrl?: string } | null;
      return {
        ok: true,
        provider_post_id: posted?.name ?? "",
        provider_post_url: posted?.searchUrl ?? null,
        idempotency_hit:  false,
        raw_metadata:     (posted ?? {}) as Record<string, unknown>,
      };
    },
    async verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult> {
      const locName = creds.extra.location_name;
      if (!locName) return { found: "unknown", note: "no location name to search" };
      const url = `${MYBUSINESS_BASE}/${locName}/localPosts?pageSize=20`;
      const r = await providerFetch({
        method: "GET", url,
        headers: { "authorization": `Bearer ${req.access_token}` },
      }, classifyGB);
      if (!r.ok) return { found: "unknown", note: `verify_fetch_${r.error_class}` };
      const posts = (r.json as { localPosts?: Array<{ name: string; summary?: string; searchUrl?: string }> })?.localPosts ?? [];
      const hit = posts.find((p) => (p.summary ?? "").includes(req.idempotency_marker));
      if (!hit) return { found: false };
      return { found: true, provider_post_id: hit.name, provider_post_url: hit.searchUrl ?? null };
    },
    async health(): Promise<AdapterHealthResult> {
      return { ok: true, note: "adapter registered · live health requires a valid access token" };
    },
  };
}

function failEx(r: FetchAdapterResult & { ok: false }, phase: string): AdapterExchangeCodeResult & { ok: false } {
  return {
    ok: false,
    error_class: (r.error_class === "invalid_token" ? "invalid_code" : (r.error_class as never)) as never,
    error_message: `[${phase}] ${r.message}`,
    raw_metadata: { status: r.status, provider_code: r.provider_code, body_text: r.body_text.slice(0, 300) },
  };
}
function failPub(cls: (AdapterPublishResult & { ok: false })["error_class"], msg: string): AdapterPublishResult & { ok: false } {
  return { ok: false, error_class: cls, error_message: msg, provider_code: null, retry_after_seconds: null, raw_metadata: {} };
}
function failFromPub(r: FetchAdapterResult & { ok: false }): AdapterPublishResult & { ok: false } {
  const cls = r.error_class;
  const mapped: (AdapterPublishResult & { ok: false })["error_class"] =
    cls === "network" || cls === "timeout" || cls === "transient" ? "transient"
    : cls === "invalid_token" ? "invalid_token"
    : cls === "rate_limited"  ? "rate_limited"
    : cls === "policy"        ? "policy"
    : cls === "content_rejected" ? "content_rejected"
    : "unknown";
  return {
    ok: false, error_class: mapped, error_message: r.message,
    provider_code: r.provider_code, retry_after_seconds: r.retry_after_seconds,
    raw_metadata: { status: r.status, body_text: r.body_text.slice(0, 300) },
  };
}
