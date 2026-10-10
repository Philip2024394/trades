// §36-S-4 · WAVE-S4 · 2026-09-14 · improvement-intelligence

import type { EvidenceCollectionSuccess } from "./evidence-collector-types";
import type { CapabilityHealthSuccess } from "./health-model-types";
import type { FailureClass, FailureIntelligenceSuccess } from "./failure-intelligence-types";

// ── Locked proposal kinds (exhaustive · 7) ─────────────────────────────

export type ImprovementProposalKind =
  | "amend_locked_pattern"
  | "add_missing_marker"
  | "author_missing_acceptance_report"
  | "resolve_baseline_conflict"
  | "capture_governance_evidence"
  | "advance_plan_to_execution"
  | "collect_missing_evidence";

export type ProposalConfidence = "high" | "medium" | "low" | "not_derivable";
export type RollbackConsideration = "trivial" | "moderate" | "non_trivial" | "not_applicable";

// ── Locked derivation table (FailureClass → ProposalKind + confidence + rollback) ──

export interface DerivationEntry {
  readonly proposal_kind: ImprovementProposalKind;
  readonly confidence: ProposalConfidence;
  readonly rollback: RollbackConsideration;
  readonly expected_benefit_summary: string;
}

export const FAILURE_CLASS_TO_PROPOSAL: Readonly<Record<FailureClass, DerivationEntry>> = Object.freeze({
  pattern_mismatch: {
    proposal_kind: "amend_locked_pattern",
    confidence: "high",
    rollback: "trivial",
    expected_benefit_summary: "amend locked pattern so it matches real-world evidence phrasing (cause is known from S3 evidence)",
  },
  marker_missing: {
    proposal_kind: "add_missing_marker",
    confidence: "medium",
    rollback: "trivial",
    expected_benefit_summary: "add the wave grep marker to expected authorised paths",
  },
  acceptance_report_absent: {
    proposal_kind: "author_missing_acceptance_report",
    confidence: "medium",
    rollback: "trivial",
    expected_benefit_summary: "produce the missing acceptance report at the registry-declared path",
  },
  baseline_conflict: {
    proposal_kind: "resolve_baseline_conflict",
    confidence: "low",
    rollback: "moderate",
    expected_benefit_summary: "reconcile conflicting baseline SHA declarations (S3 could not determine root cause)",
  },
  governance_state_unknown: {
    proposal_kind: "capture_governance_evidence",
    confidence: "medium",
    rollback: "trivial",
    expected_benefit_summary: "ensure acceptance report contains locked VERDICT_PASS phrasing so cessation state can be derived",
  },
  capability_not_promoted: {
    proposal_kind: "advance_plan_to_execution",
    confidence: "not_derivable",
    rollback: "not_applicable",
    expected_benefit_summary: "founder-authorised execution required · S4 cannot judge whether plan should advance",
  },
  evidence_missing: {
    proposal_kind: "collect_missing_evidence",
    confidence: "low",
    rollback: "trivial",
    expected_benefit_summary: "collect the missing evidence · specific cause not derivable from S3 alone",
  },
});

// ── Request ────────────────────────────────────────────────────────────

export interface ImprovementIntelligenceRequest {
  readonly s1_record: EvidenceCollectionSuccess;
  readonly s2_record: CapabilityHealthSuccess;
  readonly s3_record: FailureIntelligenceSuccess;
  readonly clock?: () => Date;
}

// ── Output records ─────────────────────────────────────────────────────

export interface ImprovementProposal {
  readonly proposal_kind: ImprovementProposalKind;
  readonly derived_from_failure_class: FailureClass;
  readonly wave_slug: string;
  readonly evidence_citations: readonly string[];
  readonly confidence: ProposalConfidence;
  readonly expected_benefit_summary: string;
  readonly affected_capability_summary: string;
  readonly dependencies: readonly string[];
  readonly validation_requirement: string;
  readonly rollback_consideration: RollbackConsideration;
}

export interface ImprovementIntelligenceSuccess {
  readonly ok: true;
  readonly assessed_at: string;
  readonly s1_evidence_sha256_verified: string;
  readonly s2_health_sha256_verified: string;
  readonly s3_failure_intelligence_sha256_verified: string;
  readonly proposals: readonly ImprovementProposal[];
  readonly improvement_intelligence_sha256: string;
}

// ── Refusal codes (exhaustive · 6) ─────────────────────────────────────

export type ImprovementIntelligenceRefusalCode =
  | "II_INVALID_REQUEST"
  | "II_INVALID_S1_RECORD"
  | "II_INVALID_S2_RECORD"
  | "II_INVALID_S3_RECORD"
  | "II_CHAIN_SHA_MISMATCH"
  | "II_OUTPUT_TOO_LARGE";

export interface ImprovementIntelligenceFailure {
  readonly ok: false;
  readonly refusal_code: ImprovementIntelligenceRefusalCode;
  readonly reason: string;
  readonly offending_field?: string;
}

export type ImprovementIntelligenceResult = ImprovementIntelligenceSuccess | ImprovementIntelligenceFailure;

export const II_MAX_OUTPUT_BYTES = 128 * 1024;
