// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: MatchConfidenceTypes
// Deterministic byte-stable output. Do not edit by hand.
//
// P1 · Match Confidence type shapes (ADR-0025 · three-band model + refusal vocabulary).
// Authored by NEX1 via typed_data_contract primitive.

export type Band =
  | "very-high"
  | "high"
  | "good"
  | "review";

export const Band_MEMBERS: readonly Band[] = Object.freeze(["very-high", "high", "good", "review"]);

export interface MatchConfidence {
  readonly score: number;
  readonly band: Band;
}

export type MatchConfidenceRefusalReason =
  | "SCORE_OUT_OF_RANGE"
  | "UNKNOWN_BAND"
  | "MISSING_SCORE"
  | "MISSING_BAND";

export const MatchConfidenceRefusalReason_MEMBERS: readonly MatchConfidenceRefusalReason[] = Object.freeze(["SCORE_OUT_OF_RANGE", "UNKNOWN_BAND", "MISSING_SCORE", "MISSING_BAND"]);
