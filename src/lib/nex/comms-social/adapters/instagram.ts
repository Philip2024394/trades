// NEX Comms Centre · Social · Instagram adapter.
//
// Uses the Instagram Graph API (via Meta v20.0). Publishing to an IG
// Business account requires a two-step container-then-publish flow:
//   1. POST /{ig-user-id}/media  → returns container id
//   2. POST /{ig-user-id}/media_publish?creation_id={container}  → publishes
// Docs: https://developers.facebook.com/docs/instagram-api/guides/content-publishing
//
// OAuth is shared with Meta (Facebook Login for Business); the IG
// account id is derived by querying /{page-id}?fields=instagram_business_account.

import { loadCreds } from "./env";
import { providerFetch, type FetchAdapterResult } from "./http";
import type {
  AdapterAuthCapabilities, AdapterAuthorizeUrlRequest, AdapterAuthorizeUrlResult,
  AdapterCapabilities, AdapterExchangeCodeRequest, AdapterExchangeCodeResult,
  AdapterHealthResult, AdapterPublishRequest, AdapterPublishResult,
  AdapterVerifyRequest, AdapterVerifyResult, SocialProvider,
} from "./interface";

const GRAPH_VERSION  = "v20.0";
const AUTH_ENDPOINT  = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_ENDPOINT = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH_BASE     = `https://graph.facebook.com/${GRAPH_VERSION}`;

function classifyIG(input: { status: number; json: unknown; body_text: string }): {
  error_class: "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown";
  provider_code: string | null;
  message: string;
} {
  const err = (input.json as { error?: { code?: number; message?: string } })?.error;
  const code = err?.code;
  const msg  = err?.message ?? input.body_text.slice(0, 200);
  if (code === 190 || code === 102) return { error_class: "invalid_token",   provider_code: String(code), message: msg };
  if (code === 4 || code === 17 || code === 32 || code === 613)
                                     return { error_class: "rate_limited",   provider_code: String(code), message: msg };
  if (code === 24 || code === 36)    return { error_class: "content_rejected", provider_code: String(code), message: msg };
  if (input.status >= 500)           return { error_class: "transient",      provider_code: String(input.status), message: msg };
  return { error_class: "unknown", provider_code: code ? String(code) : String(input.status), message: msg };
}

