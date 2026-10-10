// §36-I-2 · WAVE-I2 · 2026-09-14 · engineering-memory

import type { HypothesisMeasurementRecord, ImprovementHypothesis } from "./improvement-hypothesis-measurement-types";

// ── Locked epistemic-status taxonomy (exhaustive · 4) ──────────────────

export type EpistemicStatus = "FACT" | "INFERENCE" | "HYPOTHESIS" | "REJECTED_IDEA";

export const APPROVED_EPISTEMIC_STATUSES: readonly EpistemicStatus[] = Object.freeze([
  "FACT",
  "INFERENCE",
  "HYPOTHESIS",
  "REJECTED_IDEA",
]);

// ── Locked lesson kinds (exhaustive · 6) ───────────────────────────────

export type LessonKind =
  | "failure_pattern"
  | "successful_solution_pattern"
  | "rejected_approach"
  | "architectural_constraint"
  | "regression_lesson"
  | "debugging_lesson";

export const APPROVED_LESSON_KINDS: readonly LessonKind[] = Object.freeze([
  "failure_pattern",
  "successful_solution_pattern",
  "rejected_approach",
  "architectural_constraint",
  "regression_lesson",
  "debugging_lesson",
]);

// ── Request ────────────────────────────────────────────────────────────

/** Input record supplied by the caller — never fabricated by the primitive. */
export interface CandidateLesson {
  readonly kind: LessonKind;
  readonly proposed_status: EpistemicStatus;
  readonly summary: string;
  readonly evidence_citation: string;   // MUST be non-empty
  readonly wave_slug: string | null;
  readonly paired_hypothesis_id: string | null;  // if promoting from HYPOTHESIS to FACT · MUST reference an I1 hypothesis with outcome=improvement_measured
}

export interface EngineeringMemoryRequest {
  readonly candidate_lessons: readonly CandidateLesson[];
  readonly hypothesis_measurements: readonly HypothesisMeasurementRecord[];
  readonly hypotheses: readonly ImprovementHypothesis[];
  readonly prior_book?: EngineeringMemoryBook;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface EngineeringLesson {
  readonly lesson_id: string;
  readonly kind: LessonKind;
  readonly status: EpistemicStatus;
  readonly summary: string;
  readonly evidence_citation: string;
  readonly wave_slug: string | null;
  readonly paired_hypothesis_id: string | null;
  readonly recorded_at: string;
  readonly promotion_history: readonly PromotionEvent[];
}

export interface PromotionEvent {
  readonly from_status: EpistemicStatus | null;   // null = initial record
  readonly to_status: EpistemicStatus;
  readonly at: string;
  readonly justification: string;
}

/** The stored book of engineering lessons. */
export interface EngineeringMemoryBook {
  readonly book_id: string;
  readonly lessons: readonly EngineeringLesson[];
  readonly book_sha256: string;
}

export interface EngineeringMemorySuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly book: EngineeringMemoryBook;
  readonly rejected_candidates: readonly RejectedCandidate[];
}

export interface RejectedCandidate {
  readonly kind: LessonKind;
  readonly proposed_status: EpistemicStatus;
  readonly summary: string;
  readonly rejection_reason: RejectionReason;
  readonly rejection_summary: string;
}

export type RejectionReason =
  | "missing_evidence_citation"
  | "promotion_to_fact_requires_paired_improvement_measured_hypothesis"
  | "prohibited_string_content"
  | "duplicate_of_prior_lesson"
  | "unknown_lesson_kind"
  | "unknown_epistemic_status";

// ── Refusal codes (exhaustive · 6) ─────────────────────────────────────

export type EngineeringMemoryRefusalCode =
  | "I2_INVALID_REQUEST"
  | "I2_INVALID_CANDIDATE_LESSON"
  | "I2_INVALID_HYPOTHESIS_MEASUREMENTS"
  | "I2_INVALID_HYPOTHESES"
  | "I2_INVALID_PRIOR_BOOK"
  | "I2_OUTPUT_TOO_LARGE";

export interface EngineeringMemoryFailure {
  readonly ok: false;
  readonly refusal_code: EngineeringMemoryRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type EngineeringMemoryResult = EngineeringMemorySuccess | EngineeringMemoryFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const I2_MAX_OUTPUT_BYTES = 256 * 1024;
export const I2_MAX_LESSONS = 512;
export const I2_MAX_SUMMARY_LENGTH = 512;
export const I2_MAX_CITATION_LENGTH = 512;

export const I2_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
  "\0",
  "eval(",
  "Function(",
  "new Function",
  "child_process",
  "__proto__",
  "constructor.prototype",
  "<script",
  "</script",
]);
