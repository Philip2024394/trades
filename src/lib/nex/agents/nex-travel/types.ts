// src/lib/nex/agents/nex-travel/types.ts
//
// WAVE-S-2 · Travel specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-2 · 2026-09-08
//
// Domain: hotels · flights · transport · destinations · itineraries ·
// local knowledge. Failure modes: scam · visa · timezone · overbooking.

export type TravelRequestKind =
  | "hotel"
  | "flight"
  | "transport"
  | "destination_info"
  | "itinerary"
  | "local_conditions"
  | "visa_requirements"
  | "unknown";

export type TravelSafetySignal =
  | { kind: "possible_scam"; description: string; severity: "low" | "medium" | "high" }
  | { kind: "visa_gap"; description: string }
  | { kind: "timezone_ambiguity"; description: string }
  | { kind: "overbooking_risk"; description: string }
  | { kind: "safety_advisory"; region: string; description: string }
  | { kind: "medical_or_legal_boundary"; description: string }  // route to disclaimer
  | { kind: "no_travel_safety_concern" };

export type TravelRequest = {
  request_id: string;
  request_text: string;
  origin?: string;
  destination?: string;
  travel_date_iso?: string;
  travelers?: number;
};

export type TravelResponse = {
  request_id: string;
  detected_kind: TravelRequestKind;
  safety_signals: readonly TravelSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;  // true when actual booking / real-time data needed
};

export type TravelRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "no_booking_claims_in_phase_3"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "no_fabrication_no_prices_no_availability"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type TravelCorpusCase = {
  case_id: string;
  request: TravelRequest;
  expected: {
    detected_kind: TravelRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly TravelSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type TravelCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly TravelCorpusCase[];
  content_hash: string;
};

export type TravelEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly TravelRubricCheck[];
  actual: TravelResponse;
};
