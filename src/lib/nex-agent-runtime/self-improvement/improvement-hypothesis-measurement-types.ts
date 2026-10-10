// §36-I-1 · WAVE-I1 · 2026-09-14 · improvement-hypothesis-measurement

import type { EvidenceCollectionSuccess } from "../self-diagnostics/evidence-collector-types";
import type { ImprovementProposal, ImprovementProposalKind } from "../self-diagnostics/improvement-intelligence-types";

// ── Locked hypothesis-outcome states (exhaustive · 6) ──────────────────

export type HypothesisOutcome =
  | "untested"
  | "improvement_measured"
  | "no_change_measured"
  | "regression_measured"
  | "evidence_insufficient"
  | "not_applicable";

// ── Locked measurement dimensions (exhaustive · 5) ─────────────────────

export type MeasurementDimension =
  | "gap_note_count_delta"
  | "failure_class_count_delta"
  | "verified_dimension_count_delta"
  | "improvement_proposal_count_delta"
  | "evidence_sha_stability";

export const APPROVED_MEASUREMENT_DIMENSIONS: readonly MeasurementDimension[] = Object.freeze([
  "gap_note_count_delta",
  "failure_class_count_delta",
  "verified_dimension_count_delta",
  "improvement_proposal_count_delta",
  "evidence_sha_stability",
]);

// ── Request ────────────────────────────────────────────────────────────

export interface ImprovementHypothesisMeasurementRequest {
  readonly s4_proposals: readonly ImprovementProposal[];
  readonly s1_before?: EvidenceCollectionSuccess;
  readonly s1_after?: EvidenceCollectionSuccess;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface ImprovementHypothesis {
  readonly hypothesis_id: string;
  readonly derived_from_proposal_kind: ImprovementProposalKind;
  readonly wave_slug: string;
  readonly observed_weakness_summary: string;
  readonly evidence_citation: string;
  readonly proposed_intervention_summary: string;
  readonly expected_capability_change: "reduce_gap_notes" | "reduce_failure_classes" | "advance_capability_promotion" | "improve_evidence_visibility";
  readonly success_threshold: string;   // deterministic string · e.g. "gap_note_count_delta <= -1"
  readonly failure_condition: string;
  readonly rollback_strategy: string;
}

export interface MeasurementRecord {
  readonly dimension: MeasurementDimension;
  readonly before_value: number | null;
  readonly after_value: number | null;
  readonly delta: number | null;
  readonly categorical_direction: "improved" | "unchanged" | "regressed" | "not_measurable";
  readonly evidence_summary: string;
}

export interface HypothesisMeasurementRecord {
  readonly hypothesis_id: string;
  readonly outcome: HypothesisOutcome;
  readonly measurement_records: readonly MeasurementRecord[];
  readonly outcome_reason_summary: string;
}

export interface ImprovementHypothesisMeasurementSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly s1_before_sha256_verified: string | null;
  readonly s1_after_sha256_verified: string | null;
  readonly hypotheses: readonly ImprovementHypothesis[];
  readonly measurements: readonly HypothesisMeasurementRecord[];
  readonly hypothesis_measurement_sha256: string;
}

// ── Refusal codes (exhaustive · 7) ─────────────────────────────────────

export type ImprovementHypothesisMeasurementRefusalCode =
  | "I1_INVALID_REQUEST"
  | "I1_INVALID_PROPOSAL"
  | "I1_INVALID_S1_BEFORE"
  | "I1_INVALID_S1_AFTER"
  | "I1_MEASUREMENT_WITHOUT_BEFORE_OR_AFTER"
  | "I1_S1_RECORDS_IDENTICAL"
  | "I1_OUTPUT_TOO_LARGE";

export interface ImprovementHypothesisMeasurementFailure {
  readonly ok: false;
  readonly refusal_code: ImprovementHypothesisMeasurementRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type ImprovementHypothesisMeasurementResult = ImprovementHypothesisMeasurementSuccess | ImprovementHypothesisMeasurementFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const I1_MAX_OUTPUT_BYTES = 128 * 1024;
export const I1_MAX_PROPOSALS = 128;
