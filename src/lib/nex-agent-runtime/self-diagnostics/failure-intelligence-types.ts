// §36-S-3 · WAVE-S3 · 2026-09-14 · failure-intelligence
//
// Types + refusal codes + locked constants for the failure-intelligence primitive.
// See docs/NEX1/BUILD_GATES/WAVE-S3-FAILURE-INTELLIGENCE-PLAN.md (v1).

import type { EvidenceCollectionSuccess } from "./evidence-collector-types";
import type { CapabilityHealthSuccess, HealthDimension } from "./health-model-types";

// ── Locked failure classes (exhaustive · 7) ────────────────────────────

export type FailureClass =
  | "evidence_missing"
  | "pattern_mismatch"
  | "baseline_conflict"
  | "acceptance_report_absent"
  | "governance_state_unknown"
  | "marker_missing"
  | "capability_not_promoted";

export const APPROVED_FAILURE_CLASSES: readonly FailureClass[] = Object.freeze([
  "evidence_missing",
  "pattern_mismatch",
  "baseline_conflict",
  "acceptance_report_absent",
  "governance_state_unknown",
  "marker_missing",
  "capability_not_promoted",
]);

// ── Request ────────────────────────────────────────────────────────────

export interface FailureIntelligenceRequest {
  readonly s1_record: EvidenceCollectionSuccess;
  readonly s2_record: CapabilityHealthSuccess;
  readonly clock?: () => Date;
  readonly wave_filter?: readonly string[];
}

// ── Output records ─────────────────────────────────────────────────────

export interface FailureRecord {
  readonly wave_slug: string;
  readonly failure_class: FailureClass;
  readonly location_s1_field: string;
  readonly location_s2_dimension: HealthDimension | null;
  readonly demonstrated_by_gap_note_keys: readonly string[];
  readonly evidence_summary: string;
  readonly cause_status: "known_from_evidence" | "cause_unknown";
  readonly cause_summary: string | null;
  readonly known_facts: readonly string[];
  readonly unknown_aspects: readonly string[];
}

export interface FailureIntelligenceSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly s1_evidence_sha256_verified: string;
  readonly s2_health_sha256_verified: string;
  readonly failures: readonly FailureRecord[];
  readonly waves_with_no_failures: readonly string[];
  readonly failure_intelligence_sha256: string;
}

// ── Refusal codes (exhaustive · 7) ─────────────────────────────────────

export type FailureIntelligenceRefusalCode =
  | "FI_INVALID_REQUEST"
  | "FI_INVALID_S1_RECORD"
  | "FI_INVALID_S2_RECORD"
  | "FI_S1_S2_SHA_MISMATCH"
  | "FI_UNKNOWN_FAILURE_CLASS"
  | "FI_OUTPUT_TOO_LARGE"
  | "FI_PROHIBITED_STRING_CONTENT";

export interface FailureIntelligenceFailure {
  readonly ok: false;
  readonly refusal_code: FailureIntelligenceRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type FailureIntelligenceResult = FailureIntelligenceSuccess | FailureIntelligenceFailure;

// ── Locked bounds ──────────────────────────────────────────────────────

export const FI_MAX_OUTPUT_BYTES = 128 * 1024;
export const FI_MAX_WAVE_FILTER = 64;

export const FI_PROHIBITED_SUBSTRINGS: readonly string[] = Object.freeze([
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
