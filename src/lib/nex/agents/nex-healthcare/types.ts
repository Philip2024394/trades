// src/lib/nex/agents/nex-healthcare/types.ts
//
// WAVE-S-6 · Healthcare specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-6 · 2026-09-08
//
// SCOPE: general healthcare / medical · all countries · NEX-scoped.
// Region-specific regulations (HIPAA · GDPR-health-data · CQC · TGA · PMDA · BPOM)
// surfaced as evidence when detected · never assumed.
//
// STRICT DISCIPLINE (universal · non-negotiable):
//   · NEX NEVER diagnoses. Any symptom-shaped question → medical_diagnosis_boundary.
//   · NEX NEVER prescribes. Any prescription request → medical_prescription_boundary.
//   · NEX ALWAYS routes emergencies. Emergency-keyword patterns emit the
//     emergency_route signal with jurisdiction-appropriate numbers.
//   · NEX NEVER gives specific pediatric medical guidance. Any child/infant
//     medical topic → pediatric_medical_boundary.
//   · NEX ALWAYS routes mental-health crisis. Suicidal-ideation / self-harm
//     patterns emit mental_health_crisis_route with jurisdiction-appropriate
//     lines.
//   · NEX NEVER promotes unsupported medical cures / detox / miracle claims.
//   · NEX ALWAYS defers medication-interaction questions to pharmacist review.
//   · Pregnancy-related topics escalate to pregnancy_medical_boundary
//     (obstetric care required).

export type HealthcareRequestKind =
  | "symptom_query"
  | "medication_question"
  | "medication_interaction"
  | "prescription_request"
  | "emergency_query"
  | "mental_health_query"
  | "pregnancy_query"
  | "pediatric_query"
  | "wellness_lifestyle"
  | "public_health_info"
  | "unknown";

export type HealthcareSafetySignal =
  | { kind: "medical_diagnosis_boundary"; description: string }         // NEX never diagnoses
  | { kind: "medical_prescription_boundary"; description: string }      // NEX never prescribes
  | { kind: "emergency_route"; regime_hint: string; description: string } // route to jurisdiction emergency line
  | { kind: "mental_health_crisis_route"; regime_hint: string; description: string } // route to crisis line
  | { kind: "pregnancy_medical_boundary"; description: string }         // obstetric care required
  | { kind: "pediatric_medical_boundary"; description: string }         // paediatrician required
  | { kind: "medication_interaction_pharmacist_referral"; description: string }
  | { kind: "unsupported_medical_claim"; description: string }          // cures / detox / miracle
  | { kind: "no_healthcare_safety_concern" };

export type HealthcareRequest = {
  request_id: string;
  request_text: string;
  patient_context?: string;         // free text · e.g. "adult · no known conditions"
  jurisdiction?: string;            // free text · e.g. "UK" · "US" · "AU" · "ID" · surfaced when present
};

export type HealthcareResponse = {
  request_id: string;
  detected_kind: HealthcareRequestKind;
  safety_signals: readonly HealthcareSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type HealthcareRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "never_diagnoses_in_advisory_text"; ok: boolean; detail?: string }
  | { check: "never_prescribes_in_advisory_text"; ok: boolean; detail?: string }
  | { check: "emergency_route_number_surfaced_when_expected"; ok: boolean; detail?: string }
  | { check: "no_unsupported_medical_claim_in_advisory"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type HealthcareCorpusCase = {
  case_id: string;
  request: HealthcareRequest;
  expected: {
    detected_kind: HealthcareRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly HealthcareSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type HealthcareCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly HealthcareCorpusCase[];
  content_hash: string;
};

export type HealthcareEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly HealthcareRubricCheck[];
  actual: HealthcareResponse;
};
