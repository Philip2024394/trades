// src/lib/nex/intelligence-storage-grid/accommodation/evidence-claims.ts
//
// NEX Accommodation Agent · Evidence & Claims Discipline (Rule Book v3)
// Founder BEGIN AUTHORIZATION 2026-09-08 · Indonesia Complete Intelligence Mission
//
// Implements:
//   §16 "popular" MUST be evidence-based (no invented popularity score)
//   §17 Beautiful / Scenic / Best claim-source distinction
//        (SOURCE_DESCRIPTION · OBJECTIVE_ATTRIBUTE · USER_REVIEW_SIGNAL ·
//         NEX_INFERENCE · UNKNOWN)
//   §18 Seasonal intelligence (never infer safety or availability from season)
//
// Design principle: this module is the LAST checkpoint before a subjective
// or descriptive claim is persisted. Every subjective claim MUST pass
// `validateClaim()` — attempts to persist unsupported subjective claims
// throw or return an UNKNOWN downgrade.
//
// Zero fabrication paths. Zero silent promotion. Every rule maps to a
// specific §-numbered Founder directive above.

import type { EvidenceLabel, FreshnessState, TrustLayer } from "../types.js";
import type { ClaimSource, SeasonalWindow } from "./activity-taxonomy.js";

// ═══════════════════════════════════════════════════════════════════
// §17 · CLAIM SOURCE (canonical enum · re-exported for convenience)
// ═══════════════════════════════════════════════════════════════════

/** Canonical claim sources. Owned by activity-taxonomy.ts; re-exported here. */
export type { ClaimSource } from "./activity-taxonomy.js";

export const CLAIM_SOURCES: readonly ClaimSource[] = Object.freeze([
  "SOURCE_DESCRIPTION",
  "OBJECTIVE_ATTRIBUTE",
  "USER_REVIEW_SIGNAL",
  "NEX_INFERENCE",
  "UNKNOWN",
]);

/**
 * Machine-readable ranking of claim sources by strength. Higher = stronger.
 * The composer uses this to decide which of two conflicting claims to prefer.
 *
 * OBJECTIVE_ATTRIBUTE outranks all others because it is measurable
 * (distance · elevation · number of rooms · confirmed price). UNKNOWN is
 * strictly lowest and should NEVER be surfaced as a positive claim.
 */
export const CLAIM_SOURCE_RANK: Readonly<Record<ClaimSource, number>> = Object.freeze({
  OBJECTIVE_ATTRIBUTE: 5,
  USER_REVIEW_SIGNAL: 4,
  SOURCE_DESCRIPTION: 3,
  NEX_INFERENCE: 2,
  UNKNOWN: 0,
});

// ═══════════════════════════════════════════════════════════════════
// §16 · POPULARITY (must be evidence-based)
// ═══════════════════════════════════════════════════════════════════

/**
 * Popularity tokens NEX is ALLOWED to use in output. Every use must be
 * backed by a `PopularityEvidence` record. Any other phrasing (e.g. "most
 * famous", "top pick", "must-see") is BANNED at composer output because
 * they carry semantic weight without a corresponding evidence contract.
 */
export type PopularityToken =
  | "popular"
  | "well_known"
  | "recommended"
  | "trending";

export const POPULARITY_TOKENS: readonly PopularityToken[] = Object.freeze([
  "popular",
  "well_known",
  "recommended",
  "trending",
]);

/**
 * Evidence supporting a popularity token. AT LEAST ONE signal MUST be
 * present with `count >= min_count` for the claim to pass validation.
 *
 * Popularity is NEVER inferred from search rank alone (§16). A source
 * must have made an explicit statement OR a large enough user-review
 * sample must exist.
 */
export interface PopularityEvidence {
  token: PopularityToken;
  signals: readonly PopularitySignal[];
  computed_at: string;                    // ISO 8601
  window_days: number;                    // observation window
  min_count_for_claim: number;            // enforced by validator
  claim_source: ClaimSource;              // never UNKNOWN when claim is persisted
  source_ref: string | null;              // required when claim is persisted
}

export interface PopularitySignal {
  kind:
    | "SOURCE_STATEMENT"                  // e.g. "Lonely Planet lists this as a top attraction"
    | "REVIEW_VOLUME"                     // aggregated review count (verified source)
    | "REVIEW_RATING"                     // aggregated rating (with sample size)
    | "GOVERNMENT_TOURISM_LIST"           // official tourism authority listing
    | "NEX_INTERNAL_SEARCH_VOLUME";       // NEX-internal search demand (limited use)
  count: number;                          // review count · list rank · search volume
  sample_size: number | null;             // when applicable
  source: string;                         // provider identity
  retrieved_at: string;                   // ISO 8601
}

/**
 * Validate a popularity claim. Returns:
 *   { ok: true }                          - claim persistable
 *   { ok: false, downgrade_to: "UNKNOWN", reason } - claim must be downgraded/rejected
 *
 * NEX_INTERNAL_SEARCH_VOLUME alone is NOT sufficient (would create a
 * self-referential loop — popular because we searched for it).
 */
