// src/lib/nex/master-ai/intelligence-status.ts
//
// NEX Native Intelligence (NI) Doctrine · canonical types
// Founder 2026-09-16 · AUTHORIZE (NI Doctrine integration Phase 2)
//
// Founder rule: NI describes intelligence performed natively inside NEX's own
// systems, rather than delegated to an external LLM or generative AI system.
// This is an architectural concept, not a marketing label. NI must be
// demonstrated by implementation and evidence — never claimed by inheritance
// or naming convention.
//
// This module defines:
//   · Nex1IntelligenceStatus  — the five possible statuses
//   · Nex1IntelligenceMaturity — NI-0 through NI-5 (reasoning-depth axis;
//     ORTHOGONAL to AuthorityTier which is the trust-delegation axis)
//   · Nex1IntelligenceEvidence — one evidence record supporting a claim
//   · Nex1IntelligenceProfile  — the composite claim shape carried by every
//     agent capability profile
//
// Preserves NEX1 No-LLM Hard Rule: nothing here weakens or reinterprets that
// rule. AI_DELEGATED and HYBRID are honest labels for capabilities OUTSIDE
// NEX1 that legitimately delegate reasoning to an LLM. NEX1 itself (per its
// hard rule) must never carry AI_DELEGATED or HYBRID status.

/**
 * Where the reasoning actually happens for a given capability.
 *
 *   NATIVE           — NEX itself performs the operation; deterministic /
 *                      symbolic / rule-based / algorithmic. No LLM involved.
 *   AI_DELEGATED     — NEX sends the problem to an external generative model
 *                      (Claude / GPT / Gemini / etc.). The model does the
 *                      reasoning.
 *   HYBRID           — Some processing is native and another portion is
 *                      AI-delegated. The profile MUST identify which is which.
 *   NOT_IMPLEMENTED  — Capability declared or asked for but not yet built.
 *                      NEX1 must respond with `NI CAPABILITY NOT YET
 *                      IMPLEMENTED` for questions this covers.
 *   UNKNOWN          — Insufficient evidence to classify. Never automatically
 *                      upgrades to NATIVE. Requires human evidence review.
 */
export type Nex1IntelligenceStatus =
  | "NATIVE"
  | "AI_DELEGATED"
  | "HYBRID"
  | "NOT_IMPLEMENTED"
  | "UNKNOWN";

/**
 * Reasoning-depth axis (orthogonal to AuthorityTier which measures trust).
 *
 *   NI-0 · No demonstrated native intelligence for the task.
 *   NI-1 · Deterministic recognition / classification.
 *   NI-2 · Structured native processing (parsing, extraction, transformation).
 *   NI-3 · Evidence-backed native reasoning (verifiable claims from evidence).
 *   NI-4 · Contextual native reasoning (reasoning that changes with context).
 *   NI-5 · Cross-system native reasoning (integrates multiple native systems).
 *
 * Do NOT auto-assign levels. A level MUST be justified by evidence records.
 * If in doubt, use NI-0 and mark status UNKNOWN.
 */
export type Nex1IntelligenceMaturity =
  | "NI-0"
  | "NI-1"
  | "NI-2"
  | "NI-3"
  | "NI-4"
  | "NI-5";

/**
 * One evidence record supporting a claimed capability. Every native
 * capability listed on a profile MUST have at least one evidence record.
 * Missing evidence → the claim is rejected and status stays UNKNOWN.
 */
export interface Nex1IntelligenceEvidence {
  readonly capability: string;                 // e.g. "coding-vocabulary-classification"
  readonly implementation_path: string;        // repo-relative file path
  readonly test_paths: readonly string[];      // proof — repo-relative paths
  readonly test_count: number;                 // integer, not "many"
  readonly version: string;                    // e.g. "v5.0.0-alpha.7"
  readonly last_verified_iso: string;          // when a human confirmed
  readonly scope_positive: readonly string[];  // what it CAN do (specific)
  readonly scope_negative: readonly string[];  // what it explicitly CANNOT do
}

/**
 * One capability delegated to an external generative AI system. Every
 * AI_DELEGATED or HYBRID profile MUST list every delegation site.
 */
export interface Nex1IntelligenceDelegation {
  readonly capability: string;
  readonly provider: string;                   // e.g. "Anthropic Claude Opus 4.7"
  readonly caller_path: string;                // where the call is made
  readonly fallback_present: boolean;          // has non-LLM fallback path
}

/**
 * A capability the agent knows it CANNOT currently perform. Reporting these
 * honestly is the whole point of the NI Doctrine — "NI CAPABILITY NOT YET
 * IMPLEMENTED" is a valid answer.
 */
export interface Nex1IntelligenceGap {
  readonly capability: string;                 // e.g. "source-code-comprehension"
  readonly reason: string;                     // one sentence
  readonly requires_generative?: boolean;      // true when only an LLM could do it
}

