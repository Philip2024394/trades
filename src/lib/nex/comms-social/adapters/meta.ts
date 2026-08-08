// NEX Comms Centre · Social · Meta / Facebook adapter.
//
// Uses the Facebook Graph API (v20.0) for OAuth + Page publishing.
// - Docs: https://developers.facebook.com/docs/graph-api
// - OAuth: https://developers.facebook.com/docs/facebook-login/guides/access-tokens
// - Page posts: POST /{page-id}/feed  (text) or /{page-id}/photos (image)
//
// This adapter authenticates the merchant, exchanges the short-lived
// user token for a long-lived Page token (60-day), then publishes to
// the merchant's Page feed. Instagram publishing is a DIFFERENT flow
// (container-then-publish) and lives in adapters/instagram.ts.
//
// Provider quirks captured in capabilities() metadata (S-II boundary).
// Only THIS file may reference Meta-specific field names.

import { loadCreds } from "./env";
import { providerFetch, type FetchAdapterResult } from "./http";
import type {
  AdapterAuthCapabilities, AdapterAuthorizeUrlRequest, AdapterAuthorizeUrlResult,
  AdapterCapabilities, AdapterExchangeCodeRequest, AdapterExchangeCodeResult,
  AdapterHealthResult, AdapterPublishRequest, AdapterPublishResult,
  AdapterVerifyRequest, AdapterVerifyResult, SocialProvider,
} from "./interface";

const GRAPH_VERSION       = "v20.0";
const AUTH_ENDPOINT       = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_ENDPOINT      = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH_BASE          = `https://graph.facebook.com/${GRAPH_VERSION}`;

// Meta error codes worth classifying explicitly. Full list at
// https://developers.facebook.com/docs/graph-api/guides/error-handling.
function classifyMeta(input: { status: number; json: unknown; body_text: string }): {
  error_class: "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown";
  provider_code: string | null;
  message: string;
} {
  const err = (input.json as { error?: { code?: number; error_subcode?: number; message?: string; type?: string } })?.error;
  const code = err?.code;
  const sub  = err?.error_subcode;
  const msg  = err?.message ?? input.body_text.slice(0, 200);
  if (code === 190 || code === 102) return { error_class: "invalid_token", provider_code: String(code), message: msg };
  if (code === 4 || code === 17 || code === 32 || code === 613) return { error_class: "rate_limited", provider_code: String(code), message: msg };
  if (code === 1 || code === 2)      return { error_class: "transient", provider_code: String(code), message: msg };
  if (code === 100 && sub === 33)    return { error_class: "policy", provider_code: `${code}.${sub}`, message: msg };
  if (code === 368)                  return { error_class: "policy", provider_code: String(code), message: msg };
  if (code === 506)                  return { error_class: "content_rejected", provider_code: String(code), message: msg };
  if (input.status >= 500)           return { error_class: "transient", provider_code: String(input.status), message: msg };
  return { error_class: "unknown", provider_code: code ? String(code) : String(input.status), message: msg };
}

