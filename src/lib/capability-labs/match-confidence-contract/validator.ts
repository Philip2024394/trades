// §36-A · ROUTE-2 · 2026-09-14 · typed-data-contract authored file.
// Contract: MatchConfidenceValidator
// Deterministic byte-stable output. Do not edit by hand.
//
// P1 · Match Confidence validator (ADR-0025).
// Authored by NEX1 via typed_data_contract primitive.
// Uses Route 2b runtime_imports for range constants + Band · Route 2c runtime_import literals for cross-file refusal-union.

import type { MatchConfidence } from "./types";
import { CONFIDENCE_SCORE_RANGE } from "./ranges";
import { Band, Band_MEMBERS } from "./types";
import { MatchConfidenceRefusalReason, MatchConfidenceRefusalReason_MEMBERS } from "./types";

export function validate_match_confidence(input: MatchConfidence): { readonly ok: true } | { readonly ok: false; readonly reason: MatchConfidenceRefusalReason } {
  if ((input as unknown as Record<string, unknown>)["score"] === undefined || (input as unknown as Record<string, unknown>)["score"] === null) {
    return { ok: false, reason: "MISSING_SCORE" };
  }
  if ((input as unknown as Record<string, unknown>)["band"] === undefined || (input as unknown as Record<string, unknown>)["band"] === null) {
    return { ok: false, reason: "MISSING_BAND" };
  }
  {
    const v = (input as unknown as Record<string, unknown>)["score"];
    if (typeof v !== "number" || !Number.isFinite(v) || v < CONFIDENCE_SCORE_RANGE.min || v > CONFIDENCE_SCORE_RANGE.max) {
      return { ok: false, reason: "SCORE_OUT_OF_RANGE" };
    }
  }
  {
    const v = (input as unknown as Record<string, unknown>)["band"];
    const allowed: readonly string[] = Band_MEMBERS;
    if (typeof v !== "string" || !allowed.includes(v)) {
      return { ok: false, reason: "UNKNOWN_BAND" };
    }
  }
  return { ok: true };
}