/**
 * The composite NI status claim for one agent (or one sub-capability of an
 * agent). Every AgentCapabilityProfile embeds one of these.
 */
export interface Nex1IntelligenceProfile {
  readonly status: Nex1IntelligenceStatus;
  readonly maturity: Nex1IntelligenceMaturity;
  readonly native_capabilities: readonly Nex1IntelligenceEvidence[];
  readonly delegated_capabilities: readonly Nex1IntelligenceDelegation[];
  readonly unsupported_capabilities: readonly Nex1IntelligenceGap[];
  readonly rejected_claims: readonly string[]; // prior doc claims not backed by evidence
  readonly last_audit_iso: string;
  readonly taught_by: "master_ai_engineer";
}

// ── Doctrine invariants (compile-time and runtime) ──────────────────────────

/**
 * The UNKNOWN default — used when a caller registers a profile without
 * explicit intelligence status. Every profile must carry a status, so this
 * exists to be the honest default rather than allowing silent absence.
 */
export const UNKNOWN_INTELLIGENCE_PROFILE: Nex1IntelligenceProfile = Object.freeze({
  status: "UNKNOWN",
  maturity: "NI-0",
  native_capabilities: [],
  delegated_capabilities: [],
  unsupported_capabilities: [],
  rejected_claims: [],
  last_audit_iso: "1970-01-01T00:00:00.000Z", // sentinel: never audited
  taught_by: "master_ai_engineer",
});

/**
 * Validate that a profile's status claim is internally consistent with the
 * capabilities it lists. Returns null if valid, or an explanation string.
 *
 * Rules enforced:
 *   NATIVE           → must have ≥1 native_capabilities, MUST have 0 delegated_capabilities
 *   AI_DELEGATED     → must have ≥1 delegated_capabilities, MUST have 0 native_capabilities
 *   HYBRID           → must have ≥1 native_capabilities AND ≥1 delegated_capabilities
 *   NOT_IMPLEMENTED  → must have ≥1 unsupported_capabilities, MUST have 0 native + 0 delegated
 *   UNKNOWN          → any shape acceptable (this is the "we don't know yet" state)
 *   Every evidence must have ≥1 test_paths OR test_count > 0.
 */
export function validateIntelligenceProfile(profile: Nex1IntelligenceProfile): string | null {
  const nCount = profile.native_capabilities.length;
  const dCount = profile.delegated_capabilities.length;
  const uCount = profile.unsupported_capabilities.length;

  switch (profile.status) {
    case "NATIVE":
      if (nCount === 0)
        return "NATIVE status requires at least one native_capabilities entry";
      if (dCount > 0)
        return "NATIVE status forbids delegated_capabilities (use HYBRID)";
      break;
    case "AI_DELEGATED":
      if (dCount === 0)
        return "AI_DELEGATED status requires at least one delegated_capabilities entry";
      if (nCount > 0)
        return "AI_DELEGATED status forbids native_capabilities (use HYBRID)";
      break;
    case "HYBRID":
      if (nCount === 0 || dCount === 0)
        return "HYBRID status requires BOTH native and delegated capabilities";
      break;
    case "NOT_IMPLEMENTED":
      if (uCount === 0)
        return "NOT_IMPLEMENTED status requires at least one unsupported_capabilities entry";
      if (nCount > 0 || dCount > 0)
        return "NOT_IMPLEMENTED status forbids claimed capabilities";
      break;
    case "UNKNOWN":
      // Any shape valid — this is the honest 'we haven't verified yet' state.
      break;
  }

  for (const ev of profile.native_capabilities) {
    if (ev.test_count === 0 && ev.test_paths.length === 0) {
      return `native capability '${ev.capability}' has no test evidence (test_count=0 AND test_paths=[])`;
    }
  }

  return null;
}

/**
 * Guard: does this profile REALLY back its status claim with evidence, or
 * is it just an assertion? Used by tests to prevent silent status inflation.
 */
export function hasSufficientEvidence(profile: Nex1IntelligenceProfile): boolean {
  return validateIntelligenceProfile(profile) === null;
}

/**
 * Founder-locked rule: an LLM-based function cannot be hidden behind a
 * different name and classified as native. Callers CAN mark themselves
 * AI_DELEGATED for legitimate LLM use — but they cannot mark themselves
 * NATIVE while carrying delegation. This function detects the violation.
 *
 * Returns null if compliant, or a rejection reason.
 */
export function detectHiddenLLMClaim(profile: Nex1IntelligenceProfile): string | null {
  if (profile.status === "NATIVE" && profile.delegated_capabilities.length > 0) {
    return "hidden_llm_claim: profile claims NATIVE but lists delegated_capabilities — use HYBRID or AI_DELEGATED";
  }
  return null;
}