export function createInstagramAdapter(): SocialProvider {
  const creds = loadCreds("instagram", ["ig_user_id"]);
  if (!creds) throw new Error("instagram adapter cannot start · missing INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET / INSTAGRAM_REDIRECT_URI");

  return {
    capabilities(): AdapterCapabilities {
      return {
        name: "instagram", platform: "instagram",
        supports_server_side_idempotency: false,
        verify_pagination: { kind: "cursor", page_size: 25 },
        duplicate_risk_disclosure_required: true,
        rate_limit_per_minute: null,
        rate_limit_backoff_seconds: [60, 300, 900],
        caption_max_chars: 2200,
        hashtags_max: 30,
        images_max: 10,                     // carousel · single image supported in Phase 5
        video_max_seconds: 60,              // Reels; feed video up to 60m but not covered here
        image_aspect_hint: "1:1 to 4:5 (feed) · 9:16 (Reels)",
        error_codes_meaning_invalid_token: ["190", "102"],
        error_codes_meaning_rate_limited:  ["4", "17", "32", "613"],
        error_codes_meaning_transient:     ["1", "2"],
        oauth_scopes_required_publish:     ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
      };
    },
    authCapabilities(): AdapterAuthCapabilities {
      return {
        oauth_authorize_endpoint: AUTH_ENDPOINT,
        supports_pkce: false,
        supports_refresh_tokens: false,
        scopes_available: ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
      };
    },
    authorizeUrl(req: AdapterAuthorizeUrlRequest): AdapterAuthorizeUrlResult {
      const p = new URLSearchParams({
        client_id: creds.app_id, redirect_uri: req.redirect_uri, state: req.state,
        response_type: "code", scope: req.scopes.join(","),
      });
      return { url: `${AUTH_ENDPOINT}?${p.toString()}` };
    },
    async exchangeCode(req: AdapterExchangeCodeRequest): Promise<AdapterExchangeCodeResult> {
      // Step 1 · short-lived user token
      const userQ = new URLSearchParams({
        client_id: creds.app_id, client_secret: creds.app_secret,
        redirect_uri: req.redirect_uri, code: req.code,
      });
      const userR = await providerFetch({ method: "GET", url: `${TOKEN_ENDPOINT}?${userQ.toString()}` }, classifyIG);
      if (!userR.ok) return failEx(userR, "code_exchange");
      const userJson = userR.json as { access_token?: string } | null;
      if (!userJson?.access_token) return { ok: false, error_class: "unknown", error_message: "no access_token in IG response", raw_metadata: {} };
      const short = userJson.access_token;

      // Step 2 · long-lived user token (60 days)
      const longQ = new URLSearchParams({
        grant_type: "fb_exchange_token", client_id: creds.app_id,
        client_secret: creds.app_secret, fb_exchange_token: short,
      });
      const longR = await providerFetch({ method: "GET", url: `${TOKEN_ENDPOINT}?${longQ.toString()}` }, classifyIG);
      if (!longR.ok) return failEx(longR, "long_lived_exchange");
      const longJson = longR.json as { access_token?: string; expires_in?: number } | null;
      const long = longJson?.access_token ?? short;

      // Step 3 · find the merchant's Page and its linked IG business account
      const pagesR = await providerFetch({
        method: "GET",
        url: `${GRAPH_BASE}/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${encodeURIComponent(long)}`,
      }, classifyIG);
      if (!pagesR.ok) return failEx(pagesR, "pages_fetch");
      const pagesJson = pagesR.json as {
        data?: Array<{ id: string; name: string; access_token: string; instagram_business_account?: { id: string } }>;
      } | null;
      const page = (pagesJson?.data ?? []).find((p) => p.instagram_business_account?.id);
      if (!page || !page.instagram_business_account) {
        return { ok: false, error_class: "policy", error_message: "no IG business account linked to any manageable page", raw_metadata: {} };
      }
      const ig_user_id = page.instagram_business_account.id;

      return {
        ok: true,
        access_token: page.access_token,   // Page token is what IG publish requires
        refresh_token: null,
        token_expires_at: null,
        scopes: ["instagram_basic", "instagram_content_publish"],
        platform_account_id: ig_user_id,
        display_name: page.name,
        raw_metadata: { page_id: page.id, ig_user_id },
      };
    },
    async publish(req: AdapterPublishRequest): Promise<AdapterPublishResult> {
      const igUserId = req.account.platform_account_id;
      if (!igUserId) return failPub("policy", "instagram adapter: no ig_user_id on account");
      if (req.media.length === 0) return failPub("policy", "instagram: media is required (Instagram feed posts must include an image)");
      const first = req.media[0];
      const caption = [req.caption, req.hashtags.join(" ")].filter(Boolean).join("\n\n");
      const captionWithMarker = `${caption}\n​${req.idempotency_marker}`;

      // Step 1 · create media container
      const containerBody = new URLSearchParams({
        image_url:    first.url,             // for image · use video_url + media_type=REELS/VIDEO for other types
        caption:      captionWithMarker,
        access_token: req.access_token,
      });
      const containerR = await providerFetch({
        method: "POST",
        url:    `${GRAPH_BASE}/${igUserId}/media`,
        headers:{ "content-type": "application/x-www-form-urlencoded" },
        body:   containerBody,
      }, classifyIG);
      if (!containerR.ok) return failFromPub(containerR);
      const container = (containerR.json as { id?: string })?.id;
      if (!container) return failPub("unknown", "instagram: no container id returned");

      // Step 2 · publish the container
      const pubBody = new URLSearchParams({
        creation_id:  container,
        access_token: req.access_token,
      });
      const pubR = await providerFetch({
        method: "POST",
        url:    `${GRAPH_BASE}/${igUserId}/media_publish`,
        headers:{ "content-type": "application/x-www-form-urlencoded" },
        body:   pubBody,
      }, classifyIG);
      if (!pubR.ok) return failFromPub(pubR);
      const provider_post_id = (pubR.json as { id?: string })?.id ?? "";
      return {
        ok: true,
        provider_post_id,
        provider_post_url: provider_post_id ? `https://www.instagram.com/p/${provider_post_id}` : null,
        idempotency_hit:   false,
        raw_metadata:      (pubR.json ?? {}) as Record<string, unknown>,
      };
    },
    async verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult> {
      const igUserId = req.account.platform_account_id;
      if (!igUserId) return { found: "unknown", note: "no ig_user_id" };
      const url = `${GRAPH_BASE}/${igUserId}/media?fields=id,caption,timestamp&limit=25&access_token=${encodeURIComponent(req.access_token)}`;
      const r = await providerFetch({ method: "GET", url }, classifyIG);
      if (!r.ok) return { found: "unknown", note: `verify_fetch_${r.error_class}` };
      const rows = (r.json as { data?: Array<{ id: string; caption?: string }> })?.data ?? [];
      const hit = rows.find((row) => (row.caption ?? "").includes(req.idempotency_marker));
      if (!hit) return { found: false };
      return { found: true, provider_post_id: hit.id, provider_post_url: `https://www.instagram.com/p/${hit.id}` };
    },
    async health(): Promise<AdapterHealthResult> {
      return { ok: true, note: "reachable · no cheap ping · returns true if adapter registered" };
    },
  };
}

// ── shared helpers ────────────────────────────────────────────
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
