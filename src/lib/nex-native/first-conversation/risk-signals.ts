// src/lib/nex-native/first-conversation/risk-signals.ts
//
// Bridge 99 · Stage 5b · risk signal extractor + velocity queries.
// -----------------------------------------------------------------------------
// Sealed doctrine reference:
//   docs/doctrine/bridge-99-first-conversation-principle-plan-2026-09-30.md
//   §8 · Risk service design (RiskInput shape).
//   §7A · Fingerprint is a risk signal, NEVER an identity resolver.
//   Founder-sealed 2026-09-30 · baseline 6566ace3.
//
// This module produces the RiskInput shape consumed by risk-service.ts
// (Stage 5c). It combines:
//
//   · Request-derived signals (message length, session state) · PURE.
//   · Fingerprint-scoped DB velocity queries against
//     nex_account_risk_signal · returns COUNTS ONLY, NEVER account IDs.
//
// Structural boundaries this module MUST NEVER cross:
//
//   1. No function returns an account_id. Every DB read returns a
//      number (a count) or a boolean · never an identifier.
//   2. No writes. This module never inserts, updates, or deletes.
//      Population of nex_account_risk_signal rows lives in
//      risk-service.ts (Stage 5c) via recordProvisionalFingerprint().
//   3. No imports from account-service, session-registry-service,
//      provisional-session, or first-message-orchestrator. The risk
//      subsystem must not become a back-door identity resolver.
//   4. DB reads are scoped to nex_account_risk_signal exclusively.
//      Peer/message/conversation tables are out of scope for this
//      module — cross-table velocity queries would blur boundaries
//      that §7A explicitly protects.
//
// v1 stubs (documented, not concealed):
//
//   · ip_reputation_score → hard-coded 0 in v1. External IP-rep
//     service integration lands in a later bridge.
//   · same_message_hash_repeat_count → hard-coded 0 in v1. Requires
//     a message-hash storage decision that hasn't been made yet.
//     Recording is a Stage 5c/6 concern; querying is a follow-up.
//   · new_conversations_last_hour / _last_day → derived from fingerprint
//     velocity via nex_account_risk_signal. The naming preserves
//     sealed §8's RiskInput shape · the interpretation is "how many
//     provisional accounts sharing this fingerprint have been created
//     recently", which is what §7A permits as a risk signal.
//
// Test discipline: every runtime and structural boundary above is
// covered by the paired test file.

import "server-only";
import { nexSupabaseAdmin } from "../supabase-admin";

// ---------------------------------------------------------------------------
// Session-kind bridging: resolver output → risk-input session_state
// ---------------------------------------------------------------------------

/**
 * The three session states risk-service.ts distinguishes per sealed §8.
 * Mapping from resolver output:
 *   resolver kind "authenticated" → "authenticated"
 *   resolver kind "provisional"   → "provisional-existing"
 *   resolver kind "none"          → "provisional-new"
 */
export type NexSessionState =
  | "authenticated"
  | "provisional-existing"
  | "provisional-new";

/**
 * Bridge from resolver kind to session_state for the risk input. Pure.
 */
export function sessionStateFromResolverKind(
  kind: "authenticated" | "provisional" | "none",
): NexSessionState {
  switch (kind) {
    case "authenticated":
      return "authenticated";
    case "provisional":
      return "provisional-existing";
    case "none":
      return "provisional-new";
  }
}

// ---------------------------------------------------------------------------
// Request-derived signals (pure)
// ---------------------------------------------------------------------------

export interface RequestDerivedSignalsInput {
  message_body: string;
  session_kind: "authenticated" | "provisional" | "none";
}

export interface RequestDerivedSignals {
  message_length: number;
  session_state: NexSessionState;
}

/**
 * Pure extraction of request-scoped signals. No DB, no I/O.
 */
export function extractRequestSignals(
  input: RequestDerivedSignalsInput,
): RequestDerivedSignals {
  if (typeof input.message_body !== "string") {
    throw new Error("risk-signals.extractRequestSignals: message_body must be a string");
  }
  return {
    message_length: input.message_body.length,
    session_state: sessionStateFromResolverKind(input.session_kind),
  };
}

// ---------------------------------------------------------------------------
// DB velocity · returns COUNT only, never identities
// ---------------------------------------------------------------------------

