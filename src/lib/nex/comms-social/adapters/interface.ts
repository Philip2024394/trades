// NEX Comms Centre · Social · SocialProvider interface (S-II boundary).
//
// The ONLY shape the engine ever sees when talking to a social provider.
// Every provider adapter (Meta · IG · LinkedIn · TikTok · Google
// Business · simulator) implements this interface and lives under
// `src/lib/nex/comms-social/adapters/*.ts`. No code outside this folder
// may import a provider SDK.
//
// Adapter metadata (capabilities) is validated at process start (see
// registry.ts in Phase 5). Unknown-field metadata fails validation and
// the adapter refuses to register.

import type { SocialAccount, SocialPlatform } from "../types";

// ── Capability metadata (adapter-declared) ─────────────────────
//
// Adapters describe their platform's quirks here rather than embedding
// those quirks in engine/worker code. Any behavioural difference between
// platforms (media constraints · rate limits · idempotency support ·
// pagination) MUST be expressed via this capability object.
export interface AdapterCapabilities {
  // Identity
  name:      string;                                    // matches platform name for real providers · "simulator" for the Phase 0 adapter
  platform:  SocialPlatform;

  // S-VII · idempotency
  supports_server_side_idempotency: boolean;
  verify_pagination:                {
    kind:      "cursor" | "offset" | "timestamp";
    page_size: number;
  };
  duplicate_risk_disclosure_required: boolean;         // MUST be true when supports_server_side_idempotency is false

  // Rate limits (adapter-owned)
  rate_limit_per_minute:              number | null;   // null = adapter self-manages
  rate_limit_backoff_seconds:         number[];        // e.g. [30, 90, 300]

  // Media constraints
  caption_max_chars:                  number;
  hashtags_max:                       number;
  images_max:                         number;
  video_max_seconds:                  number | null;
  image_aspect_hint:                  string | null;

  // Error taxonomy (adapter-declared)
  error_codes_meaning_invalid_token:  string[];        // provider-specific codes that map to our `invalid_token` failure
  error_codes_meaning_rate_limited:   string[];
  error_codes_meaning_transient:      string[];

  // OAuth
  oauth_scopes_required_publish:      string[];
}

// ── Publish request/result ─────────────────────────────────────
//
// Engine → adapter contract for a single publish attempt. The engine
// composes a platform-agnostic post and the adapter performs the
// provider-specific transformation.
export interface AdapterPublishRequest {
  account:            SocialAccount;
  post_id:            string;
  idempotency_marker: string;               // engine-supplied · adapter embeds in a provider-recognised field where possible
  caption:            string;
  hashtags:           string[];
  media:              AdapterMediaRef[];
  cta:                string | null;
  scheduled_for:      string | null;        // ISO · null = publish now
}

export interface AdapterMediaRef {
  url:    string;
  alt:    string;
  kind:   "image" | "video";
}

export type AdapterPublishResult =
  | {
      ok:                true;
      provider_post_id:  string;
      provider_post_url: string | null;
      idempotency_hit:   boolean;           // true if provider reported a dup based on our marker (server-side idempotency)
      raw_metadata:      Record<string, unknown>;
    }
  | {
      ok:               false;
      error_class:      "invalid_token" | "rate_limited" | "transient" | "policy" | "content_rejected" | "unknown";
      error_message:    string;
      provider_code:    string | null;
      retry_after_seconds: number | null;
      raw_metadata:     Record<string, unknown>;
    };

// ── Verify-loop (S-VII) ────────────────────────────────────────
//
// After publish, engine queries the adapter to confirm the post
// actually landed on the provider. Required when
// supports_server_side_idempotency is false; recommended always.
export interface AdapterVerifyRequest {
  account:            SocialAccount;
  idempotency_marker: string;
  since:              string;               // ISO · lower bound on when the intent was issued
}

export type AdapterVerifyResult =
  | { found: true;  provider_post_id: string; provider_post_url: string | null }
  | { found: false;                                                              }
  | { found: "unknown"; note: string                                            };

// ── Health check ───────────────────────────────────────────────
export interface AdapterHealthResult {
  ok:   boolean;
  note: string | null;
}

// ── The interface ──────────────────────────────────────────────
export interface SocialProvider {
  capabilities(): AdapterCapabilities;
  publish(req: AdapterPublishRequest): Promise<AdapterPublishResult>;
  verify(req: AdapterVerifyRequest): Promise<AdapterVerifyResult>;
  health(): Promise<AdapterHealthResult>;
}
