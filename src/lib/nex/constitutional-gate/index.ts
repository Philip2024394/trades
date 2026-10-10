// src/lib/nex/constitutional-gate/index.ts
//
// NEX CONSTITUTIONAL GATE · Wave R1 · Runtime Containment · 2026-09-20.
//
// FOUNDER-AUTHORISED · Zero-Third-Party-AI Rule
// ================================================================
// The NEX runtime prohibits third-party AI services. This module is
// the enforcement point. Every third-party AI entry point across the
// codebase (Anthropic, OpenAI, Groq, Google Gemini, etc.) calls
// `blockThirdPartyAI(provider, endpoint)` BEFORE any network access.
// The function records the blocked attempt for governance visibility
// and returns void. Callers then return their pre-existing "no
// capability" value (null for text/vision/embeddings, error event
// for streaming generators).
//
// This is Wave R1 of the 5-wave migration/deprecation strategy:
//   R1 · Runtime block (THIS WAVE)
//   R2 · Chat route deprecation
//   R3 · UI migration
//   R4 · Composer migration
//   R5 · Wrapper deletion
//
// R1 does NOT delete any file. Restoration requires explicit founder
// governance action AND a new architecture decision. Do NOT bypass by
// editing this guard or the entry-point call sites.
//
// The rule applies to RUNTIME NEX PRODUCT intelligence. Development-
// time engineering tools (Claude Code sessions) are out of scope of
// the rule per the golden-rule carve-out.

export type BlockedProvider =
  | "anthropic"
  | "openai"
  | "groq"
  | "gemini"
  | "google-generativeai"
  | "perplexity"
  | "huggingface"
  | "grok"
  | "deepseek"
  | "other";

export type BlockedEndpoint = string;

interface BlockedAttempt {
  readonly provider: BlockedProvider;
  readonly endpoint: BlockedEndpoint;
  readonly recorded_at_iso: string;
}

// Module-level in-memory counter. Persists across calls within a
// single process; resets on restart. Useful for observability +
// acceptance verification (a test can assert the counter incremented
// to prove the gate fired without the request reaching the network).
const BLOCKED_ATTEMPTS: BlockedAttempt[] = [];
let BLOCKED_ATTEMPT_COUNT = 0;

/** Record a blocked attempt. This is the single entry point every
 *  third-party AI wrapper must call BEFORE any network access. The
 *  function does NOT throw · returns void · exists purely to make
 *  the block auditable + verifiable at runtime.
 *
 *  Callers then return their pre-existing "no capability" value:
 *    · text-completion callers                → return null
 *    · vision / embedding callers             → return null
 *    · streaming generators                   → yield error event + return
 *    · JSON callers                           → return null
 *
 *  The doctrine: block the third-party AI, expose the resulting
 *  capability gap honestly. Do not mask the gap with a fabricated
 *  fallback value. */
export function blockThirdPartyAI(provider: BlockedProvider, endpoint: BlockedEndpoint): void {
  BLOCKED_ATTEMPTS.push({
    provider,
    endpoint,
    recorded_at_iso: new Date().toISOString(),
  });
  BLOCKED_ATTEMPT_COUNT++;
  // Only keep the most recent 1000 attempts to bound memory. This is
  // a stopgap observability signal — production would ship to a real
  // sink (Prom / OpenTelemetry / etc.) via a future wave.
  if (BLOCKED_ATTEMPTS.length > 1000) BLOCKED_ATTEMPTS.splice(0, BLOCKED_ATTEMPTS.length - 1000);
}

/** Read-only accessor for observability + acceptance tests. */
export function getBlockedAttempts(): readonly BlockedAttempt[] {
  return BLOCKED_ATTEMPTS.slice();
}

/** Reset counter · test-scaffolding only · governance-controlled. */
export function resetBlockedAttempts(): void {
  BLOCKED_ATTEMPTS.length = 0;
  BLOCKED_ATTEMPT_COUNT = 0;
}

/** Total count across all providers · for lightweight aggregate
 *  observability without walking the full attempt list. */
export function getBlockedAttemptCount(): number {
  return BLOCKED_ATTEMPT_COUNT;
}

/** Standard marker string embedded in fallback receipts / traces so
 *  UI + downstream code can recognise a constitutional-gate refusal
 *  and render an honest capability-gap state rather than treating it
 *  as an internal error. */
export const CONSTITUTIONAL_GATE_MARKER = "constitutional_gate_blocked_third_party_ai";
