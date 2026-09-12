// src/lib/nex/master-ai/connectivity-carrier-scoring.ts
//
// NEX Master AI · Carrier selection scoring model
// Philip 2026-09-07 · AUTHORIZE (research + intelligence only)
//
// The Founder question:
//   "Which Indonesian carrier will give NEX the best wholesale deal,
//    at what commit, at which handoff, with what downstream rights?"
//
// This module scores each provider from BANDWIDTH_PROVIDERS across
// four concrete dimensions and produces a weighted composite ranking:
//
//   D1 · Price          (0-100, higher = cheaper)
//   D2 · Commit         (0-100, higher = more flexible CDR terms)
//   D3 · Handoff        (0-100, higher = better POP diversity + IIX/DC)
//   D4 · Downstream     (0-100, higher = clearer redistribution rights)
//
// PRESERVATION:
//   · Every score has a rationale string explaining the number
//   · Rationale of length < 10 is REJECTED (no meaningless scores)
//   · Weights sum to 1.0 · fail closed if not
//   · Composite = D1×w1 + D2×w2 + D3×w3 + D4×w4
//   · Same inputs → identical composite (deterministic)
//   · Multiple weight scenarios can be evaluated to show sensitivity

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { carrierScoresPath, carrierRankingsPath } from "./paths";

// ═════════════════════════════════════════════════════════════════════
// Dimension scores
// ═════════════════════════════════════════════════════════════════════

export type CarrierDimensionScore = {
  score: number;                                   // 0-100
  rationale: string;                               // required · length >= 10
  evidence_refs: readonly string[];                // ledger references
  source_confidence: "HIGH" | "MEDIUM" | "LOW" | "ESTIMATE";
};

export type CarrierScore = {
  score_id: string;
  recorded_at_iso: string;
  provider_slug: string;
  target_capacity_tier: string;                    // TIER_1_GBPS · TIER_10_GBPS · ...
  d1_price: CarrierDimensionScore;
  d2_commit: CarrierDimensionScore;
  d3_handoff: CarrierDimensionScore;
  d4_downstream: CarrierDimensionScore;
  overall_note: string;
};

export class InvalidCarrierScoreError extends Error {
  constructor(reason: string) { super(`invalid_carrier_score:${reason}`); }
}

function validateDim(dim: CarrierDimensionScore, name: string): void {
  if (dim.score < 0 || dim.score > 100 || !Number.isFinite(dim.score)) {
    throw new InvalidCarrierScoreError(`${name}_score_out_of_range:${dim.score}`);
  }
  if (!dim.rationale || dim.rationale.trim().length < 10) {
    throw new InvalidCarrierScoreError(`${name}_rationale_too_short`);
  }
}

export function recordCarrierScore(input: Omit<CarrierScore, "score_id" | "recorded_at_iso">): CarrierScore {
  if (!input.provider_slug || input.provider_slug.length < 2) throw new InvalidCarrierScoreError("provider_slug");
  if (!input.target_capacity_tier) throw new InvalidCarrierScoreError("target_capacity_tier");
  validateDim(input.d1_price, "d1_price");
  validateDim(input.d2_commit, "d2_commit");
  validateDim(input.d3_handoff, "d3_handoff");
  validateDim(input.d4_downstream, "d4_downstream");
  const rec: CarrierScore = {
    ...input,
    score_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
  };
  appendJsonLine(carrierScoresPath(), rec);
  return rec;
}

export function readAllCarrierScores(): CarrierScore[] {
  return readJsonlAll<CarrierScore>(carrierScoresPath());
}

// ═════════════════════════════════════════════════════════════════════
// Weighted ranking
// ═════════════════════════════════════════════════════════════════════

export type WeightVector = {
  d1_price: number;
  d2_commit: number;
  d3_handoff: number;
  d4_downstream: number;
};

/** Founder default weights: legal structure + price dominate. */
export const DEFAULT_WEIGHTS: WeightVector = Object.freeze({
  d1_price: 0.35,
  d2_commit: 0.15,
  d3_handoff: 0.15,
  d4_downstream: 0.35,
});

