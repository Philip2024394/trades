// src/lib/nex/agents/nex-legal/types.ts
//
// WAVE-S-8 · Legal specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-8 · 2026-09-08
//
// SCOPE: general legal · all jurisdictions · NEX-scoped. Region-specific
// regulatory frameworks surfaced as evidence when detected · never assumed.
//
// STRICT DISCIPLINE (universal · non-negotiable):
//   · NEX NEVER gives legal advice. Any advice-shaped question → legal_advice_boundary.
//   · NEX NEVER guarantees a case outcome or fabricates damages figures.
//   · NEX ALWAYS routes emergencies (immediate arrest · deportation · custody
//     · restraining-order breach) to emergency lines + solicitor/attorney referral.
//   · NEX ALWAYS defers to a qualified jurisdiction-admitted practitioner.
//   · NEX RECOGNISES privileged-communication risk and surfaces it.

export type LegalRequestKind =
  | "contract_interpretation"
  | "legal_procedure_query"
  | "rights_query"
  | "criminal_law_query"
  | "family_law_query"
  | "employment_law_query"
  | "immigration_query"
  | "intellectual_property_query"
  | "consumer_law_query"
  | "emergency_legal"
  | "unknown";

export type LegalSafetySignal =
  | { kind: "legal_advice_boundary"; description: string }                     // NEX never gives legal advice
  | { kind: "bar_admission_licensing_required"; description: string }          // jurisdiction-admitted practitioner required
  | { kind: "criminal_law_boundary"; description: string }                     // criminal matter · seek criminal defence solicitor + do not self-represent when at risk
  | { kind: "family_law_boundary"; description: string }                       // child arrangements · specialist practitioner
  | { kind: "privileged_communication_risk"; description: string }             // attorney-client / solicitor-client privilege
  | { kind: "statute_of_limitations_awareness"; description: string }          // time-critical action required
  | { kind: "unsupported_case_outcome_claim"; description: string }            // "guaranteed win" · fabricated damages
  | { kind: "emergency_route"; regime_hint: string; description: string }      // immediate legal emergency
  | { kind: "no_legal_safety_concern" };

export type LegalRequest = {
  request_id: string;
  request_text: string;
  case_context?: string;              // free text · e.g. "adult · not currently detained"
  jurisdiction?: string;              // free text · e.g. "UK-England" · "US-NY" · "AU-NSW" · "ID"
};

export type LegalResponse = {
  request_id: string;
  detected_kind: LegalRequestKind;
  safety_signals: readonly LegalSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type LegalRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "never_gives_legal_advice_in_advisory"; ok: boolean; detail?: string }
  | { check: "never_guarantees_case_outcome"; ok: boolean; detail?: string }
  | { check: "no_fabricated_damages_or_penalties"; ok: boolean; detail?: string }
  | { check: "emergency_route_number_surfaced_when_expected"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type LegalCorpusCase = {
  case_id: string;
  request: LegalRequest;
  expected: {
    detected_kind: LegalRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly LegalSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type LegalCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly LegalCorpusCase[];
  content_hash: string;
};

export type LegalEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly LegalRubricCheck[];
  actual: LegalResponse;
};
