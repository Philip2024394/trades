// Voice Intelligence Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { explain } from "./index";

describe("Voice Intelligence · explain()", () => {
  it("what_is returns the value at the requested path with evidence", () => {
    const r = explain({ intent: "what_is", target_path: "/staircase/handrail/material" }, { design_document: { staircase: { handrail: { material: "oak" } } } });
    expect(r.answer).toContain("oak");
    expect(r.evidence).toHaveLength(1);
    expect(r.evidence[0].source).toBe("design_document");
    expect(r.refused).toBeUndefined();
  });

  it("what_is REFUSES when the target path isn't in the document", () => {
    const r = explain({ intent: "what_is", target_path: "/nonexistent" }, { design_document: { staircase: {} } });
    expect(r.refused).toBeDefined();
    expect(r.confidence).toBe("low");
    expect(r.evidence).toHaveLength(0);
  });

  it("why_choice reads render_manifest provenance", () => {
    const r = explain(
      { intent: "why_choice", target_path: "/staircase/handrail" },
      {
        design_document: {},
        render_manifest: { provenance: { reasoning_chain: ["timber=oak matches shaker kitchen", "budget within £12000"], knowledge_citations: ["kb#oak-handrail-guide"], campaign_engine: "Family Kitchen Winter" } },
      }
    );
    expect(r.answer).toContain("shaker kitchen");
    expect(r.answer).toContain("Family Kitchen Winter");
    expect(r.evidence.length).toBeGreaterThan(0);
  });

  it("why_choice REFUSES when no provenance is recorded", () => {
    const r = explain({ intent: "why_choice" }, { design_document: {}, render_manifest: {} });
    expect(r.refused).toBeDefined();
    expect(r.answer).toContain("don't have enough");
  });

  it("can_be_built reads the reality report", () => {
    const r = explain({ intent: "can_be_built" }, {
      design_document: {},
      reality_report: { classification: "possible", scores: { reality_score: 78 }, concerns: [{ severity: "warn", message: "Concealed steel required" }] },
    });
    expect(r.answer).toContain("possible");
    expect(r.answer).toContain("78");
    expect(r.answer).toContain("Concealed steel");
  });

  it("how_wide reads a stored spatial measurement", () => {
    const r = explain({ intent: "how_wide", target_path: "/staircase/width" }, {
      design_document: {},
      spatial_measurements: { "/staircase/width": { value: 900, unit: "mm", confidence: { level: "calibrated", percent: 96 } } },
    });
    expect(r.answer).toContain("900");
    expect(r.confidence).toBe("high");
  });

  it("explain_evolution summarises the design history", () => {
    const r = explain({ intent: "explain_evolution" }, {
      design_document: {},
      design_history: {
        entries: [
          { version: 1, operation: { kind: "set_property", target_path: "/staircase/handrail/material", reason: "customer prefers walnut" } },
          { version: 2, operation: { kind: "replace_material", target_path: "/kitchen/worktop/material", reason: "budget adjustment" } },
        ],
      },
    });
    expect(r.answer).toContain("v1");
    expect(r.answer).toContain("v2");
    expect(r.answer).toContain("walnut");
  });

  it("show_alternatives requires stored alternatives · refuses otherwise", () => {
    expect(explain({ intent: "show_alternatives" }, { design_document: {} }).refused).toBeDefined();
    const r = explain({ intent: "show_alternatives" }, { design_document: {}, recommendations: [{}, {}, {}] });
    expect(r.refused).toBeUndefined();
    expect(r.answer).toContain("3");
  });

  it("custom intent refuses (Voice never invents)", () => {
    const r = explain({ intent: "custom" }, { design_document: {} });
    expect(r.refused).toBeDefined();
  });
});
