// Wave P1 · MAI-supplied test scaffold per Capability Lab §12.
// Tests the NEX1-authored ranges.ts capability file.

import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_VERY_HIGH_FLOOR,
  CONFIDENCE_HIGH_FLOOR,
  CONFIDENCE_GOOD_FLOOR,
  CONFIDENCE_SCORE_RANGE,
} from "../ranges";

describe("P1 · ranges · bounds correctness (ADR-0025)", () => {
  it("MCR-1 · CONFIDENCE_VERY_HIGH_FLOOR min = 0.99, max = 1", () => {
    expect(CONFIDENCE_VERY_HIGH_FLOOR.min).toBe(0.99);
    expect(CONFIDENCE_VERY_HIGH_FLOOR.max).toBe(1);
  });

  it("MCR-2 · CONFIDENCE_HIGH_FLOOR min = 0.95, max = 1", () => {
    expect(CONFIDENCE_HIGH_FLOOR.min).toBe(0.95);
    expect(CONFIDENCE_HIGH_FLOOR.max).toBe(1);
  });

  it("MCR-3 · CONFIDENCE_GOOD_FLOOR min = 0.85, max = 1", () => {
    expect(CONFIDENCE_GOOD_FLOOR.min).toBe(0.85);
    expect(CONFIDENCE_GOOD_FLOOR.max).toBe(1);
  });

  it("MCR-4 · CONFIDENCE_SCORE_RANGE covers 0..1", () => {
    expect(CONFIDENCE_SCORE_RANGE.min).toBe(0);
    expect(CONFIDENCE_SCORE_RANGE.max).toBe(1);
  });

  it("MCR-5 · every range constant is frozen (immutable)", () => {
    expect(Object.isFrozen(CONFIDENCE_VERY_HIGH_FLOOR)).toBe(true);
    expect(Object.isFrozen(CONFIDENCE_HIGH_FLOOR)).toBe(true);
    expect(Object.isFrozen(CONFIDENCE_GOOD_FLOOR)).toBe(true);
    expect(Object.isFrozen(CONFIDENCE_SCORE_RANGE)).toBe(true);
  });

  it("MCR-6 · floors are ordered very-high > high > good", () => {
    expect(CONFIDENCE_VERY_HIGH_FLOOR.min).toBeGreaterThan(CONFIDENCE_HIGH_FLOOR.min);
    expect(CONFIDENCE_HIGH_FLOOR.min).toBeGreaterThan(CONFIDENCE_GOOD_FLOOR.min);
  });
});
