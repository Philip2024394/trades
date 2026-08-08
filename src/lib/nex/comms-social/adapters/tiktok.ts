// NEX Comms Centre · Social · TikTok adapter.
//
// TikTok Content Posting API · https://developers.tiktok.com/doc/content-posting-api-get-started
//   * OAuth 2.0 · https://open.tiktokapis.com/v2/oauth/token/
//   * Post video (initialize/upload/finalize) or draft
//
// TikTok is video-only for our purposes (Image Posts API exists in beta
// but is not covered in Phase 5). Text-only posts are not supported.

import { loadCreds } from "./env";
import { providerFetch, type FetchAdapterResult } from "./http";
import type {
  AdapterAuthCapabilities, AdapterAuthorizeUrlRequest, AdapterAuthorizeUrlResult,
  AdapterCapabilities, AdapterExchangeCodeRequest, AdapterExchangeCodeResult,
  AdapterHealthResult, AdapterPublishRequest, AdapterPublishResult,
  AdapterVerifyRequest, AdapterVerifyResult, SocialProvider,
} from "./interface";

const AUTH_ENDPOINT  = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_ENDPOINT = "https://open.tiktokapis.com/v2/oauth/token/";
const API_BASE       = "https://open.tiktokapis.com/v2";

function classifyTT(input: { status: number; json: unknown; body_text: string }): {
  error_class: "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown";
  provider_code: string | null; message: string;
} {
  const errObj = (input.json as { error?: { code?: string; message?: string } })?.error;
  const code = errObj?.code ?? String(input.status);
  const msg  = errObj?.message ?? input.body_text.slice(0, 200);
  if (code === "invalid_grant" || code === "invalid_client" || code === "unauthorized_client" || input.status === 401 || input.status === 403)
    return { error_class: "invalid_token", provider_code: code, message: msg };
  if (code === "rate_limit_exceeded" || input.status === 429)
    return { error_class: "rate_limited", provider_code: code, message: msg };
  if (code === "unsupported_grant_type" || code === "invalid_request")
    return { error_class: "content_rejected", provider_code: code, message: msg };
  if (input.status >= 500) return { error_class: "transient", provider_code: code, message: msg };
  return { error_class: "unknown", provider_code: code, message: msg };
}

export function createTikTokAdapter(): SocialProvider {
  const creds = loadCreds("tiktok");
  if (!creds) throw new Error("tiktok adapter cannot start · missing TIKTOK_APP_ID / TIKTOK_APP_SECRET / TIKTOK_REDIRECT_URI");

  return {
    capabilities(): AdapterCapabilities {
      return {
        name: "tiktok", platform: "tiktok",
        supports_server_side_idempotency: false,
        verify_pagination: { kind: "cursor", page_size: 20 },
        duplicate_risk_disclosure_required: true,
        rate_limit_per_minute: null,
        rate_limit_backoff_seconds: [60, 300, 900],
        caption_max_chars: 2200,
        hashtags_max: 30,
        images_max: 0,                       // TikTok is video-first · image posts are a separate flow not covered
        video_max_seconds: 180,              // varies by account tier · 180 covers most
        image_aspect_hint: "9:16",
        error_codes_meaning_invalid_token: ["invalid_grant", "invalid_client", "unauthorized_client"],
        error_codes_meaning_rate_limited:  ["rate_limit_exceeded"],
        error_codes_meaning_transient:     ["500", "502", "503"],
        oauth_scopes_required_publish:     ["user.info.basic", "video.upload", "video.publish"],
      };
    },
    authCapabilities(): AdapterAuthCapabilities {
      return {
        oauth_authorize_endpoint: AUTH_ENDPOINT,
        supports_pkce: true,
        supports_refresh_tokens: true,
        scopes_available: ["user.info.basic", "video.upload", "video.publish", "video.list"],
      };
    },
    authorizeUrl(req: AdapterAuthorizeUrlRequest): AdapterAuthorizeUrlResult {
      const p = new URLSearchParams({
        client_key:    creds.app_id,
        scope:         req.scopes.join(","),
        redirect_uri:  req.redirect_uri,
        state:         req.state,
        response_type: "code",
      });
      if (req.code_challenge) {
        p.set("code_challenge",        req.code_challenge);
        p.set("code_challenge_method", "S256");
      }
      return { url: `${AUTH_ENDPOINT}?${p.toString()}` };
    },
    async exchangeCode(req: AdapterExchangeCodeRequest): Promise<AdapterExchangeCodeResult> {
      const body = new URLSearchParams({
        client_key:    creds.app_id,
        client_secret: creds.app_secret,
        code:          req.code,
        grant_type:    "authorization_code",
        redirect_uri:  req.redirect_uri,
      });
      if (req.code_verifier) body.set("code_verifier", req.code_verifier);
      const tokR = await providerFetch({
        method: "POST", url: TOKEN_ENDPOINT,
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      }, classifyTT);
      if (!tokR.ok) return failEx(tokR, "code_exchange");
      const tok = tokR.json as { access_token?: string; refresh_token?: string; expires_in?: number; open_id?: string; scope?: string } | null;
      if (!tok?.access_token) return { ok: false, error_class: "unknown", error_message: "no access_token in TikTok response", raw_metadata: {} };
      return {
        ok: true,
        access_token: tok.access_token,
        refresh_token: tok.refresh_token ?? null,
        token_expires_at: tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000).toISOString() : null,
        scopes: (tok.scope ?? "").split(/[\s,]+/).filter(Boolean),
        platform_account_id: tok.open_id ?? null,
        display_name: null,
        raw_metadata: { open_id: tok.open_id ?? null },
      };
    },
    async publish(req: AdapterPublishRequest): Promise<AdapterPublishResult> {
      const openId = req.account.platform_account_id;
      if (!openId) return failPub("policy", "tiktok: no open_id on account");
      const video = req.media.find((m) => m.kind === "video");
      if (!video) return failPub("policy", "tiktok publish requires a video · Phase 5 does not cover image posts");
      const caption = [req.caption, req.hashtags.join(" ")].filter(Boolean).join("\n\n");
      const captionWithMarker = `${caption}\n​${req.idempotency_marker}`;

      const initR = await providerFetch({
        method: "POST",
        url:    `${API_BASE}/post/publish/video/init/`,
        headers: {
          "authorization": `Bearer ${req.access_token}`,
          "content-type":  "application/json; charset=UTF-8",
        },
        body: JSON.stringify({
          post_info: {
            title:                captionWithMarker.slice(0, 150),
            description:          captionWithMarker,
            privacy_level:        "PUBLIC_TO_EVERYONE",
            disable_duet:         false,
            disable_stitch:       false,
            disable_comment:      false,
            video_cover_timestamp_ms: 1000,
          },
          source_info: {
            source:    "PULL_FROM_URL",
            video_url: video.url,
          },
        }),
      }, classifyTT);
      if (!initR.ok) return failFromPub(initR);
      const publish_id = (initR.json as { data?: { publish_id?: string } })?.data?.publish_id ?? "";
      return {
        ok: true,
        provider_post_id: publish_id,
        provider_post_url: null,                                 // TikTok URL not known until post is processed
        idempotency_hit: false,
        raw_metadata: (initR.json ?? {}) as Record<string, unknown>,
      };
    },
    async verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult> {
      // TikTok publish is async · status is available via /post/publish/status/fetch/
      // Phase 5 returns unknown (async publish means "found" is temporarily
      // false during processing). Phase 5.5 adds status polling.
      const _ = req;
      return { found: "unknown", note: "TikTok publish is async · use /post/publish/status/fetch/ · Phase 5.5" };
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
