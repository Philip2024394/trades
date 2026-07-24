// Project-health aggregator + scoreMetric — pure function tests.

import { describe, it, expect } from "vitest";
import { computeProjectHealth, bandFor, scoreMetric } from "./health";
import type { AspectMetrics } from "./types";

function a(sub_score: number | null, weight = 1): AspectMetrics {
  return {
    aspect:       "timeline",
    label:        "Test",
    sub_score,
    weight,
    metrics:      [],
    observations: [],
    timeline:     []
  };
}

describe("computeProjectHealth", () => {
  it("returns 0/critical when no aspect scored", () => {
    const out = computeProjectHealth([a(null), a(null)]);
    expect(out.score).toBe(0);
    expect(out.band).toBe("critical");
    expect(out.headline).toContain("no activity");
  });

  it("weighted mean respects weights", () => {
    const out = computeProjectHealth([a(100, 2), a(20, 1)]);
    // 100*2 + 20*1 = 220 / 3 = 73.33 → 73
    expect(out.score).toBe(73);
  });

  it("skips null-scored aspects rather than penalising them", () => {
    const out = computeProjectHealth([a(80), a(null, 5)]);
    expect(out.score).toBe(80);
  });

  it("bands map correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(0)).toBe("critical");
  });
});

describe("scoreMetric", () => {
  it("clamps to [0,100]", () => {
    expect(scoreMetric(1000, { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(100);
    expect(scoreMetric(-5,   { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(0);
  });
  it("lower_is_better inverts", () => {
    expect(scoreMetric(60, { floor: 60, ceiling: 7, direction: "lower_is_better" })).toBe(0);
    expect(scoreMetric(7,  { floor: 60, ceiling: 7, direction: "lower_is_better" })).toBe(100);
  });
});
