// Brain confidence engine — implements the math from
// docs/NEX_BRAIN_PLATFORM_AND_ENGINE_V1.md Gap 4.
//
// Confidence is per (brain_slug, prediction_subject, region) triple.
// Inputs come from ADR-0017 §3 (author-set base confidence per fact)
// and ADR-0017 §8 (field learning loop rollups) via
// hammerex_nex_brain_learning_signals.
//
// This module is pure math. It does not touch Supabase. The route
// handler collects inputs, calls compute, returns the tier + raw.

import type { Confidence } from "./_schema/common";

export type ConfidenceInputs = {
  /** Author-set base confidence per fact per ADR-0017 §3. */
  author_base: Confidence;
  /** Number of merchant field outcomes contributing to this triple.
   *  0 if none yet. */
  sample_size: number;
  /** K-anonymity target per ADR-0016. K≥5 for non-pricing, K≥10 for
   *  pricing, K≥20 for margin. Caller picks the right target. */
  k_target: number;
  /** p95 of |delta_pct| across the sample. Undefined when no sample. */
  p95_delta_pct?: number;
  /** Months since Author last reviewed the subject. */
  months_since_last_review: number;
};

export type ConfidenceResult = {
  raw:      number;
  tier:     Confidence;
  reason:   string;
  breakdown: {
    base:      number;
    sample:    number;
    variance:  number;
    freshness: number;
  };
};

const BASE_SCORES: Record<Confidence, number> = {
  low:    0.5,
  medium: 0.7,
  high:   0.9
};

const TIER_HIGH   = 0.80;
const TIER_MEDIUM = 0.60;

const WEIGHT_ANCHOR    = 0.4;
const WEIGHT_SAMPLE    = 0.3;
const WEIGHT_VARIANCE  = 0.2;
const WEIGHT_FRESHNESS = 0.1;

export function computeConfidence(input: ConfidenceInputs): ConfidenceResult {
  const base = BASE_SCORES[input.author_base];

  const sample = input.k_target > 0
    ? Math.min(1.0, input.sample_size / input.k_target)
    : 0;

  const variance = input.p95_delta_pct == null
    ? 0
    : 1.0 - Math.min(1.0, Math.abs(input.p95_delta_pct) / 100);

  const freshness = Math.max(0, 1.0 - input.months_since_last_review / 12);

  const raw = base * (
    WEIGHT_ANCHOR
    + WEIGHT_SAMPLE    * sample
    + WEIGHT_VARIANCE  * variance
    + WEIGHT_FRESHNESS * freshness
  );

  const tier: Confidence =
    raw >= TIER_HIGH   ? "high"
    : raw >= TIER_MEDIUM ? "medium"
    : "low";

  const reason = buildReason(input, sample, variance, freshness);

  return {
    raw: round4(raw),
    tier,
    reason,
    breakdown: {
      base:      round4(base),
      sample:    round4(sample),
      variance:  round4(variance),
      freshness: round4(freshness)
    }
  };
}

function buildReason(
  input: ConfidenceInputs,
  sample: number,
  variance: number,
  freshness: number
): string {
  const parts: string[] = [];
  parts.push(`author base ${input.author_base}`);
  if (input.sample_size === 0) {
    parts.push("no field outcomes yet");
  } else if (sample < 1) {
    parts.push(`sample ${input.sample_size}/${input.k_target} below K target`);
  } else {
    parts.push(`sample ${input.sample_size} meets K target`);
  }
  if (input.p95_delta_pct != null) {
    parts.push(`p95 delta ${input.p95_delta_pct.toFixed(1)}%`);
  }
  if (freshness < 0.5) {
    parts.push(`review ${input.months_since_last_review.toFixed(0)}mo old`);
  }
  return parts.join(" · ");
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

export const INSUFFICIENT_CONFIDENCE_THRESHOLD = TIER_MEDIUM;

/** Should the /api/brain/query response degrade to
 *  'insufficient_confidence' when the caller did not opt-in? */
export function isInsufficient(result: ConfidenceResult): boolean {
  return result.raw < INSUFFICIENT_CONFIDENCE_THRESHOLD;
}
