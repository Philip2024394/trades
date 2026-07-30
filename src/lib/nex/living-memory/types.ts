// NEX Living Memory Engine · shared types
//
// This is Phase 1 of the Living Intelligence Architecture v1.0 · Philip 2026-07-30.
// Distinct from src/lib/nex/memory/ (Phase 26 predicate-based memory engine).
//
// The Perfect Memory Object (11 dimensions · Philip 2026-07-30 · locked):
//   Who · What · Why · Emotion · Confidence · Importance · Human Impact ·
//   Origin · Evolution · Permission · Lifecycle
//
// See:
//   docs/nex/living-intelligence-architecture-v1.md
//   supabase/migrations/20260801000000_nex_living_memory_engine.sql
//   supabase/migrations/20260801000100_nex_memories_recall_when.sql
//
// Ship 2 rule (immutable · Philip 2026-07-30):
//   "NEX does not extract memories. NEX earns understanding."

import "server-only";

// ─── Six categories (Philip 2026-07-30 · locked) ─────────────────────────

export type MemoryCategory =
  | "story"       // chapters of someone's life (forever home · renovation · new child)
  | "preference"  // how they choose (likes oak · dislikes chrome)
  | "aspiration"  // who they want to become (wants a home to grow old in)
  | "fear"        // what they want to avoid (worried about cost · safety)
  | "fact"        // useful stable information (has 2 children · Victorian terrace)
  | "context";    // temporary circumstances (currently renovating · about to move)

// ─── Consent (Decision 2 · silent-by-default · ask for high-impact only) ─

export type ConsentStatus =
  | "silent_ok"        // NEX may store silently · does not need to ask
  | "needs_approval"   // high-impact · MUST ask before commit
  | "approved"         // user explicitly approved
  | "pending"          // awaiting user confirmation at next natural moment
  | "rejected";        // user rejected · will not be surfaced

/**
 * Categories that ALWAYS require consent per Philip 2026-07-30:
 *   fears · relationships · emotional wounds · major life events ·
 *   identity-sensitive information.
 *
 * The meaning-extractor sets consent_status = "needs_approval" whenever
 * the extracted memory matches any of these tags. Everything else defaults
 * to silent_ok per Decision 2 ("do not ask permission every time · that
 * kills magic").
 */
export const CONSENT_REQUIRED_TAGS = [
  "fear",
  "relationship",
  "emotional_wound",
  "major_life_event",
  "identity_sensitive",
] as const;

export type ConsentRequiredTag = typeof CONSENT_REQUIRED_TAGS[number];

// ─── Human Impact Score bands (Philip 2026-07-30 · locked) ───────────────
//
// The score is 0-100. The bands give the extractor a mental model:
//
//   0-30   · useful information
//   31-60  · helpful preference
//   61-80  · meaningful personal context
//   81-100 · life-significant memory  ← these produce the "wow" moments

export const HUMAN_IMPACT_BAND = {
  USEFUL_INFO:            { min: 0,  max: 30 },
  HELPFUL_PREFERENCE:     { min: 31, max: 60 },
  MEANINGFUL_CONTEXT:     { min: 61, max: 80 },
  LIFE_SIGNIFICANT:       { min: 81, max: 100 },
} as const;

export function bandFor(score: number): keyof typeof HUMAN_IMPACT_BAND {
  if (score >= 81) return "LIFE_SIGNIFICANT";
  if (score >= 61) return "MEANINGFUL_CONTEXT";
  if (score >= 31) return "HELPFUL_PREFERENCE";
  return "USEFUL_INFO";
}

// ─── User surface (visitor excluded from Living Memory) ──────────────────

export type MemoryUserSurface = "merchant" | "homeowner";

// ─── Memory Candidate (what the extractor produces BEFORE commit) ────────
//
// The extractor emits zero or more candidates per conversation window.
// Most turns produce ZERO candidates (Philip 2026-07-30 · "not every
// message · most messages are disposable"). Only candidates that clear the
// Six-Month Memory Test are committed to hammerex_nex_memories.

export interface MemoryCandidate {
  category: MemoryCategory;

  /** What NEX remembers. Concise, curated (not raw transcript). */
  content: string;

  /** Lock 1 · intellectual "why" this memory became important. */
  meaning_reason: string;

  /**
   * Emotional "why" · distinct from meaning_reason.
   * Optional — not every memory carries emotion, but life-significant
   * ones almost always do (nostalgia · pride · fear · belonging).
   */
  emotional_context?: string;

  /**
   * 0-100 · how sure NEX is the memory is accurate.
   *   90+   = user stated directly
   *   70-89 = strongly implied
   *   50-69 = softly inferred (surface with care)
   *   <50   = don't commit · wait for stronger signal
   */
  confidence: number;

