// src/lib/nex/idea-lab/idea-lab.test.ts

import { describe, it, expect } from "vitest";
import {
  DIMENSION_WEIGHTS,
  computeCompositeScore,
  validateEvaluation,
  scoreBand,
  type DimensionScore,
} from "./index";

const allDim = (score: number, reason = "test"): DimensionScore[] =>
  (Object.keys(DIMENSION_WEIGHTS) as (keyof typeof DIMENSION_WEIGHTS)[]).map((d) => ({
    dimension: d,
    score,
    reasoning: reason,
    evidence: [],
  }));

describe("DIMENSION_WEIGHTS", () => {
  it("weights sum to 100", () => {
    const sum = Object.values(DIMENSION_WEIGHTS).reduce((s, v) => s + v, 0);
    expect(sum).toBe(100);
  });
});

describe("computeCompositeScore", () => {
  it("all-100 returns 100", () => {
    expect(computeCompositeScore(allDim(100))).toBe(100);
  });

  it("all-0 returns 0", () => {
    expect(computeCompositeScore(allDim(0))).toBe(0);
  });

  it("all-50 returns 50", () => {
    expect(computeCompositeScore(allDim(50))).toBe(50);
  });

  it("missing dimensions treated as 0", () => {
    const partial: DimensionScore[] = [
      { dimension: "user_value", score: 100, reasoning: "x", evidence: [] },
    ];
    const score = computeCompositeScore(partial);
    // user_value weight is 15/100 · so 100*15/100 = 15
    expect(score).toBeCloseTo(15, 5);
  });
});

describe("validateEvaluation", () => {
  it("accepts well-formed", () => {
    const r = validateEvaluation({
      ideaId: "idea-1",
      title: "New feature",
      summary: "Do a thing",
      dimensionScores: allDim(75, "reasoning"),
    });
    expect(r.ok).toBe(true);
  });

  it("rejects missing id", () => {
    const r = validateEvaluation({
      ideaId: "",
      title: "x",
      summary: "y",
      dimensionScores: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.idea_missing_id");
  });

  it("rejects out-of-range score", () => {
    const bad: DimensionScore[] = [{ dimension: "user_value", score: 150, reasoning: "x", evidence: [] }];
    const r = validateEvaluation({ ideaId: "i", title: "t", summary: "s", dimensionScores: bad });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.idea_score_out_of_range");
  });

  it("rejects missing reasoning", () => {
    const bad: DimensionScore[] = [{ dimension: "user_value", score: 50, reasoning: "", evidence: [] }];
    const r = validateEvaluation({ ideaId: "i", title: "t", summary: "s", dimensionScores: bad });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("sec.idea_reasoning_missing");
  });
});

describe("scoreBand", () => {
  it("75+ = STRONG", () => expect(scoreBand(80)).toBe("🟢 STRONG"));
  it("55-74 = CONSIDER", () => expect(scoreBand(60)).toBe("🟡 CONSIDER"));
  it("35-54 = WEAK", () => expect(scoreBand(40)).toBe("🟠 WEAK"));
  it("<35 = REJECT-CANDIDATE", () => expect(scoreBand(20)).toBe("🔴 REJECT-CANDIDATE"));
  it("edge 75 = STRONG", () => expect(scoreBand(75)).toBe("🟢 STRONG"));
  it("edge 35 = WEAK", () => expect(scoreBand(35)).toBe("🟠 WEAK"));
});
