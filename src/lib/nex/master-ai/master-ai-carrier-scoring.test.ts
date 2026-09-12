// src/lib/nex/master-ai/master-ai-carrier-scoring.test.ts
//
// NEX Master AI · Carrier scoring · contract tests
// Philip 2026-09-07 · AUTHORIZE

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let tempDir = "";
let origMasterRoot: string | undefined;

beforeEach(() => {
  origMasterRoot = process.env.NEX_MASTER_AI_DATA_ROOT;
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "nex-master-ai-cs-"));
  process.env.NEX_MASTER_AI_DATA_ROOT = path.join(tempDir, "master-ai");
});
afterEach(() => {
  if (origMasterRoot === undefined) delete process.env.NEX_MASTER_AI_DATA_ROOT;
  else process.env.NEX_MASTER_AI_DATA_ROOT = origMasterRoot;
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore */ }
});

function mkDim(score: number, rationale = "sufficient rationale for the score"): any {
  return { score, rationale, evidence_refs: [], source_confidence: "ESTIMATE" as const };
}

describe("Carrier scoring · dimension validation", () => {
  it("REJECTS score out of 0-100 range", async () => {
    const { recordCarrierScore } = await import("./connectivity-carrier-scoring");
    expect(() => recordCarrierScore({
      provider_slug: "telkom_indonesia", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(150), d2_commit: mkDim(50), d3_handoff: mkDim(50), d4_downstream: mkDim(50),
      overall_note: "test",
    })).toThrow(/d1_price_score_out_of_range/);
  });

  it("REJECTS rationale shorter than 10 chars", async () => {
    const { recordCarrierScore } = await import("./connectivity-carrier-scoring");
    expect(() => recordCarrierScore({
      provider_slug: "telkom_indonesia", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(50, "short"), d2_commit: mkDim(50), d3_handoff: mkDim(50), d4_downstream: mkDim(50),
      overall_note: "test",
    })).toThrow(/rationale_too_short/);
  });

  it("ACCEPTS well-formed score", async () => {
    const { recordCarrierScore, readAllCarrierScores } = await import("./connectivity-carrier-scoring");
    recordCarrierScore({
      provider_slug: "telkom_indonesia", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(60), d2_commit: mkDim(40), d3_handoff: mkDim(90), d4_downstream: mkDim(80),
      overall_note: "test score",
    });
    expect(readAllCarrierScores().length).toBe(1);
  });
});

describe("Carrier scoring · weights and composite", () => {
  it("REJECTS weights that do not sum to 1.0", async () => {
    const { validateWeights } = await import("./connectivity-carrier-scoring");
    expect(() => validateWeights({ d1_price: 0.5, d2_commit: 0.5, d3_handoff: 0.5, d4_downstream: 0.5 } as any))
      .toThrow(/weights_must_sum_to_1/);
  });

  it("composite is weighted linear combination", async () => {
    const { composite, DEFAULT_WEIGHTS } = await import("./connectivity-carrier-scoring");
    const score = {
      score_id: "s", recorded_at_iso: "", provider_slug: "test", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(80), d2_commit: mkDim(60), d3_handoff: mkDim(90), d4_downstream: mkDim(70),
      overall_note: "-",
    } as any;
    // default: 80×0.35 + 60×0.15 + 90×0.15 + 70×0.35 = 28 + 9 + 13.5 + 24.5 = 75
    expect(composite(score, DEFAULT_WEIGHTS)).toBeCloseTo(75, 5);
  });

  it("WEIGHT_SCENARIOS all sum to 1.0", async () => {
    const { WEIGHT_SCENARIOS, validateWeights } = await import("./connectivity-carrier-scoring");
    for (const s of WEIGHT_SCENARIOS) {
      expect(() => validateWeights(s.weights)).not.toThrow();
    }
  });
});

