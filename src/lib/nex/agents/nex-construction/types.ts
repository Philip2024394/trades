// src/lib/nex/agents/nex-construction/types.ts
//
// WAVE-S-5 · Construction specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-5 · 2026-09-08
//
// SCOPE: general construction knowledge · all countries · NEX-scoped
// (NOT Networkers-app-scoped). Region-specific regulations are surfaced
// as evidence WHEN detected, not assumed. Universal construction risks
// (gas work · electrical work · working at height · asbestos · structural
// load · shared-wall notice · regulatory compliance) are recognised
// generically · region-specific frameworks are named in descriptions
// when the request text OR jurisdiction context makes them explicit.
//
// Failure modes: unsupported method statement · missing risk assessment ·
// jurisdiction-boundary crossing without qualified licence · unsafe
// working-at-height guidance · fabricated quantities / prices.

export type ConstructionRequestKind =
  | "method_statement"
  | "material_quantity"
  | "regulatory_check"
  | "structural_query"
  | "safety_risk_assessment"
  | "trade_licensing_boundary"       // gas / electrical / asbestos / F-gas · region-specific licence
  | "quotation_advice"
  | "shared_wall_dispute"            // party-wall style (UK) OR analog frameworks in other jurisdictions
  | "staircase_query"                // dedicated · NEX already has substantial staircase knowledge in src/lib/nex/staircase-* files
  | "unknown";

export type ConstructionSafetySignal =
  | { kind: "asbestos_risk"; description: string }
  | { kind: "gas_work_licensing_required"; description: string }
  | { kind: "electrical_work_licensing_required"; description: string }
  | { kind: "working_at_height_risk"; description: string }
  | { kind: "structural_load_risk"; description: string }
  | { kind: "regulatory_compliance_risk"; regime: string; description: string }
  | { kind: "shared_wall_notice_required"; description: string }
  | { kind: "unsupported_quantity_or_price"; description: string }
  | { kind: "no_construction_safety_concern" };

export type ConstructionRequest = {
  request_id: string;
  request_text: string;
  property_context?: string;          // free text · e.g. "1970s single-storey" · "high-rise apartment"
  jurisdiction?: string;              // free text · e.g. "UK-England" · "US-CA" · "AU-NSW" · "ID-DKI" · surfaced in advisories when present
};

export type ConstructionResponse = {
  request_id: string;
  detected_kind: ConstructionRequestKind;
  safety_signals: readonly ConstructionSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type ConstructionRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "no_unlicensed_gas_or_electrical_diy_encouragement"; ok: boolean; detail?: string }
  | { check: "no_asbestos_diy_encouragement"; ok: boolean; detail?: string }
  | { check: "no_fabricated_quantities_or_prices"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type ConstructionCorpusCase = {
  case_id: string;
  request: ConstructionRequest;
  expected: {
    detected_kind: ConstructionRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly ConstructionSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type ConstructionCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly ConstructionCorpusCase[];
  content_hash: string;
};

export type ConstructionEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly ConstructionRubricCheck[];
  actual: ConstructionResponse;
};
