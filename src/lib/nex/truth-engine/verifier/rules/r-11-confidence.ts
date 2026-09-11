// src/lib/nex/truth-engine/verifier/rules/r-11-confidence.ts
//
// R-11 · Confidence Score + Band Derivation · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.j (D-11 · 6-band structure + unknown
// sentinel · locked 2026-09-11) · R-11.v1.0.0 · §7.7 H1 (`unknown` ≠
// `very_low`) · §7.8 J1 (physical vs logical authority).
//
// Founder doctrine (D-11 verbatim): *"the score remains authoritative
// and the band remains derived"*.
//
// Numeric score is authoritative. Band is DERIVED at the Router boundary
// from the score using the 6-band table below. Band drift (score → band
// mismatch) is a G-2 non-bypass violation per ADR-0314a.2.j.
//
// null score → UNKNOWN band. UNKNOWN is a fail-closed sentinel · Guardian
// rejects promotion to AUTHORITATIVE when score is null. UNKNOWN is NOT
// silently converted to very_low.

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
  unknownVerdict,
} from "../fail-closed";

const RULE_ID = "R-11";
const RULE_VERSION = "R-11.v1.0.0";
const BAND_VERSION = "confidence_band_derivation.v1.0.0";

/**
 * Founder-authored 6-band table + unknown sentinel per ADR-0314a.2.j
 * Section 2 (verbatim · Founder-authored: Philip 2026-09-11).
 *
 * Boundaries are inclusive at both ends within each band. Score domain
 * is integer 0-100. A null score produces band=`unknown`.
 */
export type ConfidenceBand =
  | "very_high"
  | "high"
  | "good"
  | "moderate"
  | "low"
  | "very_low"
  | "unknown";

interface BandRow {
  readonly band: Exclude<ConfidenceBand, "unknown">;
  readonly min: number;
  readonly max: number;
}

const FOUNDER_BANDS: readonly BandRow[] = Object.freeze([
  { band: "very_high", min: 99, max: 100 },
  { band: "high", min: 95, max: 98 },
  { band: "good", min: 85, max: 94 },
  { band: "moderate", min: 70, max: 84 },
  { band: "low", min: 50, max: 69 },
  { band: "very_low", min: 0, max: 49 },
]);

/**
 * Derive the confidence band from a numeric score. Deterministic per the
 * founder-authored table. Any score outside [0, 100] fails-closed.
 * A null score produces UNKNOWN band (per §7.7 H1 · never silently
 * converted to very_low).
 */
export function deriveBand(score: number | null): ConfidenceBand {
  if (score === null || score === undefined) return "unknown";
  if (typeof score !== "number" || !Number.isFinite(score)) return "unknown";
  if (score < 0 || score > 100) return "unknown";
  for (const row of FOUNDER_BANDS) {
    if (score >= row.min && score <= row.max) return row.band;
  }
  // Unreachable given [0, 100] coverage above · defensive · UNKNOWN.
  return "unknown";
}

/**
 * VerifierInput shape expected by R-11:
 *   context.confidence = {
 *     numericScore: 87,      // number or null
 *     declaredBand?: "good"  // optional · if present · Guardian checks drift
 *   }
 *
 * Semantics:
 *   - Only numericScore supplied: R-11 passes if score in [0, 100] · UNKNOWN if null.
 *   - Both supplied: R-11 asserts declaredBand === deriveBand(numericScore).
 *     Mismatch → FAIL with reason `band_drift_detected` (G-2 non-bypass).
 */
export function evaluateR11(input: VerifierInput): RuleVerdict {
  const req = (input.context?.confidence ?? null) as
    | { numericScore?: unknown; declaredBand?: unknown }
    | null;

  if (req === null) {
    // No confidence request · PASS (nothing to evaluate).
    return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, BAND_VERSION);
  }

  const raw = req.numericScore;
  const declared = typeof req.declaredBand === "string" ? req.declaredBand : null;

  // null / undefined score → UNKNOWN. Never converted to very_low.
  if (raw === null || raw === undefined) {
    return unknownVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.UNKNOWN_SCORE_CANNOT_PROMOTE,
      input.evidenceRefs,
      BAND_VERSION,
    );
  }

  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.CONFIDENCE_SCORE_OUT_OF_RANGE,
      input.evidenceRefs,
      BAND_VERSION,
    );
  }

  if (raw < 0 || raw > 100) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.CONFIDENCE_SCORE_OUT_OF_RANGE,
      input.evidenceRefs,
      BAND_VERSION,
    );
  }

  const derived = deriveBand(raw);

  if (declared !== null && declared !== derived) {
    // G-2 non-bypass violation: score/band drift.
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.BAND_DRIFT_DETECTED,
      input.evidenceRefs,
      BAND_VERSION,
    );
  }

  return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, BAND_VERSION);
}

export const RULE_R11: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR11,
});

/** Exposed for tests / audit · read-only frozen copy. */
export const R11_BANDS = FOUNDER_BANDS;
