// src/lib/nex/agents/nex-transport/types.ts
//
// WAVE-S-7 · Transport / Logistics specialist · Phase 3 (deterministic · observer-only)
// Founder BEGIN WAVE-S-7 · 2026-09-08
//
// SCOPE: general transport + logistics · all countries · NEX-scoped.
// Regional regulatory frameworks (UK DVSA · EU Working Time Directive
// 561/2006 · US DOT/FMCSA HOS · AU Chain of Responsibility · IMDG · IATA
// DGR · ADR · 49 CFR) surfaced as evidence when detected · never assumed.
//
// STRICT DISCIPLINE:
//   · NEX NEVER encourages driving fatigued or beyond legal hours.
//   · NEX NEVER gives hazmat handling advice without directing to
//     jurisdiction-appropriate dangerous-goods training + licensing.
//   · NEX ALWAYS routes transport emergencies (crash · fire · injury ·
//     hazmat spill) to emergency lines.
//   · NEX NEVER validates unlicensed carrier operation.
//   · NEX NEVER fabricates freight quotes or day-rate figures.

export type TransportRequestKind =
  | "driver_hours_query"
  | "vehicle_maintenance_query"
  | "hazmat_transport_query"
  | "customs_declaration_query"
  | "route_planning"
  | "fleet_management"
  | "passenger_transport"
  | "cargo_general"
  | "freight_pricing"
  | "emergency_incident"
  | "unknown";

export type TransportSafetySignal =
  | { kind: "driver_hours_regulation_risk"; description: string }               // WTD / HOS / CoR fatigue
  | { kind: "hazmat_handling_boundary"; description: string }                   // ADR / DOT / IMDG / IATA
  | { kind: "vehicle_roadworthiness_risk"; description: string }                // MOT / DVSA / DOT inspection
  | { kind: "cross_border_customs_boundary"; description: string }              // import/export declarations
  | { kind: "unlicensed_carrier_boundary"; description: string }                // operator licence / CPC / vocational driver
  | { kind: "passenger_safety_risk"; description: string }                      // child seat · minibus · school transport
  | { kind: "emergency_route"; regime_hint: string; description: string }       // crash · fire · injury · hazmat spill
  | { kind: "unsupported_freight_quote"; description: string }                  // fabricated £/mile · guaranteed price
  | { kind: "no_transport_safety_concern" };

export type TransportRequest = {
  request_id: string;
  request_text: string;
  vehicle_context?: string;         // free text · e.g. "44-tonne HGV" · "3.5t van" · "PSV bus"
  jurisdiction?: string;            // free text · surfaced when present
};

export type TransportResponse = {
  request_id: string;
  detected_kind: TransportRequestKind;
  safety_signals: readonly TransportSafetySignal[];
  advisory_text: string;
  requires_human_review: boolean;
  deferred_to_phase_4: boolean;
};

export type TransportRubricCheck =
  | { check: "kind_classification_matches_expected"; ok: boolean; detail?: string }
  | { check: "safety_signals_present_when_expected"; ok: boolean; detail?: string }
  | { check: "no_encourage_driving_fatigued_or_over_hours"; ok: boolean; detail?: string }
  | { check: "no_unlicensed_hazmat_advice"; ok: boolean; detail?: string }
  | { check: "emergency_route_number_surfaced_when_expected"; ok: boolean; detail?: string }
  | { check: "no_fabricated_freight_quote"; ok: boolean; detail?: string }
  | { check: "human_review_triggered_when_appropriate"; ok: boolean; detail?: string }
  | { check: "advisory_text_non_empty_and_bounded"; ok: boolean; detail?: string };

export type TransportCorpusCase = {
  case_id: string;
  request: TransportRequest;
  expected: {
    detected_kind: TransportRequestKind;
    should_require_human_review: boolean;
    expected_safety_kinds: readonly TransportSafetySignal["kind"][];
    should_defer_to_phase_4: boolean;
  };
  tags?: readonly string[];
};

export type TransportCorpus = {
  version: string;
  authored_by: string;
  authored_at_iso: string;
  cases: readonly TransportCorpusCase[];
  content_hash: string;
};

export type TransportEvaluation = {
  case_id: string;
  passed: boolean;
  checks: readonly TransportRubricCheck[];
  actual: TransportResponse;
};
