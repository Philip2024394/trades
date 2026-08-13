// Parametric Objects · tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { propagate, STAIRCASE_HEIGHT_RULES } from "./index";
import type { ParametricObject } from "./index";

describe("Parametric Objects", () => {
  it("propagate is PURE · returns new object · never mutates the input", () => {
    type Props = { height_mm: number; going_mm: number; tread_count: number; handrail_length_mm: number; led_length_mm: number };
    const stair: ParametricObject<Props> = {
      id: "stair_001",
      kind: "oak_staircase",
      properties: { height_mm: 2600, going_mm: 250, tread_count: 14, handrail_length_mm: 4000, led_length_mm: 4000 },
      rules: STAIRCASE_HEIGHT_RULES,
    };
    const { next } = propagate(stair, { property: "height_mm", before: 2600, after: 3040 });
    expect(stair.properties.height_mm).toBe(2600);                  // input untouched
    expect(next.properties.height_mm).toBe(3040);
    expect(next.properties.tread_count).toBeGreaterThan(14);
  });

  it("changing staircase height propagates to handrail + LED length", () => {
    type Props = { height_mm: number; going_mm: number; tread_count: number; handrail_length_mm: number; led_length_mm: number };
    const stair: ParametricObject<Props> = {
      id: "s", kind: "oak_staircase",
      properties: { height_mm: 2600, going_mm: 250, tread_count: 14, handrail_length_mm: 4000, led_length_mm: 4000 },
      rules: STAIRCASE_HEIGHT_RULES,
    };
    const { next, log } = propagate(stair, { property: "height_mm", before: 2600, after: 2850 });
    expect(next.properties.handrail_length_mm).toBeGreaterThan(next.properties.height_mm);
    expect(next.properties.led_length_mm).toBe(next.properties.handrail_length_mm);
    expect(log[0]).toContain("primary");
    expect(log.length).toBeGreaterThan(1);
  });

  it("no matching rule → no propagation · property still updates", () => {
    type Props = { height_mm: number; going_mm: number; tread_count: number; handrail_length_mm: number; led_length_mm: number };
    const stair: ParametricObject<Props> = {
      id: "s", kind: "oak_staircase",
      properties: { height_mm: 2600, going_mm: 250, tread_count: 14, handrail_length_mm: 4000, led_length_mm: 4000 },
      rules: STAIRCASE_HEIGHT_RULES,
    };
    const { next, log } = propagate(stair, { property: "going_mm", before: 250, after: 260 });
    expect(next.properties.going_mm).toBe(260);
    expect(log).toHaveLength(1);                                    // only primary · no propagations
  });
});