  /**
   * 0-100 · retrieval priority. How often should this be surfaced?
   * Distinct from human_impact_score (life significance).
   */
  importance: number;

  /**
   * Lock 2 · 0-100 · LIFE significance (Philip 2026-07-30 bands).
   * Two memories can both be high-importance for retrieval but only one
   * can be life-changing. This ranks "building first family home" ahead
   * of "likes dark blue" for the recognising-not-remembering moments.
   */
  human_impact_score: number;

  /**
   * Ship 2 rule · "reason to recall" · answers "when would this help
   * NEX serve this person better?" Populated by the extractor. Retrieval
   * uses this hint to decide which memories to surface at each turn.
   * Prevents memory becoming a warehouse.
   */
  recall_when: string;

  /**
   * Consent tags detected during extraction. When any are present,
   * consent_status defaults to "needs_approval" (Decision 2). Everything
   * else is silent_ok.
   */
  consent_tags: ConsentRequiredTag[];

  /**
   * Lock 3 · optional review-after timestamp.
   * NULL = never expires (facts like "has 2 children" don't need review).
   * Set for preferences and aspirations (typically 12-24 months out).
   */
  review_after?: string; // ISO date

  /**
   * The Six-Month Memory Test · STRENGTHENED (Philip 2026-07-30 · Ship 2b review):
   * Final gate before commit. Two possible reactions six months from now:
   *   A: "Wow, you remembered something important."  → survives
   *   B: "Why are you keeping that?"                 → dropped
   * Only A survives. If watched, the candidate is DROPPED regardless of
   * confidence or importance. This one question protects the Soul.
   */
  six_month_test: "helped" | "watched";

  /**
   * Relationship Risk Score · 0-100 · Philip 2026-07-30 Ship 2b refinement.
   *
   * Not all wrong memories cause equal damage:
   *   Low risk (0-30)   = "user likes oak flooring"  → wrong is annoying
   *   Medium risk (31-70) = "user prefers premium"     → wrong is embarrassing
   *   High risk (71-100) = "user is afraid of failure" → wrong damages trust
   *
   * The extractor scores this alongside confidence. High-risk + low-confidence
   * candidates are dropped (memory humility rule). Not yet persisted to DB —
   * used at extraction gating time only. Deferred to future migration.
   */
  relationship_risk_score: number;

  /** Traceability · which turn produced this candidate (for audit). */
  source_message_id?: string;
  source_turn_number?: number;
}

// ─── The full memory row shape (post-commit) ─────────────────────────────

export interface NexMemoryRow {
  id: string;
  user_surface: MemoryUserSurface;
  user_key: string;

  category: MemoryCategory;
  content: string;
  meaning_reason: string | null;
  emotional_context: string | null;

  confidence: number;
  importance: number;
  human_impact_score: number;

  source_conversation_id: string | null;
  source_message_id: string | null;
  source_turn_number: number | null;

  consent_status: ConsentStatus;
  user_visibility: "visible" | "hidden_supporting";

  superseded_by: string | null;
  superseded_reason: string | null;
  superseded_at: string | null;

  confirmed_at: string | null;
  last_surfaced_at: string | null;

  review_after: string | null;
  recall_when: string | null;

  created_at: string;
  updated_at: string;
}

// ─── Helper · does this candidate need consent? ──────────────────────────

export function needsConsent(candidate: MemoryCandidate): boolean {
  return candidate.consent_tags.length > 0
      || candidate.category === "fear"
      || candidate.human_impact_score >= 81;
}

// ─── Helper · should this candidate be committed at all? ─────────────────
//
// Three gates (Philip 2026-07-30 · Ship 2b refinements):
//   1. Six-Month Memory Test must return "helped" (final soul gate).
//   2. Confidence must clear the commit floor (60) so we don't warehouse
//      wild guesses.
//   3. Memory humility rule: high-relationship-risk memories require
//      correspondingly high confidence. A wrong emotional assumption
//      damages trust much more than a wrong preference does.

export function shouldCommit(candidate: MemoryCandidate): boolean {
  // Gate 1 · Six-Month Test (Soul guardrail)
  if (candidate.six_month_test === "watched") return false;

  // Gate 2 · Confidence floor
  if (candidate.confidence < 60) return false;

  // Gate 3 · Memory humility · risk-scaled confidence requirement
  // Higher relationship_risk_score demands higher confidence to commit.
  // A high-risk memory at moderate confidence = drop and wait for stronger signal.
  if (candidate.relationship_risk_score >= 71 && candidate.confidence < 90) return false;
  if (candidate.relationship_risk_score >= 31 && candidate.confidence < 75) return false;

  return true;
}
