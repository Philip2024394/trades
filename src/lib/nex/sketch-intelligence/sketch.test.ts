// Sketch Intelligence Platform · MVP tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { interpret } from "./index";

describe("Sketch Intelligence Platform (SIP)", () => {
  it("interprets a lamp sketch · circle base + arc shade", () => {
    const r = interpret({
      sketch_id: "sk_lamp_001",
      source: "hand_paper",
      user_intent: "table lamp with round base and cone shade",
      requested_material: "oak",
      requested_style: "scandinavian",
      detected_primitives: [
        { kind: "circle", radius_pct: 0.15 },
        { kind: "line", points: [[0.5, 0.4], [0.5, 0.15]] },
        { kind: "arc", points: [[0.4, 0.15], [0.5, 0.05], [0.6, 0.15]] },
      ],
    });
    expect(r.object_match.object_kind).toBe("table_lamp");
    expect(r.object_match.similarity).toBeGreaterThan(0.9);
    expect(r.materials[0]?.material_id).toContain("oak");
    expect(r.components.some((c) => c.role === "base")).toBe(true);
    expect(r.style.style).toBe("scandinavian");
  });

  it("interprets a staircase sketch", () => {
    const r = interpret({
      sketch_id: "sk_stair_001",
      source: "cad_line",
      user_intent: "oak staircase with glass balustrade",
      requested_material: "oak",
      requested_style: "traditional",
      detected_primitives: [
        { kind: "line", points: [[0, 0.8], [0.3, 0.8]] },
        { kind: "line", points: [[0.3, 0.6], [0.6, 0.6]] },
        { kind: "line", points: [[0.6, 0.4], [0.9, 0.4]] },
      ],
    });
    expect(r.object_match.object_kind).toBe("staircase");
    expect(r.components.some((c) => c.role === "tread")).toBe(true);
    expect(r.components.some((c) => c.role === "riser")).toBe(true);
    expect(r.construction_checks.some((c) => c.concern.includes("Part K"))).toBe(true);
  });

  it("reports per-component confidence + notes (Nex never pretends)", () => {
    const r = interpret({
      sketch_id: "sk_lamp_002",
      source: "hand_paper",
      user_intent: "table lamp",
      requested_material: "oak",
      detected_primitives: [{ kind: "circle" }, { kind: "arc" }],
    });
    expect(r.confidence.overall_confidence).toBeGreaterThan(0);
    expect(r.confidence.overall_confidence).toBeLessThan(1);
    expect(r.confidence.per_component.cmp_switch).toBeLessThan(0.75);
    expect(r.confidence.notes.some((n) => n.includes("switch"))).toBe(true);
  });

  it("matches materials from catalog when requested_material is known", () => {
    const r = interpret({
      sketch_id: "sk_mat_001", source: "hand_paper",
      user_intent: "table lamp", requested_material: "walnut",
    });
    expect(r.materials[0]?.material_id).toContain("walnut");
    expect(r.materials[0]?.reason).toContain("walnut");
  });

  it("returns empty materials when no material requested", () => {
    const r = interpret({
      sketch_id: "sk_no_mat", source: "hand_paper", user_intent: "table lamp",
    });
    expect(r.materials).toHaveLength(0);
  });

  it("unknown intent → object_kind='unknown' with low similarity + review flag", () => {
    const r = interpret({
      sketch_id: "sk_unknown", source: "concept_art",
      detected_primitives: [{ kind: "line" }, { kind: "curve" }],
    });
    expect(r.object_match.object_kind).toBe("unknown");
    expect(r.object_match.similarity).toBeLessThanOrEqual(0.5);
    expect(r.object_match.reason).toContain("review");
  });

  it("style match declares which roles it applies to", () => {
    const r = interpret({
      sketch_id: "sk_style", source: "hand_paper",
      user_intent: "table lamp", requested_style: "industrial",
    });
    expect(r.style.applies_to).toContain("material");
    expect(r.style.applies_to).toContain("colour");
  });

  it("carries interpreter_version + generated_at", () => {
    const r = interpret({ sketch_id: "sk_x", source: "hand_paper", user_intent: "table lamp" });
    expect(r.interpreter_version).toContain("sketch");
    expect(r.generated_at).toBeTruthy();
  });
});
