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
  AdapterCapabilities,
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
