// Reality Advisor · MVP tests.
//
// Doctrine: docs/brains/nex-phase-e2-unified-platforms-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { advise, REALISM_ORDER } from "./index";

describe("Reality Advisor", () => {
  it("declares 7 classification levels in constitutional order", () => {
    expect(REALISM_ORDER).toEqual([
      "realistic", "possible", "requires_engineering", "requires_structural_changes",
      "building_regulations_required", "not_recommended", "impossible",
    ]);
  });

  it("clean simple design classifies as realistic with full reality score", () => {
    const r = advise({
      domain: "kitchen",
      design_summary: "Standard shaker oak kitchen with island (2.4m worktop).",
      location: "domestic",
      budget_estimate_gbp: 12000,
    });
    expect(r.classification).toBe("realistic");
    expect(r.scores.reality_score).toBe(100);
    expect(r.concerns).toHaveLength(0);
  });

  it("flags floating no-support staircase as requiring engineering", () => {
    const r = advise({
      domain: "staircase",
      design_summary: "Floating oak staircase with no support",
      location: "domestic",
    });
    expect(r.classification).toBe("requires_engineering");
    expect(r.concerns.some((c) => c.category === "structural")).toBe(true);
    expect(r.scores.construction_score).toBeLessThan(100);
  });

  it("flags 4m unsupported island as structural warn + installation info", () => {
    const r = advise({
      domain: "kitchen",
      design_summary: "4 metre kitchen island with no support",
      location: "domestic",
    });
    expect(r.concerns.length).toBeGreaterThanOrEqual(2);
    expect(r.concerns.some((c) => c.category === "structural")).toBe(true);
    expect(r.concerns.some((c) => c.category === "installation")).toBe(true);
  });

  it("flags commercial staircase without width as regs required", () => {
    const r = advise({
      domain: "staircase",
      design_summary: "Straight oak staircase for retail unit",
      location: "commercial",
    });
    expect(r.classification).toBe("building_regulations_required");
    expect(r.scores.building_regulation_score).toBeLessThan(100);
  });

  it("flags underfunded bespoke walnut work as cost warn", () => {
    const r = advise({
      domain: "joinery",
      design_summary: "Bespoke walnut media wall",
      budget_estimate_gbp: 800,
    });
    expect(r.concerns.some((c) => c.category === "cost")).toBe(true);
    expect(r.scores.budget_score).toBeLessThan(100);
  });

  it("advisor never mutates the query and never returns a design change", () => {
    const q = { domain: "staircase" as const, design_summary: "Glass tread staircase, domestic use.", location: "domestic" as const };
    const before = JSON.stringify(q);
    const r = advise(q);
    // Constitutional: advisor advises · never redesigns
    expect(JSON.stringify(q)).toBe(before);
    // Only concerns · scores · classification · reasoning · timestamps are returned
    expect(Object.keys(r).sort()).toEqual(["advisor_version", "classification", "concerns", "generated_at", "reasoning", "scores"]);
  });

  it("scores are bounded 0-100 across all 7 dimensions", () => {
    const r = advise({ domain: "kitchen", design_summary: "4 metre island with no support", budget_estimate_gbp: 500 });
    for (const s of Object.values(r.scores)) {
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });
});
