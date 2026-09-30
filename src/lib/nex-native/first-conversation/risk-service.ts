// src/lib/nex-native/first-conversation/risk-service.ts
//
// Bridge 99 · Stage 5c · risk service boundary.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §8 · Risk service design.
//   §7A · Fingerprint is a risk signal, NEVER an identity resolver.
//   Founder-sealed 2026-09-30 · baseline 6566ace3.
//
// Two public surfaces:
//
//   1. assessRisk(RiskInput) → RiskDecision
//      Pure, deterministic scoring. Implements ONLY the sealed §8
//      thresholds. No I/O, no clock, no DB.
//
//   2. recordProvisionalFingerprint(account_id, fingerprint)
//      Controlled DB-write seam · the sole authorised writer for
//      nex_account_risk_signal. Records exactly what the caller
//      supplies. Does NOT resolve or discover the account.
//
//   3. clearProvisionalFingerprintOnClaim(account_id)
//      NULLs the fingerprint on the risk-signal row when the account
//      claims. Idempotent. Explicit per §7A.
//
// Doctrinal boundaries this module MUST NEVER cross:
//   · No imports from account-service, session-registry-service,
//     provisional-session, or first-message-orchestrator. Risk must
//     not become a back-door identity resolver.
//   · No writes to nex_account, nex_peer_conversation, nex_peer_message,
//     nex_welcome_outbox, or nex_session_registry.
//   · No exported function that turns a fingerprint into an account
//     identifier. (Structural + naming tests enforce this.)
//   · No implicit account creation. The account_id passed to record*
//     functions is authoritative · the risk service trusts the caller
//     produced it via the identity resolver (Stage 4d) or the
//     first-message orchestrator (Stage 6), never via a fingerprint
//     lookup.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";
import type { RiskInput } from "./risk-signals";

// ---------------------------------------------------------------------------
// Decision types
// ---------------------------------------------------------------------------

/** Challenge escalations available in v1. `face` is reserved for later. */
export type NexChallengeKind = "turnstile" | "phone_otp" | "face";

/**
 * Deterministic risk decision. `pass` → forward the send; `challenge` →
 * client must complete the named challenge and retry; `block` → hard
 * reject with a stable machine-readable reason.
 */
export type NexRiskDecision =
  | { level: "pass" }
  | { level: "challenge"; challenge_kind: NexChallengeKind }
  | { level: "block"; reason: NexRiskBlockReason };

/**
 * Enumerated block reasons. Callers switch on these to produce
 * user-facing copy per §Q7 (neutral phrasing).
 */
export type NexRiskBlockReason =
  | "message_too_short"
  | "duplicate_message"
  | "ip_reputation";

// ---------------------------------------------------------------------------
// Sealed §8 thresholds · single source of truth for tests + doctrine
// ---------------------------------------------------------------------------

export const NEX_RISK_THRESHOLDS = Object.freeze({
  /** message_length strictly less than this → block message_too_short. */
  MIN_MESSAGE_LENGTH: 3,
  /** same_message_hash_repeat_count at or above this → block duplicate_message. */
  MAX_SAME_MESSAGE_HASH_REPEATS: 3,
  /** new_conversations_last_hour strictly greater than this + provisional-new → challenge turnstile. */
  PROV_NEW_HOURLY_CHALLENGE: 5,
  /** new_conversations_last_hour strictly greater than this (any session) → challenge phone_otp. */
  ANY_HOURLY_CHALLENGE: 15,
  /** ip_reputation_score strictly greater than this → challenge turnstile. */
  IP_REP_CHALLENGE: 0.7,
  /** ip_reputation_score strictly greater than this → block ip_reputation. */
  IP_REP_BLOCK: 0.95,
} as const);

// ---------------------------------------------------------------------------
// assessRisk · pure, deterministic
// ---------------------------------------------------------------------------

/**
 * Sealed §8 risk assessment. Priority order:
 *
 *   1. Blocks (in enumerated order) · any block wins outright.
 *      · message_length < MIN_MESSAGE_LENGTH        → message_too_short
 *      · same_message_hash_repeat_count >= MAX...   → duplicate_message
 *      · ip_reputation_score > IP_REP_BLOCK         → ip_reputation
 *   2. Challenges (stronger first).
 *      · new_conversations_last_hour > ANY_HOURLY_CHALLENGE (any session)
 *                                                    → phone_otp
 *      · new_conversations_last_hour > PROV_NEW_HOURLY_CHALLENGE
 *        AND session_state === "provisional-new"     → turnstile
 *      · ip_reputation_score > IP_REP_CHALLENGE     → turnstile
 *   3. Otherwise → pass.
 *
 * Pure function · no I/O, no clock, no side effects. Same input
 * always yields the same decision. This is what makes the risk
 * service auditable and testable in isolation.
 */
