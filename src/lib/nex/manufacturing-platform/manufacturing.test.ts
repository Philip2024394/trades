// Manufacturing Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { planManufacturing } from "./index";

describe("Manufacturing Platform", () => {
  it("plans a staircase with steps · cutting list · installation sequence", () => {
    const p = planManufacturing({ object_id: "s_001", object_kind: "staircase", material_id: "oak_american_white_satin_lacquer", dimensions_mm: { width: 900, height: 2660, length: 3600 } });
    expect(p.steps.length).toBeGreaterThanOrEqual(6);
    expect(p.cutting_list.length).toBeGreaterThanOrEqual(3);
    expect(p.installation_sequence.length).toBeGreaterThanOrEqual(4);
    expect(p.total_labour_min).toBeGreaterThan(0);
  });

  it("staircase cutting list reflects the tread count derived from height", () => {
    const p = planManufacturing({ object_id: "s_002", object_kind: "staircase", material_id: "oak", dimensions_mm: { height: 2660 } });
    const treads = p.cutting_list.find((c) => c.item_id === "cl_tread");
    expect(treads?.qty).toBeGreaterThan(10);
    expect(treads?.qty).toBeLessThan(20);
  });

  it("plans a kitchen island with panels + edge banding + door fit", () => {
    const p = planManufacturing({ object_id: "k_001", object_kind: "kitchen_island", material_id: "oak", dimensions_mm: { length: 2400, width: 900 } });
    expect(p.cutting_list.some((c) => c.item_id === "cl_top_panel")).toBe(true);
    expect(p.installation_sequence.some((i) => i.description.includes("Template worktop"))).toBe(true);
  });

  it("staircase installation flags Building Regs safety notes", () => {
    const p = planManufacturing({ object_id: "s_003", object_kind: "staircase", material_id: "oak", dimensions_mm: {} });
    expect(p.installation_sequence.some((i) => (i.safety_notes ?? "").includes("regs handrail"))).toBe(true);
  });

  it("carries Rule-c provenance", () => {
    const p = planManufacturing({ object_id: "s_004", object_kind: "staircase", material_id: "oak", dimensions_mm: {} });
    expect(p.provenance.named_expert).toBe("Philip O'Farrell");
  });

  it("unsupported object_kind returns empty plans · caller decides fallback", () => {
    const p = planManufacturing({ object_id: "unknown", object_kind: "other", material_id: "oak", dimensions_mm: {} });
    expect(p.steps).toHaveLength(0);
    expect(p.cutting_list).toHaveLength(0);
    expect(p.installation_sequence).toHaveLength(0);
  });
});
