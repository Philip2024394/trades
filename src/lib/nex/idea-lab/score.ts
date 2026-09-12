// src/lib/nex/idea-lab/score.ts
//
// Stage 10 · Idea Lab composite scoring. Per founder-locked rule:
// "Score is advice · founder's SEND TO CODING is authority."
// Master AI must NOT interpret score as authorisation.

import type { DimensionScore, IdeaDimension, IdeaEvaluation, IdeaValidation } from "./types";

/**
 * Founder-authored dimension weights (v1). All entries sum to 100.
 * Not AI-computed. Not observation-driven. Founder-authored threshold policy
 * (per feedback_thresholds_are_founder_policy_not_ai_statistics.md).
 */
export const DIMENSION_WEIGHTS: Readonly<Record<IdeaDimension, number>> = {
  user_value:                15,
  strategic_fit:             12,
  technical_feasibility:     10,
  boundary_safety:           10,
  integration_cost:          10,
  measurability:              8,
  reversibility:              8,
  constitutional_alignment:  10,
  founder_effort:             7,
  differentiation:            5,
  urgency:                    5,
};

const WEIGHT_SUM = Object.values(DIMENSION_WEIGHTS).reduce((s, v) => s + v, 0);

/**
 * Compute the weighted composite score from an array of dimension scores.
 * Missing dimensions default to 0 (visible in reasoning).
 */
export function computeCompositeScore(dimensionScores: readonly DimensionScore[]): number {
  const byDim = new Map<IdeaDimension, number>();
  for (const s of dimensionScores) {
    byDim.set(s.dimension, s.score);
  }
  let total = 0;
  for (const dim of Object.keys(DIMENSION_WEIGHTS) as IdeaDimension[]) {
    const w = DIMENSION_WEIGHTS[dim];
    const s = byDim.get(dim) ?? 0;
    total += (s * w) / WEIGHT_SUM;
  }
  return Math.round(total * 10) / 10;
}

export function validateEvaluation(input: {
  ideaId: string;
  title: string;
  summary: string;
  dimensionScores: readonly DimensionScore[];
}): IdeaValidation {
  if (!input.ideaId || input.ideaId.length === 0) {
    return { ok: false, code: "sec.idea_missing_id", reason: "ideaId required" };
  }
  if (!input.title || input.title.length === 0) {
    return { ok: false, code: "sec.idea_missing_title", reason: "title required" };
  }
  if (!input.summary || input.summary.length === 0) {
    return { ok: false, code: "sec.idea_missing_summary", reason: "summary required" };
  }
  for (const s of input.dimensionScores) {
    if (s.score < 0 || s.score > 100) {
      return { ok: false, code: "sec.idea_score_out_of_range", reason: `Score ${s.score} out of [0,100]` };
    }
    if (!s.reasoning || s.reasoning.length === 0) {
      return {
        ok: false,
        code: "sec.idea_reasoning_missing",
        reason: `Dimension ${s.dimension} score has no visible reasoning`,
      };
    }
  }
  return { ok: true };
}

/**
 * Composite-score band → founder-facing label. Advisory only.
 */
export function scoreBand(score: number): "🟢 STRONG" | "🟡 CONSIDER" | "🟠 WEAK" | "🔴 REJECT-CANDIDATE" {
  if (score >= 75) return "🟢 STRONG";
  if (score >= 55) return "🟡 CONSIDER";
  if (score >= 35) return "🟠 WEAK";
  return "🔴 REJECT-CANDIDATE";
}