export function assessRisk(input: RiskInput): NexRiskDecision {
  // --- Blocks ---
  if (input.message_length < NEX_RISK_THRESHOLDS.MIN_MESSAGE_LENGTH) {
    return { level: "block", reason: "message_too_short" };
  }
  if (
    input.same_message_hash_repeat_count >=
    NEX_RISK_THRESHOLDS.MAX_SAME_MESSAGE_HASH_REPEATS
  ) {
    return { level: "block", reason: "duplicate_message" };
  }
  if (input.ip_reputation_score > NEX_RISK_THRESHOLDS.IP_REP_BLOCK) {
    return { level: "block", reason: "ip_reputation" };
  }

  // --- Challenges (stronger first) ---
  if (
    input.new_conversations_last_hour >
    NEX_RISK_THRESHOLDS.ANY_HOURLY_CHALLENGE
  ) {
    return { level: "challenge", challenge_kind: "phone_otp" };
  }
  if (
    input.session_state === "provisional-new" &&
    input.new_conversations_last_hour >
      NEX_RISK_THRESHOLDS.PROV_NEW_HOURLY_CHALLENGE
  ) {
    return { level: "challenge", challenge_kind: "turnstile" };
  }
  if (input.ip_reputation_score > NEX_RISK_THRESHOLDS.IP_REP_CHALLENGE) {
    return { level: "challenge", challenge_kind: "turnstile" };
  }

  // --- Default ---
  return { level: "pass" };
}

// ---------------------------------------------------------------------------
// DB write · recordProvisionalFingerprint
// ---------------------------------------------------------------------------

/**
 * Upsert the fingerprint for a provisional account. Sole authorised
 * writer for nex_account_risk_signal.
 *
 * Doctrinal boundaries:
 *   · Trusts the caller-supplied account_id · never derives it from
 *     the fingerprint or any other signal.
 *   · Never creates a nex_account row · the account MUST already
 *     exist (upstream orchestrator inserts nex_account BEFORE calling
 *     this).
 *   · Never touches any other table.
 *
 * Idempotent · on conflict (account_id) updates the fingerprint,
 * fingerprint_last_computed_at, and updated_at. Useful when a session
 * refresh recomputes the fingerprint under a rotated salt.
 */
export async function recordProvisionalFingerprint(
  account_id: string,
  fingerprint: string,
  now_ms: number = Date.now(),
): Promise<void> {
  if (typeof account_id !== "string" || account_id.length === 0) {
    throw new Error(
      "risk-service.recordProvisionalFingerprint: account_id must be a non-empty string",
    );
  }
  if (typeof fingerprint !== "string" || fingerprint.length === 0) {
    throw new Error(
      "risk-service.recordProvisionalFingerprint: fingerprint must be a non-empty string",
    );
  }
  const iso = new Date(now_ms).toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_account_risk_signal")
    .upsert(
      {
        account_id,
        provisional_fingerprint: fingerprint,
        fingerprint_last_computed_at: iso,
        updated_at: iso,
      },
      { onConflict: "account_id" },
    );
  if (error) {
    throw new Error(
      `risk-service.recordProvisionalFingerprint: ${error.message}`,
    );
  }
}

/**
 * Clear the provisional fingerprint on claim. Per sealed §7A:
 *   "Cleared to NULL on claim."
 *
 * Idempotent · does nothing if the row does not exist or the
 * fingerprint is already NULL. Never throws for missing rows.
 * Sets updated_at so observability can distinguish a just-cleared
 * row from an older one.
 */
export async function clearProvisionalFingerprintOnClaim(
  account_id: string,
  now_ms: number = Date.now(),
): Promise<void> {
  if (typeof account_id !== "string" || account_id.length === 0) {
    throw new Error(
      "risk-service.clearProvisionalFingerprintOnClaim: account_id must be a non-empty string",
    );
  }
  const iso = new Date(now_ms).toISOString();
  const { error } = await nexSupabaseAdmin
    .from("nex_account_risk_signal")
    .update({
      provisional_fingerprint: null,
      fingerprint_last_computed_at: null,
      updated_at: iso,
    })
    .eq("account_id", account_id);
  if (error) {
    throw new Error(
      `risk-service.clearProvisionalFingerprintOnClaim: ${error.message}`,
    );
  }
}