/** Sensitivity scenarios · surface how ranking shifts under different priorities. */
export const WEIGHT_SCENARIOS: readonly { slug: string; label: string; weights: WeightVector }[] = Object.freeze([
  Object.freeze({ slug: "default", label: "Founder default (price 35 · commit 15 · handoff 15 · downstream 35)", weights: DEFAULT_WEIGHTS }),
  Object.freeze({ slug: "price_heavy", label: "Price-heavy (price 55 · commit 15 · handoff 10 · downstream 20)",
    weights: Object.freeze({ d1_price: 0.55, d2_commit: 0.15, d3_handoff: 0.10, d4_downstream: 0.20 }) }),
  Object.freeze({ slug: "downstream_critical", label: "Downstream-critical (price 25 · commit 15 · handoff 10 · downstream 50)",
    weights: Object.freeze({ d1_price: 0.25, d2_commit: 0.15, d3_handoff: 0.10, d4_downstream: 0.50 }) }),
  Object.freeze({ slug: "handoff_heavy", label: "Handoff-heavy (price 30 · commit 10 · handoff 40 · downstream 20)",
    weights: Object.freeze({ d1_price: 0.30, d2_commit: 0.10, d3_handoff: 0.40, d4_downstream: 0.20 }) }),
] as const);

export class InvalidWeightError extends Error {
  constructor(reason: string) { super(`invalid_weight:${reason}`); }
}

export function validateWeights(w: WeightVector): void {
  const sum = w.d1_price + w.d2_commit + w.d3_handoff + w.d4_downstream;
  const eps = 1e-6;
  if (Math.abs(sum - 1.0) > eps) throw new InvalidWeightError(`weights_must_sum_to_1_got_${sum}`);
  for (const [k, v] of Object.entries(w)) {
    if (v < 0 || v > 1) throw new InvalidWeightError(`${k}_out_of_range:${v}`);
  }
}

export function composite(score: CarrierScore, weights: WeightVector = DEFAULT_WEIGHTS): number {
  validateWeights(weights);
  return (
    score.d1_price.score * weights.d1_price +
    score.d2_commit.score * weights.d2_commit +
    score.d3_handoff.score * weights.d3_handoff +
    score.d4_downstream.score * weights.d4_downstream
  );
}

export type RankedCarrier = {
  provider_slug: string;
  composite: number;
  d1_price: number;
  d2_commit: number;
  d3_handoff: number;
  d4_downstream: number;
  rank: number;
};

export type CarrierRanking = {
  ranking_id: string;
  recorded_at_iso: string;
  target_capacity_tier: string;
  weight_scenario_slug: string;
  weights: WeightVector;
  ranked: RankedCarrier[];
};

export function rankCarriers(input: {
  scores: CarrierScore[];
  target_capacity_tier: string;
  weight_scenario_slug: string;
  weights: WeightVector;
}): CarrierRanking {
  validateWeights(input.weights);
  const forTier = input.scores.filter((s) => s.target_capacity_tier === input.target_capacity_tier);
  const ranked = forTier.map((s) => ({
    provider_slug: s.provider_slug,
    composite: Math.round(composite(s, input.weights) * 100) / 100,
    d1_price: s.d1_price.score,
    d2_commit: s.d2_commit.score,
    d3_handoff: s.d3_handoff.score,
    d4_downstream: s.d4_downstream.score,
    rank: 0,
  }));
  ranked.sort((a, b) => b.composite - a.composite);
  ranked.forEach((r, i) => { r.rank = i + 1; });
  const rec: CarrierRanking = {
    ranking_id: randomUUID(),
    recorded_at_iso: new Date().toISOString(),
    target_capacity_tier: input.target_capacity_tier,
    weight_scenario_slug: input.weight_scenario_slug,
    weights: input.weights,
    ranked,
  };
  appendJsonLine(carrierRankingsPath(), rec);
  return rec;
}

export function readAllRankings(): CarrierRanking[] {
  return readJsonlAll<CarrierRanking>(carrierRankingsPath());
}

/** Compare rankings across scenarios · surface which providers move rank. */
export function surfaceRankMovers(rankings: CarrierRanking[]): Array<{
  provider_slug: string;
  best_rank: number;
  worst_rank: number;
  rank_delta: number;
  scenarios_evaluated: string[];
}> {
  const perProvider = new Map<string, { ranks: number[]; scenarios: string[] }>();
  for (const r of rankings) {
    for (const item of r.ranked) {
      const arr = perProvider.get(item.provider_slug) || { ranks: [], scenarios: [] };
      arr.ranks.push(item.rank);
      arr.scenarios.push(r.weight_scenario_slug);
      perProvider.set(item.provider_slug, arr);
    }
  }
  const out = [];
  for (const [slug, { ranks, scenarios }] of perProvider) {
    const best = Math.min(...ranks);
    const worst = Math.max(...ranks);
    out.push({
      provider_slug: slug,
      best_rank: best,
      worst_rank: worst,
      rank_delta: worst - best,
      scenarios_evaluated: [...new Set(scenarios)],
    });
  }
  out.sort((a, b) => b.rank_delta - a.rank_delta);
  return out;
}

export function _resetCarrierScoringForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  for (const p of [carrierScoresPath(), carrierRankingsPath()]) {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
  }
}
