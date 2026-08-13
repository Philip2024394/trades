// Pattern Learning Engine · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { observe, mine, what_pairs_with, count, clear } from "./index";

beforeEach(() => clear());

function obs(id: string, features: Record<string, string>) {
  observe({ observation_id: id, captured_at: new Date().toISOString(), features });
}

describe("Pattern Learning Engine", () => {
  it("observe + count", () => {
    obs("o1", { timber: "oak" });
    obs("o2", { timber: "walnut" });
    expect(count()).toBe(2);
  });

  it("mine surfaces high-confidence oak → warm_white pairing after enough evidence", () => {
    // 5 oak+warm_white observations · 2 oak+cool_white
    for (let i = 0; i < 5; i++) obs(`ow${i}`, { timber: "oak", lighting: "warm_white" });
    for (let i = 0; i < 2; i++) obs(`oc${i}`, { timber: "oak", lighting: "cool_white" });
    const oakPairings = what_pairs_with("timber", "oak");
    const oakWarm = oakPairings.find((p) => p.consequent.feature === "lighting" && p.consequent.value === "warm_white");
    expect(oakWarm).toBeDefined();
    expect(oakWarm?.confidence).toBeCloseTo(5 / 7, 2);
    expect(oakWarm?.support).toBe(5);
  });

  it("mine respects min_support + min_confidence thresholds", () => {
    for (let i = 0; i < 3; i++) obs(`a${i}`, { timber: "oak", handrail: "glass" });
    for (let i = 0; i < 10; i++) obs(`b${i}`, { timber: "oak", handrail: "steel" });
    // oak → glass has support 3 but confidence 3/13 ≈ 0.23 · should be excluded at min_confidence 0.5
    const strict = what_pairs_with("timber", "oak", 2, 0.5);
    expect(strict.some((p) => p.consequent.value === "glass")).toBe(false);
    // With min_confidence 0.1 · glass reappears
    const loose = what_pairs_with("timber", "oak", 2, 0.1);
    expect(loose.some((p) => p.consequent.value === "glass")).toBe(true);
  });

  it("mine surfaces multi-feature pairings across the whole corpus", () => {
    for (let i = 0; i < 4; i++) obs(`m${i}`, { timber: "oak", lighting: "warm_white", hardware: "matt_black" });
    const pairings = mine(2, 0.5);
    // oak → matt_black
    expect(pairings.some((p) => p.antecedent.value === "oak" && p.consequent.value === "matt_black")).toBe(true);
    // matt_black → oak
    expect(pairings.some((p) => p.antecedent.value === "matt_black" && p.consequent.value === "oak")).toBe(true);
  });

  it("results are sorted by descending confidence then support", () => {
    for (let i = 0; i < 5; i++) obs(`a${i}`, { timber: "oak", lighting: "warm_white" });
    for (let i = 0; i < 4; i++) obs(`b${i}`, { timber: "oak", lighting: "cool_white" });
    for (let i = 0; i < 3; i++) obs(`c${i}`, { timber: "walnut", lighting: "warm_white" });
    const all = mine(2, 0.5);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].confidence).toBeGreaterThanOrEqual(all[i].confidence);
    }
  });
});