export function createMetaAdapter(): SocialProvider {
  const creds = loadCreds("meta", ["page_id"]);
  if (!creds) throw new Error("meta adapter cannot start · missing META_APP_ID / META_APP_SECRET / META_REDIRECT_URI");

  return {
    capabilities(): AdapterCapabilities {
      return {
        name:                              "meta",
        platform:                          "facebook",
        supports_server_side_idempotency:  false,             // Meta has no first-class idempotency key; publish is dedup-by-caller
        verify_pagination:                 { kind: "cursor",  page_size: 25 },
        duplicate_risk_disclosure_required: true,
        rate_limit_per_minute:             null,              // adapter self-manages · Meta uses BUC + app-level buckets
        rate_limit_backoff_seconds:        [60, 300, 900],
        caption_max_chars:                 63206,             // FB feed post max
        hashtags_max:                      30,
        images_max:                        10,
        video_max_seconds:                 240,
        image_aspect_hint:                 null,
        error_codes_meaning_invalid_token: ["190", "102"],
        error_codes_meaning_rate_limited:  ["4", "17", "32", "613"],
        error_codes_meaning_transient:     ["1", "2"],
        oauth_scopes_required_publish:     ["pages_manage_posts", "pages_read_engagement"],
      };
    },
    authCapabilities(): AdapterAuthCapabilities {
      return {
        oauth_authorize_endpoint: AUTH_ENDPOINT,
        supports_pkce:            false,                     // Meta login does not support PKCE for server-side apps
        supports_refresh_tokens:  false,                     // long-lived tokens are refreshed via GET /oauth/access_token (not refresh_token grant)
        scopes_available:         ["pages_manage_posts", "pages_read_engagement", "pages_show_list", "business_management"],
      };
    },
    authorizeUrl(req: AdapterAuthorizeUrlRequest): AdapterAuthorizeUrlResult {
      const p = new URLSearchParams({
        client_id:     creds.app_id,
        redirect_uri:  req.redirect_uri,
        state:         req.state,
        response_type: "code",
        scope:         req.scopes.join(","),
      });
      return { url: `${AUTH_ENDPOINT}?${p.toString()}` };
    },
    async exchangeCode(req: AdapterExchangeCodeRequest): Promise<AdapterExchangeCodeResult> {
      // Step 1 · exchange code → short-lived user token
      const userQ = new URLSearchParams({
        client_id:     creds.app_id,
        client_secret: creds.app_secret,
        redirect_uri:  req.redirect_uri,
        code:          req.code,
      });
      const userR = await providerFetch({
        method: "GET",
        url:    `${TOKEN_ENDPOINT}?${userQ.toString()}`,
      }, classifyMeta);
      if (!userR.ok) return failFromFetch(userR, "code_exchange");
      const userJson = userR.json as { access_token?: string; expires_in?: number } | null;
      if (!userJson?.access_token) {
        return { ok: false, error_class: "unknown", error_message: "no access_token in Meta response", raw_metadata: { body_text: userR.body_text.slice(0, 200) } };
      }
      const shortLived = userJson.access_token;

      // Step 2 · convert to long-lived (60-day) user token
      const longQ = new URLSearchParams({
        grant_type:        "fb_exchange_token",
        client_id:         creds.app_id,
        client_secret:     creds.app_secret,
        fb_exchange_token: shortLived,
      });
      const longR = await providerFetch({
        method: "GET",
        url:    `${TOKEN_ENDPOINT}?${longQ.toString()}`,
      }, classifyMeta);
      if (!longR.ok) return failFromFetch(longR, "long_lived_exchange");
      const longJson = longR.json as { access_token?: string; expires_in?: number } | null;
      const longLived = longJson?.access_token ?? shortLived;

      // Step 3 · fetch pages the user manages · pick the first (Phase 5 · Phase 6 UI lets merchant choose)
      const pagesR = await providerFetch({
        method: "GET",
        url:    `${GRAPH_BASE}/me/accounts?access_token=${encodeURIComponent(longLived)}`,
      }, classifyMeta);
      if (!pagesR.ok) return failFromFetch(pagesR, "pages_fetch");
      const pagesJson = pagesR.json as { data?: Array<{ id: string; name: string; access_token: string }> } | null;
      const page = pagesJson?.data?.[0];
      if (!page) {
        return { ok: false, error_class: "unknown", error_message: "merchant has no manageable Pages", raw_metadata: {} };
      }

      // The PAGE access token is what we store · that's what allows publish.
      // Long-lived Page tokens don't expire (unless the user changes password / revokes).
      return {
        ok:                  true,
        access_token:        page.access_token,
        refresh_token:       null,                          // Meta does not use refresh_token grant
        token_expires_at:    null,                          // long-lived page token is effectively non-expiring
        scopes:              ["pages_manage_posts", "pages_read_engagement"],
        platform_account_id: page.id,
        display_name:        page.name,
        raw_metadata:        { page_id: page.id, long_lived_user_expires_in: longJson?.expires_in ?? null },
      };
    },
    async publish(req: AdapterPublishRequest): Promise<AdapterPublishResult> {
      // Charter S-II: adapter is the ONLY code that knows how to talk to Meta.
      // Text or image publish; multi-image uses staged uploads (Phase 5 covers text + single image).
      const pageId = req.account.platform_account_id;
      if (!pageId) {
        return {
          ok:            false,
          error_class:   "policy",
          error_message: "meta adapter: account has no platform_account_id (Page ID)",
          provider_code: null,
          retry_after_seconds: null,
          raw_metadata:  {},
        };
      }
      const captionOnly = [req.caption, req.hashtags.join(" "), req.cta ?? ""].filter(Boolean).join("\n\n");
      // Embed our idempotency marker in an invisible zero-width joiner so
      // verify() can grep recent posts. Meta doesn't offer server-side
      // idempotency; this is the compensating pattern per S-VII.
      const captionWithMarker = `${captionOnly}\n​${req.idempotency_marker}`;

      const url = req.media.length === 0
        ? `${GRAPH_BASE}/${pageId}/feed`
        : `${GRAPH_BASE}/${pageId}/photos`;
      const body = new URLSearchParams({
        message:      captionWithMarker,
        access_token: req.access_token,
      });
      if (req.media[0]) body.set("url", req.media[0].url);
      const r = await providerFetch({
        method:  "POST",
        url,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      }, classifyMeta);
      if (!r.ok) return failFromFetchPublish(r);
      const j = r.json as { id?: string; post_id?: string } | null;
      const provider_post_id = j?.post_id ?? j?.id ?? "";
      return {
        ok:                true,
        provider_post_id,
        provider_post_url: provider_post_id ? `https://facebook.com/${provider_post_id}` : null,
        idempotency_hit:   false,                            // Meta has no server-side dedup
        raw_metadata:      (j ?? {}) as Record<string, unknown>,
      };
    },
    async verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult> {
      // Scan recent Page posts for our idempotency marker in the message.
      const pageId = req.account.platform_account_id;
      if (!pageId) return { found: "unknown", note: "no page id" };
      const sinceEpoch = Math.floor(new Date(req.since).getTime() / 1000);
      const url = `${GRAPH_BASE}/${pageId}/feed?fields=id,message,created_time&since=${sinceEpoch}&limit=25&access_token=${encodeURIComponent(req.access_token)}`;
      const r = await providerFetch({ method: "GET", url }, classifyMeta);
      if (!r.ok) return { found: "unknown", note: `verify_fetch_${r.error_class}` };
      const rows = (r.json as { data?: Array<{ id: string; message?: string }> })?.data ?? [];
      const hit = rows.find((row) => (row.message ?? "").includes(req.idempotency_marker));
      if (!hit) return { found: false };
      return { found: true, provider_post_id: hit.id, provider_post_url: `https://facebook.com/${hit.id}` };
    },
    async health(): Promise<AdapterHealthResult> {
      const r = await providerFetch({ method: "GET", url: `${GRAPH_BASE}/${creds.app_id}?access_token=${encodeURIComponent(creds.app_id)}|${encodeURIComponent(creds.app_secret)}` }, classifyMeta);
      return { ok: r.ok, note: r.ok ? "app metadata reachable" : `status=${r.status}` };
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────
function failFromFetch(r: FetchAdapterResult & { ok: false }, phase: string): AdapterExchangeCodeResult & { ok: false } {
  return {
    ok:            false,
    error_class:   (r.error_class === "invalid_token" ? "invalid_code" : (r.error_class as never)) as never,
    error_message: `[${phase}] ${r.message}`,
    raw_metadata:  { status: r.status, provider_code: r.provider_code, body_text: r.body_text.slice(0, 300) },
  };
}
function failFromFetchPublish(r: FetchAdapterResult & { ok: false }): AdapterPublishResult & { ok: false } {
  const cls = r.error_class;
  const mapped: AdapterPublishResult extends { ok: false } ? Exclude<(AdapterPublishResult & { ok: false })["error_class"], never> : never =
    (cls === "network" || cls === "timeout" || cls === "transient") ? "transient"
    : (cls === "invalid_token") ? "invalid_token"
    : (cls === "rate_limited") ? "rate_limited"
    : (cls === "policy") ? "policy"
    : (cls === "content_rejected") ? "content_rejected"
    : "unknown";
  return {
    ok:                  false,
    error_class:         mapped as never,
    error_message:       r.message,
    provider_code:       r.provider_code,
    retry_after_seconds: r.retry_after_seconds,
    raw_metadata:        { status: r.status, body_text: r.body_text.slice(0, 300) },
  };
}
