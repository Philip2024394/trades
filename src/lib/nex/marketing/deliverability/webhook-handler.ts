// src/lib/nex/marketing/deliverability/webhook-handler.ts
//
// NEX Deliverability · Authenticated Webhook Handler
// Founder-authorised programme · Session-19 · World-proof gate #4 · 2026-09-22.
//
// The endpoint-side glue between Session-8 verifiers, Session-6 classifier,
// and Session-7 recorder. Gated on:
//
//   1. NEX_WEBHOOK_ENDPOINTS_ACTIVATION === "on"   (Founder decision)
//   2. Per-provider secret env var is configured   (Founder decision)
//
// GOVERNANCE HARD-LOCKS:
//   * Endpoint returns 503 endpoint_dormant when either gate off
//   * Signature verification MANDATORY when active · fail → 401
//   * Never trusts unverified payloads
//   * Never returns raw email addresses in the response body
//   * Never sends · never mutates outside the recorder path

import type { PoolClient } from "pg";
import { verifyProviderWebhook, type WebhookProvider, type VerifyOutcome } from "./webhook-verifiers";
import { classifyBounceEvent } from "./bounce-classifier";
import { recordClassifiedEvent } from "./event-recorder";
import { WEBHOOK_SECRET_ENV_KEYS } from "./readiness";

export type HandleWebhookResult =
  | { kind: "recorded"; provider: WebhookProvider; classified_kind: string; event_id: string; reputation_recomputed: boolean }
  | { kind: "already_recorded"; provider: WebhookProvider; event_id: string }
  | { kind: "insufficient_evidence"; provider: WebhookProvider; reason: string }
  | { kind: "signature_failed"; provider: WebhookProvider; verify_kind: VerifyOutcome["kind"]; reason: string }
  | { kind: "endpoint_dormant"; provider: WebhookProvider; reason: string; missing: readonly string[] }
  | { kind: "provider_unknown"; supplied: string };

export interface HandleWebhookInput {
  readonly provider: string;                 // untrusted · validated
  readonly raw_body: string;
  readonly headers: Record<string, string | undefined>;
  readonly env: NodeJS.ProcessEnv;
  readonly now_seconds?: number;
}

const KNOWN_PROVIDERS = ["resend", "sendgrid", "ses_sns", "mailgun", "postmark"] as const;

function isKnownProvider(p: string): p is WebhookProvider {
  return (KNOWN_PROVIDERS as readonly string[]).includes(p);
}

export async function handleAuthenticatedWebhook(
  client: PoolClient,
  input: HandleWebhookInput,
): Promise<HandleWebhookResult> {
  if (!isKnownProvider(input.provider)) {
    return { kind: "provider_unknown", supplied: input.provider };
  }
  const provider = input.provider;

  // Gate #4a — global activation
  if (input.env.NEX_WEBHOOK_ENDPOINTS_ACTIVATION !== "on") {
    return {
      kind: "endpoint_dormant",
      provider,
      reason: "webhook_endpoints_not_activated",
      missing: ["NEX_WEBHOOK_ENDPOINTS_ACTIVATION=on"],
    };
  }

  // Gate #4b — per-provider secret
  const secret_key = WEBHOOK_SECRET_ENV_KEYS[provider];
  const secret = input.env[secret_key];
  if (!secret || String(secret).length === 0) {
    return {
      kind: "endpoint_dormant",
      provider,
      reason: "per_provider_secret_not_configured",
      missing: [secret_key],
    };
  }

  // Verify signature
  const verify = verifyProviderWebhook(provider, {
    raw_body: input.raw_body,
    headers: input.headers,
    secret,
    now_seconds: input.now_seconds,
  });
  if (verify.kind !== "verified") {
    return {
      kind: "signature_failed",
      provider,
      verify_kind: verify.kind,
      reason: verify.kind === "signature_mismatch" ? verify.reason
        : verify.kind === "stale_timestamp" ? `skew_seconds=${verify.skew_seconds}`
        : verify.kind === "missing_headers" ? `missing=${verify.missing.join(",")}`
        : verify.kind === "malformed" ? verify.reason
        : "unknown_verify_failure",
    };
  }

  // Classify · payload is now trusted
  let payload_json: unknown;
  try { payload_json = JSON.parse(input.raw_body); }
  catch { payload_json = { raw: input.raw_body }; }
  const classified = classifyBounceEvent({
    provider,
    payload: payload_json,
    received_at: new Date().toISOString(),
  });

  // Record · Session-7 recorder handles idempotency + cascade + reputation
  const outcome = await recordClassifiedEvent(client, {
    event: classified,
    esp: provider,
    auto_recompute_reputation: true,
  });

  switch (outcome.kind) {
    case "recorded":
      return {
        kind: "recorded",
        provider,
        classified_kind: classified.kind,
        event_id: outcome.event_id,
        reputation_recomputed: outcome.reputation_recomputed,
      };
    case "already_recorded":
      return { kind: "already_recorded", provider, event_id: outcome.event_id };
    case "insufficient_evidence":
      return { kind: "insufficient_evidence", provider, reason: outcome.reason };
    case "error":
      return { kind: "insufficient_evidence", provider, reason: `recorder_error:${outcome.reason}` };
  }
}

// ─── Structural boundary markers ───────────────────────────────────
export const _HANDLER_REQUIRES_BOTH_GATES = "activation_env_AND_per_provider_secret_both_required";
export const _HANDLER_NEVER_TRUSTS_UNVERIFIED = "verify_kind_must_equal_verified_before_classify_and_record";
export const _HANDLER_DELEGATES_TO_PROVEN_LAYERS =
  "verify_via_session_8_classify_via_session_6_record_via_session_7";