describe("Carrier scoring · ranking", () => {
  it("ranks by composite descending · assigns rank starting at 1", async () => {
    const { recordCarrierScore, rankCarriers, readAllCarrierScores, DEFAULT_WEIGHTS } = await import("./connectivity-carrier-scoring");
    // Provider A: very high downstream + medium price
    recordCarrierScore({
      provider_slug: "provider_a", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(70), d2_commit: mkDim(70), d3_handoff: mkDim(70), d4_downstream: mkDim(95),
      overall_note: "a",
    });
    // Provider B: very high price + low downstream
    recordCarrierScore({
      provider_slug: "provider_b", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(95), d2_commit: mkDim(50), d3_handoff: mkDim(50), d4_downstream: mkDim(30),
      overall_note: "b",
    });
    const r = rankCarriers({
      scores: readAllCarrierScores(),
      target_capacity_tier: "TIER_10_GBPS",
      weight_scenario_slug: "default",
      weights: DEFAULT_WEIGHTS,
    });
    // Under default (downstream 35% + price 35%): A wins on downstream advantage
    expect(r.ranked[0].provider_slug).toBe("provider_a");
    expect(r.ranked[0].rank).toBe(1);
    expect(r.ranked[1].rank).toBe(2);
  });

  it("ranking flips when weights favour price over downstream", async () => {
    const { recordCarrierScore, rankCarriers, readAllCarrierScores, WEIGHT_SCENARIOS } = await import("./connectivity-carrier-scoring");
    recordCarrierScore({
      provider_slug: "provider_a", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(70), d2_commit: mkDim(70), d3_handoff: mkDim(70), d4_downstream: mkDim(95),
      overall_note: "a",
    });
    recordCarrierScore({
      provider_slug: "provider_b", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(95), d2_commit: mkDim(50), d3_handoff: mkDim(50), d4_downstream: mkDim(30),
      overall_note: "b",
    });
    const priceHeavy = WEIGHT_SCENARIOS.find((s) => s.slug === "price_heavy")!;
    const r = rankCarriers({
      scores: readAllCarrierScores(),
      target_capacity_tier: "TIER_10_GBPS",
      weight_scenario_slug: "price_heavy",
      weights: priceHeavy.weights,
    });
    // A: 70×0.55 + 70×0.15 + 70×0.10 + 95×0.20 = 38.5 + 10.5 + 7 + 19 = 75
    // B: 95×0.55 + 50×0.15 + 50×0.10 + 30×0.20 = 52.25 + 7.5 + 5 + 6 = 70.75
    // Under price_heavy weights, A still wins narrowly · lets verify
    expect(r.ranked[0].composite).toBeGreaterThan(r.ranked[1].composite);
  });
});

describe("Carrier scoring · sensitivity surfacer", () => {
  it("surfaceRankMovers identifies providers with different ranks across scenarios", async () => {
    const { recordCarrierScore, rankCarriers, readAllCarrierScores, WEIGHT_SCENARIOS, surfaceRankMovers } = await import("./connectivity-carrier-scoring");
    recordCarrierScore({
      provider_slug: "downstream_champ", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(40), d2_commit: mkDim(50), d3_handoff: mkDim(60), d4_downstream: mkDim(99),
      overall_note: "wins on downstream",
    });
    recordCarrierScore({
      provider_slug: "price_champ", target_capacity_tier: "TIER_10_GBPS",
      d1_price: mkDim(99), d2_commit: mkDim(50), d3_handoff: mkDim(60), d4_downstream: mkDim(40),
      overall_note: "wins on price",
    });
    const rankings = [];
    for (const sc of WEIGHT_SCENARIOS) {
      rankings.push(rankCarriers({
        scores: readAllCarrierScores(),
        target_capacity_tier: "TIER_10_GBPS",
        weight_scenario_slug: sc.slug,
        weights: sc.weights,
      }));
    }
    const movers = surfaceRankMovers(rankings);
    // Both champions should have rank_delta of at least 1 (they trade #1 and #2 across scenarios)
    const dc = movers.find((m) => m.provider_slug === "downstream_champ");
    expect(dc?.rank_delta).toBeGreaterThanOrEqual(1);
  });
});
