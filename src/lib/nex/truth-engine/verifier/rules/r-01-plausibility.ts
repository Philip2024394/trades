// src/lib/nex/truth-engine/verifier/rules/r-01-plausibility.ts
//
// R-01 · Per-Domain Plausibility Thresholds · rule module.
//
// Founder-authorised sub-step 1a.4 · 2026-09-11.
// Doctrine source: ADR-0314a.2.n (14 founder-authored thresholds ·
// verbatim per Section 2 · locked 2026-09-11) + ADR-0314a.2.n §3 (15
// constitutional interpretation rules) + §7.7 H1 (`unknown` ≠ `very_low`)
// + R-01.v1.0.0.
//
// The 14 thresholds ARE the founder-authored policy. Encoded here
// verbatim. Any amendment requires an explicit founder-authored
// versioning-policy ADR per D-17 amendment clause.
//
// Values in this file are not adjustable at runtime. They are not
// tunable by observed data (per feedback_thresholds_are_founder_policy_not_ai_statistics).
// Adding a Domain / attribute row requires a founder-authored amendment ADR
// (per §7.10 M1 · Domain axis closed at 9; per Rule 9 · no inference).

import type { RuleModule, RuleVerdict, VerifierInput } from "../types";
import {
  CANONICAL_FAIL_CLOSED_REASONS,
  failVerdict,
  passVerdict,
  unknownVerdict,
} from "../fail-closed";

const RULE_ID = "R-01";
const RULE_VERSION = "R-01.v1.0.0";
const THRESHOLD_VERSION = "plausibility_threshold.v1.0.0";

/**
 * Founder-authored per-domain plausibility thresholds · verbatim from
 * ADR-0314a.2.n Section 2 · locked 2026-09-11.
 *
 * Provenance: "Founder-authored threshold" per Philip 2026-09-11.
 * Do NOT: derive · fit · optimise · statistically adjust · percentile-fit ·
 * reinterpret · substitute · silently add · autonomous country override.
 *
 * `zeroAllowed=true` means value=0 PASSES (attribute-specific · e.g. stock
 * out-of-stock is real; admission_fee=0 means free entry).
 * `zeroAllowed=false` means value=0 FAILS with reason
 * `zero_as_unknown_proxy_forbidden` (preserves §7.7 H1 · zero ≠ unknown).
 */
interface Threshold {
  readonly domain: string;
  readonly attribute: string;
  readonly min: number;
  readonly max: number;
  readonly unit: string;
  readonly zeroAllowed: boolean;
}

const FOUNDER_THRESHOLDS: readonly Threshold[] = Object.freeze([
  { domain: "accommodation", attribute: "star_rating", min: 1, max: 5, unit: "stars", zeroAllowed: false },
  { domain: "accommodation", attribute: "rooms", min: 1, max: 2000, unit: "rooms", zeroAllowed: false },
  { domain: "accommodation", attribute: "price_per_night_idr", min: 25000, max: 50000000, unit: "IDR/night", zeroAllowed: false },
  { domain: "food", attribute: "table_count", min: 1, max: 1000, unit: "tables", zeroAllowed: false },
  { domain: "food", attribute: "price_per_meal_idr", min: 5000, max: 5000000, unit: "IDR/meal", zeroAllowed: false },
  { domain: "commerce", attribute: "mp_product.price_idr", min: 100, max: 1000000000, unit: "IDR/product", zeroAllowed: false },
  { domain: "commerce", attribute: "mp_product.stock", min: 0, max: 1000000, unit: "units", zeroAllowed: true },
  { domain: "services", attribute: "chair_count", min: 1, max: 5000, unit: "chairs", zeroAllowed: false },
  { domain: "services", attribute: "sq_m", min: 4, max: 100000, unit: "m²", zeroAllowed: false },
  { domain: "transport", attribute: "seats", min: 1, max: 1500, unit: "seats", zeroAllowed: false },
  { domain: "transport", attribute: "distance", min: 0, max: 20000, unit: "km", zeroAllowed: true },
  { domain: "business", attribute: "employee_count", min: 1, max: 1000000, unit: "employees", zeroAllowed: false },
  { domain: "travel", attribute: "trip_days", min: 1, max: 365, unit: "days", zeroAllowed: false },
  { domain: "attractions", attribute: "admission_fee", min: 0, max: 5000000, unit: "IDR/person", zeroAllowed: true },
]);

function lookupThreshold(domain: string, attribute: string): Threshold | null {
  for (const t of FOUNDER_THRESHOLDS) {
    if (t.domain === domain && t.attribute === attribute) return t;
  }
  return null;
}

/**
 * VerifierInput shape expected by R-01. Callers place per-attribute
 * evaluation requests under `context.plausibility`. Absence of a request
 * yields R-01 PASS (nothing to evaluate) · consistent with R-01 as an
 * attribute-level plausibility guardrail.
 *
 * Shape:
 *   context.plausibility = {
 *     domain: "accommodation",
 *     attribute: "star_rating",
 *     value: 4     // number or null
 *   }
 */
export function evaluateR01(input: VerifierInput): RuleVerdict {
  const req = (input.context?.plausibility ?? null) as
    | { domain?: unknown; attribute?: unknown; value?: unknown }
    | null;

  if (req === null) {
    // No plausibility request supplied · nothing to evaluate · PASS.
    return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, THRESHOLD_VERSION);
  }

  const domain = typeof req.domain === "string" ? req.domain : null;
  const attribute = typeof req.attribute === "string" ? req.attribute : null;
  const value = req.value;

  if (domain === null || attribute === null) {
    // Malformed request · fail-closed rather than infer.
    return unknownVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_DISABLED_PENDING_THRESHOLDS,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  // Rule 5 (ADR-0314a.2.n): null values on optional attributes → UNKNOWN.
  // Rule 6-7: UNKNOWN never converted to FALSE or very_low.
  if (value === null || value === undefined) {
    return unknownVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_DISABLED_PENDING_THRESHOLDS,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    // Non-numeric or NaN/Infinity · fail-closed.
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_FAILED,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  const t = lookupThreshold(domain, attribute);
  if (t === null) {
    // Rule 9: no inference for unlisted attributes · fail-closed.
    return unknownVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_DISABLED_PENDING_THRESHOLDS,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  // Section 4: zero-as-unknown-proxy forbidden per §7.7 H1.
  if (value === 0 && !t.zeroAllowed) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.ZERO_AS_UNKNOWN_PROXY_FORBIDDEN,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  if (value < t.min || value > t.max) {
    return failVerdict(
      RULE_ID,
      RULE_VERSION,
      CANONICAL_FAIL_CLOSED_REASONS.PLAUSIBILITY_CHECK_FAILED,
      input.evidenceRefs,
      THRESHOLD_VERSION,
    );
  }

  return passVerdict(RULE_ID, RULE_VERSION, input.evidenceRefs, THRESHOLD_VERSION);
}

export const RULE_R01: RuleModule = Object.freeze({
  ruleId: RULE_ID,
  ruleVersion: RULE_VERSION,
  evaluate: evaluateR01,
});

/** Exposed for tests / audit · read-only frozen copy. */
export const R01_THRESHOLDS = FOUNDER_THRESHOLDS;