export function validatePopularityClaim(evidence: PopularityEvidence): { ok: true } | { ok: false; downgrade_to: "UNKNOWN"; reason: string } {
  if (!POPULARITY_TOKENS.includes(evidence.token)) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: `unknown popularity token "${evidence.token}"` };
  }
  if (!evidence.signals || evidence.signals.length === 0) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "no signals" };
  }
  const externalSignals = evidence.signals.filter((s) => s.kind !== "NEX_INTERNAL_SEARCH_VOLUME");
  if (externalSignals.length === 0) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "only NEX-internal search volume is not sufficient" };
  }
  const totalCount = externalSignals.reduce((acc, s) => acc + (Number.isFinite(s.count) ? s.count : 0), 0);
  if (totalCount < evidence.min_count_for_claim) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: `evidence count ${totalCount} below min_count ${evidence.min_count_for_claim}` };
  }
  if (evidence.claim_source === "UNKNOWN") {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "claim_source cannot be UNKNOWN when persisting a claim" };
  }
  if (evidence.claim_source !== "OBJECTIVE_ATTRIBUTE" && (!evidence.source_ref || evidence.source_ref.trim() === "")) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "source_ref required for non-objective popularity claims" };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// §17 · SUBJECTIVE ATTRIBUTES (beautiful · scenic · best etc.)
// ═══════════════════════════════════════════════════════════════════

/**
 * Subjective attributes NEX is allowed to attach to a place. Each attribute
 * carries its ClaimSource — the same attribute may appear multiple times
 * with different sources ("tourism board says scenic" vs "user reviews say
 * scenic"). NEX never asserts subjective attributes from its own inference
 * without labelling the claim NEX_INFERENCE.
 */
export type SubjectiveAttribute =
  | "beautiful"
  | "scenic"
  | "peaceful"
  | "romantic"
  | "family_friendly"
  | "adventurous"
  | "authentic"
  | "iconic"
  | "hidden_gem"
  | "best_in_class";

export const SUBJECTIVE_ATTRIBUTES: readonly SubjectiveAttribute[] = Object.freeze([
  "beautiful",
  "scenic",
  "peaceful",
  "romantic",
  "family_friendly",
  "adventurous",
  "authentic",
  "iconic",
  "hidden_gem",
  "best_in_class",
]);

export interface SubjectiveClaim {
  attribute: SubjectiveAttribute;
  claim_source: ClaimSource;
  source_ref: string | null;
  source_quote: string | null;            // verbatim source text when applicable
  sample_size: number | null;             // for USER_REVIEW_SIGNAL
  inference_reasoning: string | null;     // required when claim_source = NEX_INFERENCE
  observed_at: string;                    // ISO 8601
}

/**
 * Validate a subjective claim per §17. Rejects unsupported claims by
 * returning a downgrade to UNKNOWN. Rules:
 *
 *  - SOURCE_DESCRIPTION requires source_ref AND source_quote
 *  - USER_REVIEW_SIGNAL requires sample_size >= 5 (small samples not credible)
 *  - NEX_INFERENCE requires inference_reasoning (non-empty)
 *  - OBJECTIVE_ATTRIBUTE is invalid for subjective attributes (they are
 *    definitionally not measurable) — downgrade to UNKNOWN
 *  - UNKNOWN cannot be persisted as a positive claim
 *  - "best_in_class" additionally requires a comparison scope (source_quote
 *    must contain what class + what geography · enforced light by min length)
 */
