// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: MatchConfidenceBounds
// Deterministic byte-stable output. Do not edit by hand.
//
// P1 · Match Confidence bound constants (ADR-0025 tiered thresholds).
// Authored by NEX1 via typed_data_contract primitive.
// Founder-locked thresholds · not adjusted per surface without ADR update.

export const CONFIDENCE_VERY_HIGH_FLOOR: { readonly min: number; readonly max: number } = Object.freeze({ min: 0.99, max: 1 });

export const CONFIDENCE_HIGH_FLOOR: { readonly min: number; readonly max: number } = Object.freeze({ min: 0.95, max: 1 });

export const CONFIDENCE_GOOD_FLOOR: { readonly min: number; readonly max: number } = Object.freeze({ min: 0.85, max: 1 });

export const CONFIDENCE_SCORE_RANGE: { readonly min: number; readonly max: number } = Object.freeze({ min: 0, max: 1 });
