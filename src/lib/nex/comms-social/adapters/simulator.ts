// NEX Comms Centre · Social · SIMULATOR adapter.
//
// Phase 0 non-provider adapter. In-memory. Deterministic. No external
// calls. Used by tests to prove the engine/adapter boundary and the
// idempotency/verify-loop shape work end-to-end without touching a real
// platform.
//
// This is the ONLY adapter shipped in Phase 0. Real providers (Meta ·
// IG · LinkedIn · TikTok · Google Business) land in Phase 5 as
// additional files in this folder, each implementing the same
// SocialProvider interface.

import type {
  AdapterAuthCapabilities,
  AdapterAuthorizeUrlRequest,
  AdapterAuthorizeUrlResult,
  AdapterCapabilities,
  AdapterExchangeCodeRequest,
  AdapterExchangeCodeResult,
  AdapterHealthResult,
  AdapterPublishRequest,
  AdapterPublishResult,
  AdapterVerifyRequest,
  AdapterVerifyResult,
  SocialProvider,
} from "./interface";

// In-memory posts store keyed by idempotency_marker so we can prove
// server-side idempotency + verify-loop behave correctly under retry
// scenarios in tests.
const storedByMarker = new Map<string, { provider_post_id: string; provider_post_url: string; created_at: number }>();

export function createSimulatorAdapter(): SocialProvider {
  return {
    capabilities(): AdapterCapabilities {
      return {
        name:                              "simulator",
        platform:                          "simulator",
        supports_server_side_idempotency:  true,           // simulator behaves like an ideal provider
        verify_pagination:                 { kind: "timestamp", page_size: 100 },
        duplicate_risk_disclosure_required: false,
        rate_limit_per_minute:             null,
        rate_limit_backoff_seconds:        [30, 90, 300],
        caption_max_chars:                 2200,
        hashtags_max:                      30,
        images_max:                        10,
        video_max_seconds:                 60,
        image_aspect_hint:                 null,
        error_codes_meaning_invalid_token: ["SIM_INVALID_TOKEN"],
        error_codes_meaning_rate_limited:  ["SIM_RATE_LIMIT"],
        error_codes_meaning_transient:     ["SIM_TRANSIENT"],
        oauth_scopes_required_publish:     [],
      };
    },

    authCapabilities(): AdapterAuthCapabilities {
      return {
        oauth_authorize_endpoint: "https://sim.example/oauth/authorize",
        supports_pkce:            true,
        supports_refresh_tokens:  true,
        scopes_available:         ["social.read", "social.publish"],
      };
    },

    authorizeUrl(req: AdapterAuthorizeUrlRequest): AdapterAuthorizeUrlResult {
      const p = new URLSearchParams({
        client_id:     "sim-client",
        response_type: "code",
        redirect_uri:  req.redirect_uri,
        state:         req.state,
        scope:         req.scopes.join(" "),
      });
      if (req.code_challenge) {
        p.set("code_challenge",        req.code_challenge);
        p.set("code_challenge_method", "S256");
      }
      return { url: `https://sim.example/oauth/authorize?${p.toString()}` };
    },

    async exchangeCode(req: AdapterExchangeCodeRequest): Promise<AdapterExchangeCodeResult> {
      // Simulator: any non-empty code is exchangeable. Returns a
      // deterministic-ish token so tests can round-trip the encryption.
      if (!req.code || req.code.startsWith("bad_")) {
        return {
          ok:            false,
          error_class:   "invalid_code",
          error_message: "simulator refused the code",
          raw_metadata:  { simulated: true },
        };
      }
      // If PKCE was declared but no verifier arrives, fail — mirrors
      // real providers.
      // (We don't record which init set challenge · adapter is stateless.
      //  Real providers enforce this via server-side session. Simulator
      //  just accepts a verifier if provided.)
      return {
        ok:                  true,
        access_token:        `sim_access_${req.code}_${Date.now()}`,
        refresh_token:       `sim_refresh_${req.code}_${Date.now()}`,
        token_expires_at:    new Date(Date.now() + 3600_000).toISOString(),
        scopes:              ["social.read", "social.publish"],
        platform_account_id: `sim-acct-${req.code.slice(-6)}`,
        display_name:        `Simulator Account (${req.code.slice(0, 6)})`,
        raw_metadata:        { simulated: true, code_verifier_present: Boolean(req.code_verifier) },
      };
    },

    async publish(req: AdapterPublishRequest): Promise<AdapterPublishResult> {
      // Server-side idempotency: same marker → same result, flagged as a hit.
      const existing = storedByMarker.get(req.idempotency_marker);
      if (existing) {
        return {
          ok:                true,
          provider_post_id:  existing.provider_post_id,
          provider_post_url: existing.provider_post_url,
          idempotency_hit:   true,
          raw_metadata:      { simulated: true, note: "returned prior successful publish for the same marker" },
        };
      }
      const id  = `sim_${req.account.platform}_${req.post_id}_${Date.now()}`;
      const url = `https://sim.example/posts/${id}`;
      storedByMarker.set(req.idempotency_marker, { provider_post_id: id, provider_post_url: url, created_at: Date.now() });
      return {
        ok:                true,
        provider_post_id:  id,
        provider_post_url: url,
        idempotency_hit:   false,
        raw_metadata:      { simulated: true },
      };
    },

    async verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult> {
      const existing = storedByMarker.get(req.idempotency_marker);
      if (!existing) return { found: false };
      return { found: true, provider_post_id: existing.provider_post_id, provider_post_url: existing.provider_post_url };
    },

    async health(): Promise<AdapterHealthResult> {
      return { ok: true, note: "simulator" };
    },
  };
}

// Test helpers · exported so unit tests can inspect and reset in-memory
// state. Do NOT import these from engine code.
export const __simulatorInternals = {
  reset(): void { storedByMarker.clear(); },
  size(): number { return storedByMarker.size; },
};
