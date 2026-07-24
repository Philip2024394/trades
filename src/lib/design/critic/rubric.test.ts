// Critic rubric — deterministic scoring tests.
// The AI critic returns per-axis scores; the rubric computes the
// weighted overall + approve/escalate flags. Those decisions must be
// stable across releases so the merchant always understands the bar.

import { describe, it, expect } from "vitest";
import {
  computeOverall,
  REGENERATE_THRESHOLD,
  HUMAN_ESCALATION_THRESHOLD,
  AXIS_WEIGHTS,
  type CriticScores
} from "./rubric";

function perfect(): CriticScores {
  const s = {} as CriticScores;
  for (const k of Object.keys(AXIS_WEIGHTS) as (keyof CriticScores)[]) s[k] = 100;
  return s;
}

function uniform(v: number): CriticScores {
  const s = {} as CriticScores;
  for (const k of Object.keys(AXIS_WEIGHTS) as (keyof CriticScores)[]) s[k] = v;
  return s;
}

describe("Design Critic rubric", () => {
  it("perfect scores → 100", () => {
    expect(computeOverall(perfect())).toBe(100);
  });

  it("all zeroes → 0", () => {
    expect(computeOverall(uniform(0))).toBe(0);
  });

  it("uniform 92 → 92 (approve threshold)", () => {
    const overall = computeOverall(uniform(92));
    expect(overall).toBe(92);
    expect(overall >= REGENERATE_THRESHOLD).toBe(true);
  });

  it("uniform 85 → 85 (escalation border)", () => {
    const overall = computeOverall(uniform(85));
    expect(overall).toBe(85);
    expect(overall >= HUMAN_ESCALATION_THRESHOLD).toBe(true);
    expect(overall < REGENERATE_THRESHOLD).toBe(true);
  });

  it("uniform 60 → 60 (below escalation)", () => {
    const overall = computeOverall(uniform(60));
    expect(overall).toBe(60);
    expect(overall < HUMAN_ESCALATION_THRESHOLD).toBe(true);
  });

  it("weights sum to 110 across 12 axes", () => {
    const sum = Object.values(AXIS_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(110);
  });

  it("mixed scores computed correctly", () => {
    const s = perfect();
    s.brand = 50;         // weight 10 → -500 from ideal
    s.premium = 50;       // weight 10 → -500
    // Weighted total drop = 1000 across weight 110 → -9.09
    const overall = computeOverall(s);
    expect(overall).toBeLessThan(100);
    expect(overall).toBeGreaterThan(85);
  });
});