/**
 * Count provisional accounts sharing the given fingerprint whose
 * risk-signal row was created at or after `sinceMs`.
 *
 * Doctrinal boundaries:
 *   · Returns a number. Never an account_id, never a set of ids.
 *   · Reads only nex_account_risk_signal.
 *   · Never joins to nex_account, nex_peer_conversation, or any
 *     identity-carrying table.
 */
export async function countProvisionalsWithFingerprintSince(
  fingerprint: string,
  sinceMs: number,
): Promise<number> {
  if (typeof fingerprint !== "string" || fingerprint.length === 0) {
    throw new Error(
      "risk-signals.countProvisionalsWithFingerprintSince: fingerprint must be a non-empty string",
    );
  }
  const sinceIso = new Date(sinceMs).toISOString();
  const { count, error } = await nexSupabaseAdmin
    .from("nex_account_risk_signal")
    .select("account_id", { count: "exact", head: true })
    .eq("provisional_fingerprint", fingerprint)
    .gte("created_at", sinceIso);
  if (error) {
    throw new Error(
      `risk-signals.countProvisionalsWithFingerprintSince: ${error.message}`,
    );
  }
  return count ?? 0;
}

// ---------------------------------------------------------------------------
// Composed RiskInput builder (sealed §8 shape)
// ---------------------------------------------------------------------------

/** Input for buildRiskInput · matches the fields risk-service needs. */
export interface BuildRiskInputInput {
  message_body: string;
  session_kind: "authenticated" | "provisional" | "none";
  /**
   * Salted fingerprint hash produced by computeProvisionalFingerprint
   * (Stage 5a). May be null for scenarios where a fingerprint cannot
   * be derived (e.g. authenticated Supabase session · no need for a
   * fingerprint since identity is established by the JWT). When null,
   * fingerprint-scoped velocity counts are returned as 0.
   */
  fingerprint: string | null;
  owner_business_id: string;
  owner_bisnis_tier: "gratis" | "bisnis";
  /** Injectable for tests. Defaults to Date.now(). */
  now_ms?: number;
}

/**
 * Sealed §8 RiskInput shape. Consumed by assessRisk in risk-service.ts.
 * Notes:
 *   · ip_reputation_score: v1 stub, always 0.
 *   · same_message_hash_repeat_count: v1 stub, always 0.
 *   · new_conversations_last_hour / _last_day: derived from fingerprint
 *     velocity per §7A framing.
 *   · owner_overrides: v1 does not populate owner-level overrides;
 *     assessRisk uses global defaults. Field intentionally absent.
 */
export interface RiskInput {
  message_length: number;
  session_state: NexSessionState;
  ip_reputation_score: number;
  new_conversations_last_hour: number;
  new_conversations_last_day: number;
  same_message_hash_repeat_count: number;
  owner_business_id: string;
  owner_bisnis_tier: "gratis" | "bisnis";
}

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

/**
 * Compose the sealed §8 RiskInput from request context. Runs the two
 * fingerprint-scoped velocity queries (1h, 24h) in parallel if a
 * fingerprint is present. Never resolves identity.
 */
export async function buildRiskInput(
  input: BuildRiskInputInput,
): Promise<RiskInput> {
  const now = input.now_ms ?? Date.now();
  const req = extractRequestSignals({
    message_body: input.message_body,
    session_kind: input.session_kind,
  });

  let last_hour = 0;
  let last_day = 0;
  if (input.fingerprint) {
    // Fire both queries in parallel · counts only.
    const [h, d] = await Promise.all([
      countProvisionalsWithFingerprintSince(
        input.fingerprint,
        now - MS_PER_HOUR,
      ),
      countProvisionalsWithFingerprintSince(
        input.fingerprint,
        now - MS_PER_DAY,
      ),
    ]);
    last_hour = h;
    last_day = d;
  }

  return {
    message_length: req.message_length,
    session_state: req.session_state,
    ip_reputation_score: 0, // v1 stub
    new_conversations_last_hour: last_hour,
    new_conversations_last_day: last_day,
    same_message_hash_repeat_count: 0, // v1 stub
    owner_business_id: input.owner_business_id,
    owner_bisnis_tier: input.owner_bisnis_tier,
  };
}