export function validateSubjectiveClaim(claim: SubjectiveClaim): { ok: true } | { ok: false; downgrade_to: "UNKNOWN"; reason: string } {
  if (!SUBJECTIVE_ATTRIBUTES.includes(claim.attribute)) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: `unknown subjective attribute "${claim.attribute}"` };
  }
  if (claim.claim_source === "UNKNOWN") {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "UNKNOWN cannot be persisted as a positive claim" };
  }
  if (claim.claim_source === "OBJECTIVE_ATTRIBUTE") {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "subjective attributes are not objective — invalid claim_source" };
  }
  if (claim.claim_source === "SOURCE_DESCRIPTION") {
    if (!claim.source_ref || claim.source_ref.trim() === "") {
      return { ok: false, downgrade_to: "UNKNOWN", reason: "SOURCE_DESCRIPTION requires source_ref" };
    }
    if (!claim.source_quote || claim.source_quote.trim() === "") {
      return { ok: false, downgrade_to: "UNKNOWN", reason: "SOURCE_DESCRIPTION requires source_quote" };
    }
  }
  if (claim.claim_source === "USER_REVIEW_SIGNAL") {
    if (!claim.source_ref || claim.source_ref.trim() === "") {
      return { ok: false, downgrade_to: "UNKNOWN", reason: "USER_REVIEW_SIGNAL requires source_ref" };
    }
    if (claim.sample_size === null || claim.sample_size < 5) {
      return { ok: false, downgrade_to: "UNKNOWN", reason: `USER_REVIEW_SIGNAL requires sample_size >= 5 (got ${claim.sample_size ?? "null"})` };
    }
  }
  if (claim.claim_source === "NEX_INFERENCE") {
    if (!claim.inference_reasoning || claim.inference_reasoning.trim() === "") {
      return { ok: false, downgrade_to: "UNKNOWN", reason: "NEX_INFERENCE requires inference_reasoning" };
    }
  }
  if (claim.attribute === "best_in_class") {
    const q = claim.source_quote?.trim() ?? "";
    if (q.length < 20) {
      return { ok: false, downgrade_to: "UNKNOWN", reason: "best_in_class requires comparison scope in source_quote (min 20 chars)" };
    }
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// §18 · SEASONAL WINDOWS (advisory only · never safety inference)
// ═══════════════════════════════════════════════════════════════════

/**
 * Validate a seasonal window before it enters storage. Rules:
 *  - months must be 1..12, unique, non-empty
 *  - claim_source must NOT be UNKNOWN
 *  - source_ref required (safety-adjacent claim per §18)
 *  - NEVER used to infer safety or availability elsewhere in the pipeline
 *    (that's a composer concern; this validator only guards the record)
 */
export function validateSeasonalWindow(w: SeasonalWindow): { ok: true } | { ok: false; downgrade_to: "UNKNOWN"; reason: string } {
  if (!w.months || w.months.length === 0) {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "months required" };
  }
  const seen = new Set<number>();
  for (const m of w.months) {
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { ok: false, downgrade_to: "UNKNOWN", reason: `invalid month ${m}` };
    }
    if (seen.has(m)) {
      return { ok: false, downgrade_to: "UNKNOWN", reason: `duplicate month ${m}` };
    }
    seen.add(m);
  }
  if (w.claim_source === "UNKNOWN") {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "claim_source cannot be UNKNOWN" };
  }
  if (!w.source_ref || w.source_ref.trim() === "") {
    return { ok: false, downgrade_to: "UNKNOWN", reason: "source_ref required (§18 safety-adjacent)" };
  }
  return { ok: true };
}

// ═══════════════════════════════════════════════════════════════════
// §16 · GENERIC CLAIM ENVELOPE + UNKNOWN DOWNGRADE
// ═══════════════════════════════════════════════════════════════════

/**
 * Universal wrapper for any claim about a place. When a claim fails
 * validation, `downgradeToUnknown()` replaces it with an UNKNOWN placeholder
 * that composers know to hide. Never silently discard a failed claim —
 * always record the downgrade so the audit trail is complete.
 */
export interface Claim<T> {
  value: T | null;
  claim_source: ClaimSource;
  source_ref: string | null;
  observed_at: string;
  freshness: FreshnessState;
  trust_layer: TrustLayer;
  evidence_label: EvidenceLabel;
}

export function downgradeToUnknown<T>(claim: Claim<T>, reason: string): Claim<T> & { downgrade_reason: string } {
  return {
    value: null,
    claim_source: "UNKNOWN",
    source_ref: claim.source_ref,          // preserve for audit
    observed_at: claim.observed_at,
    freshness: "UNKNOWN",
    trust_layer: claim.trust_layer,
    evidence_label: "UNKNOWN",
    downgrade_reason: reason,
  };
}

// ═══════════════════════════════════════════════════════════════════
// §16 §17 §18 · ATTRIBUTE-SAFE RENDERING HELPERS
// ═══════════════════════════════════════════════════════════════════

/**
 * Render a popularity claim safely for composer output. Returns null if
 * the claim fails validation — never returns a fabricated phrase.
 */
export function renderPopularityLabel(evidence: PopularityEvidence): string | null {
  const v = validatePopularityClaim(evidence);
  if (!v.ok) return null;
  return evidence.token;
}

/**
 * Render a subjective claim safely. Composer must decide whether to
 * attribute the quote (recommended when SOURCE_DESCRIPTION). Returns null
 * on validation failure.
 */
export function renderSubjectiveClaim(claim: SubjectiveClaim): { label: string; attribution: string | null } | null {
  const v = validateSubjectiveClaim(claim);
  if (!v.ok) return null;
  const attribution =
    claim.claim_source === "SOURCE_DESCRIPTION" ? claim.source_ref :
    claim.claim_source === "USER_REVIEW_SIGNAL" ? `user reviews (n=${claim.sample_size})` :
    claim.claim_source === "NEX_INFERENCE" ? "NEX inference" :
    null;
  return { label: claim.attribute, attribution };
}

// ═══════════════════════════════════════════════════════════════════
// §16 §17 §18 · TEST HELPERS + REGISTRY STATS
// ═══════════════════════════════════════════════════════════════════

export function evidenceRegistryStats(): {
  popularity_tokens: number;
  subjective_attributes: number;
  claim_sources: number;
  claim_source_rank_distinct: boolean;
} {
  const ranks = Object.values(CLAIM_SOURCE_RANK);
  const distinct = new Set(ranks).size === ranks.length;
  return {
    popularity_tokens: POPULARITY_TOKENS.length,
    subjective_attributes: SUBJECTIVE_ATTRIBUTES.length,
    claim_sources: CLAIM_SOURCES.length,
    claim_source_rank_distinct: distinct,
  };
}
