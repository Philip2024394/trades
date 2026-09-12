// src/lib/nex/workers/contract.ts
//
// Founder Path B · Phase B1 · Reusable capability workers.
//
// One worker × N domains. Each capability worker is a pure function
// over (domain: string, input: <capability-specific>) → output.
// Domain-specific data & schemas are looked up via the shared
// DomainAdapter contract at src/lib/nex/live-chat-completion/contract.ts.
//
// This is Founder assertion 5 in code form:
//   "Same worker can work across thousands of domains."
// Web research verdict: PARTIALLY SUPPORTED (architecturally universal
// per LangGraph/CrewAI/Bedrock/Vertex; scale ceiling UNKNOWN).
// Observatory Brain measures per-domain accuracy so the ceiling
// becomes measurable rather than assumed.
//
// The workers here are STATELESS wrappers — persistence still lives
// in the domain-specific stores. This module standardises the
// interface so any future domain can plug in without a new worker.

// ═══════════════════════════════════════════════════════════════════
// Shared worker envelope
// ═══════════════════════════════════════════════════════════════════

export interface WorkerContext {
  domain: string;                     // "accommodation" · "food" · "transport" · …
  language?: "en" | "id";
  request_id?: string;                // observability trace
  signal?: AbortSignal;
}

export interface WorkerResult<T> {
  ok: boolean;
  domain: string;
  worker: string;                     // "discovery" · "extraction" · …
  data?: T;
  error?: { code: string; message: string };
  stage_ms: number;
}

// ═══════════════════════════════════════════════════════════════════
// Capability worker signatures
// ═══════════════════════════════════════════════════════════════════

/** Discovery: what facts should we surface for this query in this domain? */
export interface DiscoveryWorkerInput { query: string; entity_ref?: string | null; top_k?: number }
export interface DiscoveryWorkerOutput { candidate_intents: readonly { intent_slug: string; score: number }[] }

/** Extraction: pull structured facts from a raw source (page / doc / image). */
export interface ExtractionWorkerInput { source_kind: "page" | "doc" | "image" | "file"; raw_text?: string; base64?: string; hint?: string }
export interface ExtractionWorkerOutput { facts: readonly { claim_text: string; category: string; confidence: number }[] }

/** Normalisation: canonicalise a natural-language input into a domain schema. */
export interface NormalisationWorkerInput { text: string }
export interface NormalisationWorkerOutput { canonical: string; aliases_matched: readonly string[] }

/** Dedup: detect duplicates in a candidate set against the domain corpus. */
export interface DedupWorkerInput { candidates: readonly { key: string; text: string }[] }
export interface DedupWorkerOutput { unique_keys: readonly string[]; duplicate_pairs: readonly { a: string; b: string; score: number }[] }

/** Entity resolution: map free text → canonical entity ref. */
export interface EntityResolutionWorkerInput { free_text: string; candidate_names?: readonly string[] }
export interface EntityResolutionWorkerOutput { entity_ref?: string | null; canonical_name?: string; confidence: number; match_kind: "exact" | "substring" | "trigram" | "none" }

/** Verification: does this fact still pass the Truth Engine? */
export interface VerificationWorkerInput { entity_ref: string; intent_slug: string; value: string | number | boolean | null }
export interface VerificationWorkerOutput { pass: boolean; trust: "canonical_verified" | "evidence_provisional" | "unknown"; is_stale?: boolean; is_conflicting?: boolean; reason?: string }

/** Conflict: detect conflicting sources on the same fact. */
export interface ConflictWorkerInput { entity_ref: string; intent_slug: string }
export interface ConflictWorkerOutput { conflicting: boolean; sources: readonly { source_reference: string; value: string; written_at: string }[] }

/** Gap: identify missing facts for a given entity given a target intent set. */
export interface GapWorkerInput { entity_ref: string; target_intents: readonly string[] }
export interface GapWorkerOutput { missing_intents: readonly string[]; total_target: number }

/** Freshness: how stale is the fact set for a given entity? */
export interface FreshnessWorkerInput { entity_ref: string; max_age_days?: number }
export interface FreshnessWorkerOutput { stale_intent_count: number; oldest_days?: number; needs_refresh: boolean }

/** Index: emit a compact index row for a fact (source of truth stays in Postgres). */
export interface IndexWorkerInput { entity_ref: string; intent_slug: string; text: string }
export interface IndexWorkerOutput { ref_id: string; token_count: number; trigram_count: number }
