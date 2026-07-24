// Health-score aggregator — pure function tests.

import { describe, it, expect } from "vitest";
import { computeHealth, bandFor, scoreMetric } from "./health";
import type { DomainMetrics } from "./types";

function d(sub_score: number | null, weight = 1): DomainMetrics {
  return {
    domain:       "projects",
    label:        "Test",
    sub_score,
    weight,
    metrics:      [],
    observations: []
  };
}

describe("computeHealth", () => {
  it("returns 0/critical when no domain scored", () => {
    const out = computeHealth([d(null), d(null)]);
    expect(out.score).toBe(0);
    expect(out.band).toBe("critical");
    expect(out.headline).toContain("no data yet");
  });

  it("simple mean when weights are equal", () => {
    const out = computeHealth([d(80), d(60), d(40)]);
    expect(out.score).toBe(60);
  });

  it("respects weights", () => {
    // 90 * 2 + 30 * 1 = 210 / 3 = 70
    const out = computeHealth([d(90, 2), d(30, 1)]);
    expect(out.score).toBe(70);
  });

  it("skips null-scored domains rather than penalising them", () => {
    // Only the 80 counts.
    const out = computeHealth([d(80), d(null, 5), d(null)]);
    expect(out.score).toBe(80);
  });

  it("bands map to score correctly", () => {
    expect(bandFor(95)).toBe("excellent");
    expect(bandFor(75)).toBe("healthy");
    expect(bandFor(60)).toBe("steady");
    expect(bandFor(40)).toBe("attention");
    expect(bandFor(0)).toBe("critical");
  });

  it("clamps score to 0–100", () => {
    // Even if a broken adapter reports >100, the aggregator clamps.
    expect(computeHealth([d(150)]).score).toBeLessThanOrEqual(100);
    expect(computeHealth([d(-50)]).score).toBeGreaterThanOrEqual(0);
  });
});

describe("scoreMetric", () => {
  it("higher_is_better maps floor→0 and ceiling→100", () => {
    expect(scoreMetric(0,  { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(0);
    expect(scoreMetric(10, { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(100);
    expect(scoreMetric(5,  { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(50);
  });

  it("lower_is_better maps floor→0 and ceiling→100 in reverse", () => {
    // floor 60 (bad, scores 0), ceiling 7 (good, scores 100)
    expect(scoreMetric(60, { floor: 60, ceiling: 7, direction: "lower_is_better" })).toBe(0);
    expect(scoreMetric(7,  { floor: 60, ceiling: 7, direction: "lower_is_better" })).toBe(100);
  });

  it("clamps outside the range", () => {
    expect(scoreMetric(999, { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(100);
    expect(scoreMetric(-5,  { floor: 0, ceiling: 10, direction: "higher_is_better" })).toBe(0);
  });

  it("returns 50 when floor === ceiling to avoid divide-by-zero", () => {
    expect(scoreMetric(5, { floor: 5, ceiling: 5, direction: "higher_is_better" })).toBe(50);
  });
});
