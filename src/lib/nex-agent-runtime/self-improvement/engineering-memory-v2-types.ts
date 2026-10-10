// §36-E-2 · WAVE-E2 · 2026-09-14 · engineering-memory-v2
// NEX bounded infrastructure · engineering-memory-v2 types · 2026-09-14

import type { HypothesisMeasurementRecord } from "./improvement-hypothesis-measurement-types";

// ── Locked epistemic-status taxonomy (exhaustive · 6 · founder-specified) ──

export type EpistemicStatusV2 =
  | "FACT"
  | "OBSERVATION"
  | "INFERENCE"
  | "HYPOTHESIS"
  | "LESSON"
  | "REJECTED";

export const APPROVED_EPISTEMIC_STATUSES_V2: readonly EpistemicStatusV2[] = Object.freeze([
  "FACT", "OBSERVATION", "INFERENCE", "HYPOTHESIS", "LESSON", "REJECTED",
]);

// ── Locked lesson kinds (exhaustive · 7 · extends I2) ──────────────────

export type LessonKindV2 =
  | "failure_pattern"
  | "successful_solution_pattern"
  | "rejected_approach"
  | "architectural_constraint"
  | "regression_lesson"
  | "debugging_lesson"
  | "general_principle";

export const APPROVED_LESSON_KINDS_V2: readonly LessonKindV2[] = Object.freeze([
  "failure_pattern", "successful_solution_pattern", "rejected_approach",
  "architectural_constraint", "regression_lesson", "debugging_lesson",
  "general_principle",
]);

// ── Locked promotion states (parallel to status · tracks reviewable state) ──

export type PromotionState = "PROMOTED" | "SUPERSEDED" | "NEEDS_REVIEW" | "AUTHORITATIVE" | "PENDING";

// ── Candidate + records ────────────────────────────────────────────────

export interface CandidateMemoryV2 {
  readonly kind: LessonKindV2;
  readonly proposed_status: EpistemicStatusV2;
  readonly summary: string;
  readonly evidence_citation: string;                  // must be non-empty
  readonly evidence_sha256: string;                    // must be 64-hex
  readonly mission_id: string | null;
  readonly source: string;                              // e.g. "S1 gap note" · "human-authored" · "I1 hypothesis"
  readonly subsystem: string | null;                    // e.g. "self-diagnostics" · "programming-mission"
  readonly paired_hypothesis_id: string | null;
  readonly supersedes_lesson_id: string | null;
  readonly contradicts_lesson_id: string | null;
}

export interface EngineeringMemoryV2Lesson {
  readonly lesson_id: string;
  readonly kind: LessonKindV2;
  readonly status: EpistemicStatusV2;
  readonly promotion_state: PromotionState;
  readonly summary: string;
  readonly evidence_citation: string;
  readonly evidence_sha256: string;
  readonly mission_id: string | null;
  readonly source: string;
  readonly subsystem: string | null;
  readonly paired_hypothesis_id: string | null;
  readonly supersedes_lesson_id: string | null;
  readonly contradicts_lesson_id: string | null;
  readonly recorded_at: string;
  readonly invocation_count: number;   // deterministic counter · increments on query hits
}

export interface EngineeringMemoryV2Book {
  readonly book_id: string;
  readonly schema_version: "ecc-memory-v2";
  readonly lessons: readonly EngineeringMemoryV2Lesson[];
  readonly book_sha256: string;
}

// ── Request ────────────────────────────────────────────────────────────

export interface EngineeringMemoryV2Request {
  readonly candidate_memories: readonly CandidateMemoryV2[];
  readonly hypothesis_measurements: readonly HypothesisMeasurementRecord[];
  readonly prior_book?: EngineeringMemoryV2Book;
  readonly clock?: () => Date;
}

// ── Rejected candidates ────────────────────────────────────────────────

export type RejectionReasonV2 =
  | "missing_evidence_citation"
  | "missing_evidence_sha256"
  | "invalid_evidence_sha256_format"
  | "promotion_to_fact_requires_paired_measurement"
  | "promotion_to_lesson_requires_paired_measurement"
  | "observation_cannot_promote_directly_to_fact"
  | "prohibited_string_content"
  | "duplicate_of_prior_lesson"
  | "unknown_lesson_kind"
  | "unknown_epistemic_status"
  | "supersedes_target_not_found"
  | "contradicts_target_not_found";

export interface RejectedCandidateV2 {
  readonly kind: LessonKindV2;
  readonly proposed_status: EpistemicStatusV2;
  readonly summary: string;
  readonly rejection_reason: RejectionReasonV2;
  readonly rejection_summary: string;
}

// ── Query API ──────────────────────────────────────────────────────────

export interface MemoryQueryFilter {
  readonly kind?: LessonKindV2;
  readonly status?: EpistemicStatusV2;
  readonly subsystem?: string;
  readonly limit?: number;
}

export interface MemoryQueryResult {
  readonly filter: MemoryQueryFilter;
  readonly matched_lesson_ids: readonly string[];
  readonly total_matches: number;
  readonly truncated_by_limit: boolean;
}

// ── Output ─────────────────────────────────────────────────────────────

export interface EngineeringMemoryV2Success {
  readonly ok: true;
  readonly assessed_at: string;
  readonly book: EngineeringMemoryV2Book;
  readonly rejected_candidates: readonly RejectedCandidateV2[];
}

// ── Refusal codes (exhaustive · 7) ─────────────────────────────────────

export type EngineeringMemoryV2RefusalCode =
  | "EMV2_INVALID_REQUEST"
  | "EMV2_INVALID_CANDIDATE"
  | "EMV2_INVALID_HYPOTHESIS_MEASUREMENTS"
  | "EMV2_INVALID_PRIOR_BOOK"
  | "EMV2_BOOK_SHA_MISMATCH"
  | "EMV2_OUTPUT_TOO_LARGE"
  | "EMV2_QUERY_INVALID";

export interface EngineeringMemoryV2Failure {
  readonly ok: false;
  readonly refusal_code: EngineeringMemoryV2RefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type EngineeringMemoryV2Result = EngineeringMemoryV2Success | EngineeringMemoryV2Failure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const EMV2_MAX_OUTPUT_BYTES = 256 * 1024;
export const EMV2_MAX_CANDIDATES = 512;
export const EMV2_MAX_SUMMARY_LENGTH = 512;
export const EMV2_MAX_CITATION_LENGTH = 512;

export const EMV2_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0", "eval(", "Function(", "new Function", "child_process",
  "__proto__", "constructor.prototype", "<script", "</script",
]);
