// Composition Platform · detector tests.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { detectOverlaps, detectSafeMarginViolations, detectOffGrid, compose } from "./index";
import type { CompositionProblem } from "./index";

const CANVAS = { width_px: 1200, height_px: 628, safe_margin_px: 40 };

describe("Composition Platform · MVP detectors", () => {
  it("detects overlapping layers on the same z-index", () => {
    const problem: CompositionProblem = {
      canvas: CANVAS,
      layers: [
        { id: "a", z_index: 10, box: { x: 100, y: 100, width: 200, height: 100 } },
        { id: "b", z_index: 10, box: { x: 150, y: 120, width: 200, height: 100 } },
      ],
    };
    const v = detectOverlaps(problem);
    expect(v).toHaveLength(1);
    expect(v[0].layer_ids).toContain("a");
    expect(v[0].layer_ids).toContain("b");
  });

  it("does NOT flag overlap across different z-indexes (compositing is intended)", () => {
    const problem: CompositionProblem = {
      canvas: CANVAS,
      layers: [
        { id: "hero", z_index: 5, box: { x: 100, y: 100, width: 500, height: 400 } },
        { id: "headline", z_index: 10, box: { x: 150, y: 150, width: 300, height: 100 } },
      ],
    };
    expect(detectOverlaps(problem)).toHaveLength(0);
  });

  it("flags safe margin violations", () => {
    const problem: CompositionProblem = {
      canvas: CANVAS,
      layers: [
        { id: "edge", z_index: 10, box: { x: 10, y: 100, width: 200, height: 100 } },   // x < margin
        { id: "safe", z_index: 10, box: { x: 100, y: 100, width: 200, height: 100 } },
      ],
    };
    const v = detectSafeMarginViolations(problem);
    expect(v).toHaveLength(1);
    expect(v[0].layer_ids[0]).toBe("edge");
  });

  it("compose returns metrics + preserves layer positions", () => {
    const problem: CompositionProblem = {
      canvas: CANVAS,
      layers: [
        { id: "a", z_index: 10, box: { x: 100, y: 100, width: 200, height: 100 } },
        { id: "b", z_index: 10, box: { x: 150, y: 120, width: 200, height: 100 } },
      ],
    };
    const r = compose(problem);
    expect(r.metrics.overlap_count).toBe(1);
    expect(r.resolved_layers).toHaveLength(2);
    expect(r.applied_rules).toContain("overlap");
  });

  it("detectOffGrid flags when a grid is defined and layer is off-grid", () => {
    const problem: CompositionProblem = {
      canvas: CANVAS,
      grid: { columns: 12, gutter_px: 20, margin_px: 40, baseline_px: 8 },
      layers: [
        { id: "off", z_index: 10, box: { x: 47, y: 63, width: 100, height: 40 } },
      ],
    };
    const v = detectOffGrid(problem);
    expect(v.length).toBeGreaterThan(0);
  });
});
