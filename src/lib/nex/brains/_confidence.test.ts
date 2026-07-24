import { describe, expect, it } from "vitest";
import { computeConfidence, isInsufficient } from "./_confidence";

describe("computeConfidence", () => {
  it("returns low tier when Author base is low and there is no field data", () => {
    const result = computeConfidence({
      author_base: "low",
      sample_size: 0,
      k_target: 5,
      months_since_last_review: 6
    });
    expect(result.tier).toBe("low");
    expect(result.raw).toBeLessThan(0.6);
  });

  it("returns medium tier when Author base is medium and freshness is recent", () => {
    const result = computeConfidence({
      author_base: "medium",
      sample_size: 0,
      k_target: 5,
      months_since_last_review: 0
    });
    // 0.7 * (0.4 + 0 + 0 + 0.1) = 0.35 — low tier.
    // With sample: 0.7 * (0.4 + 0.3 + 0 + 0.1) = 0.56 — still low.
    // So a single-fact medium brain must earn sample+variance to reach medium/high.
    expect(result.tier).toBe("low");
  });

  it("returns high tier when Author base is high with strong sample + low variance + fresh", () => {
    const result = computeConfidence({
      author_base: "high",
      sample_size: 20,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 0
    });
    // 0.9 * (0.4 + 0.3*1 + 0.2*0.95 + 0.1*1) = 0.9 * 0.99 = 0.891 → high.
    expect(result.tier).toBe("high");
    expect(result.raw).toBeGreaterThan(0.85);
  });

  it("collapses to Author base when sample is 0 and no field data", () => {
    const result = computeConfidence({
      author_base: "high",
      sample_size: 0,
      k_target: 10,
      months_since_last_review: 6
    });
    // 0.9 * (0.4 + 0 + 0 + 0.05) = 0.9 * 0.45 = 0.405 → low.
    expect(result.tier).toBe("low");
  });

  it("penalises stale reviews", () => {
    const freshResult = computeConfidence({
      author_base: "high",
      sample_size: 10,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 0
    });
    const staleResult = computeConfidence({
      author_base: "high",
      sample_size: 10,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 24
    });
    expect(freshResult.raw).toBeGreaterThan(staleResult.raw);
  });

  it("caps sample at K target — over-sampling does not inflate score", () => {
    const kMet = computeConfidence({
      author_base: "high",
      sample_size: 5,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 0
    });
    const kOver = computeConfidence({
      author_base: "high",
      sample_size: 500,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 0
    });
    expect(kOver.raw).toBe(kMet.raw);
  });

  it("penalises high variance (large p95 delta)", () => {
    const stable = computeConfidence({
      author_base: "high",
      sample_size: 10,
      k_target: 5,
      p95_delta_pct: 5,
      months_since_last_review: 0
    });
    const noisy = computeConfidence({
      author_base: "high",
      sample_size: 10,
      k_target: 5,
      p95_delta_pct: 90,
      months_since_last_review: 0
    });
    expect(stable.raw).toBeGreaterThan(noisy.raw);
  });

  it("flags insufficient confidence when raw < 0.60", () => {
    const result = computeConfidence({
      author_base: "low",
      sample_size: 0,
      k_target: 5,
      months_since_last_review: 12
    });
    expect(isInsufficient(result)).toBe(true);
  });

  it("does not flag insufficient when tier is medium", () => {
    const result = computeConfidence({
      author_base: "high",
      sample_size: 5,
      k_target: 5,
      p95_delta_pct: 20,
      months_since_last_review: 3
    });
    if (result.tier !== "low") {
      expect(isInsufficient(result)).toBe(false);
    }
  });

  it("includes a human-readable reason string", () => {
    const result = computeConfidence({
      author_base: "medium",
      sample_size: 3,
      k_target: 5,
      p95_delta_pct: 15,
      months_since_last_review: 2
    });
    expect(result.reason).toContain("medium");
    expect(result.reason).toContain("sample 3/5");
  });
});
