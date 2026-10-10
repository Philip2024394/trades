// §36-S-2 · WAVE-S2 · 2026-09-14 · capability-health-model
//
// Types + refusal codes + locked constants for the capability-health-model
// primitive. See docs/NEX1/SECTION_36_S_2_CAPABILITY_HEALTH_MODEL_AMENDMENT.md
// and docs/NEX1/BUILD_GATES/WAVE-S2-CAPABILITY-HEALTH-MODEL-PLAN.md (v1).
//
// Boundary (verbatim · unamendable):
//   "Wave S2 enables NEX1 to interpret a deterministic S1 evidence record into
//    a structured, evidence-cited, categorical capability-health readout. It
//    does not permit NEX1 to invoke S1, re-collect evidence, read the
//    filesystem, run tests, judge failures, cluster root causes, recommend
//    improvements, invoke any primitive, modify any file, expand its
//    authoring vocabulary, produce numeric strength scores, or infer
//    authority from evidence quality."

import type { EvidenceCollectionSuccess } from "./evidence-collector-types";

// ── Locked health dimensions (exhaustive · 6 · plan v1 §11.1) ──────────

export type HealthDimension =
  | "presence"
  | "baseline_integrity"
  | "acceptance_report_integrity"
  | "test_evidence_visibility"
  | "governance_state"
  | "marker_presence";

export const APPROVED_HEALTH_DIMENSIONS: readonly HealthDimension[] = Object.freeze([
  "presence",
  "baseline_integrity",
  "acceptance_report_integrity",
  "test_evidence_visibility",
  "governance_state",
  "marker_presence",
]);

// ── Locked categorical states (exhaustive · 6) ─────────────────────────
//
// FOUNDER-LOCKED SEMANTIC CONSTRAINT (unamendable):
//   `verified` means "the locked derivation rule passed on the evidence".
//   It NEVER means "the underlying capability is healthy".
//   This distinction is critical for the future 16-domain reassessment.

export type HealthState =
  | "verified"
  | "substantial"
  | "partial"
  | "insufficient_evidence"
  | "absent"
  | "not_applicable";

// ── Request shape ──────────────────────────────────────────────────────

export interface CapabilityHealthRequest {
  readonly s1_record: EvidenceCollectionSuccess;
  readonly clock?: () => Date;
  readonly max_staleness_hours?: number;
  readonly wave_filter?: readonly string[];
  readonly health_dimensions?: readonly HealthDimension[];
}

// ── Output records ─────────────────────────────────────────────────────

export interface EvidenceCitation {
  readonly s1_field: string;
  readonly value_summary: string;
}

export interface DimensionAssessment {
  readonly dimension: HealthDimension;
  readonly state: HealthState;
  readonly citations: readonly EvidenceCitation[];
  readonly gap_note_refs: readonly string[];
}

export interface CapabilityHealthReport {
  readonly wave_slug: string;
  readonly promotion_status_from_s1: "promoted" | "lab_only" | "infrastructure_only" | "plan_only";
  readonly dimensions: readonly DimensionAssessment[];
  readonly strongest_dimensions: readonly HealthDimension[];
  readonly weakest_dimensions: readonly HealthDimension[];
}

export interface CapabilityHealthSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly s1_evidence_sha256_verified: string;
  readonly reports: readonly CapabilityHealthReport[];
  readonly health_sha256: string;
}

// ── Refusal codes (exhaustive · 8 · plan v1 §10) ───────────────────────

export type CapabilityHealthRefusalCode =
  | "EHM_INVALID_REQUEST"
  | "EHM_INVALID_S1_RECORD"
  | "EHM_S1_EVIDENCE_SHA_MISMATCH"
  | "EHM_S1_RECORD_STALE"
  | "EHM_UNKNOWN_HEALTH_DIMENSION"
  | "EHM_WAVE_FILTER_INVALID"
  | "EHM_OUTPUT_TOO_LARGE"
  | "EHM_PROHIBITED_STRING_CONTENT";

export interface CapabilityHealthFailure {
  readonly ok: false;
  readonly refusal_code: CapabilityHealthRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type CapabilityHealthResult = CapabilityHealthSuccess | CapabilityHealthFailure;

// ── Locked bounds (plan v1) ────────────────────────────────────────────

export const EHM_MAX_OUTPUT_BYTES = 128 * 1024;
export const EHM_DEFAULT_MAX_STALENESS_HOURS = 168;
export const EHM_MAX_MAX_STALENESS_HOURS = 8760;
export const EHM_MAX_WAVE_FILTER = 64;

/** Prohibited substrings scanned in strings that come from the request.
 *  Matches S1's defensive posture. */
export const EHM_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
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
