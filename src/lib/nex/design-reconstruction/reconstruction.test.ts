// Design Reconstruction Engine · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { reconstructFromVision, reconstructFromSketch } from "./index";
import { analyze } from "../vision-intelligence";
import { interpret } from "../sketch-intelligence";

describe("Design Reconstruction Engine", () => {
  it("reconstructs an editable document from a VisionAnalysis", () => {
    const analysis = analyze({
      source_asset_id: "asset_001",
      known_object_types: ["staircase", "kitchen_island"],
      known_materials: ["oak", "oak"],
      known_room_type: "kitchen",
      known_style: "scandinavian",
    });
    const doc = reconstructFromVision(analysis);
    expect(doc.source_kind).toBe("vision");
    expect(doc.objects).toHaveLength(2);
    expect(doc.objects[0].material).toBe("oak");
    expect(doc.objects[0].editable_properties).toContain("material");
    expect(doc.relationships.length).toBeGreaterThan(0);
    expect(doc.style_snapshot?.style_label).toBe("scandinavian");
  });

  it("reconstructs an editable document from a SketchInterpretation", () => {
    const interpretation = interpret({
      sketch_id: "sk_001",
      source: "hand_paper",
      user_intent: "table lamp with round base",
      requested_material: "oak",
      requested_style: "scandinavian",
      detected_primitives: [
        { kind: "circle", radius_pct: 0.15 },
        { kind: "line", points: [[0.5, 0.4], [0.5, 0.15]] },
        { kind: "arc", points: [[0.4, 0.15], [0.5, 0.05], [0.6, 0.15]] },
      ],
    });
    const doc = reconstructFromSketch(interpretation);
    expect(doc.source_kind).toBe("sketch");
    expect(doc.objects.length).toBeGreaterThan(0);
    expect(doc.objects.every((o) => o.kind.startsWith("table_lamp."))).toBe(true);
    expect(doc.scene_summary).toContain("scandinavian");
  });

  it("confidence_overall is 0..1", () => {
    const analysis = analyze({ source_asset_id: "a", known_object_types: ["staircase"] });
    const doc = reconstructFromVision(analysis);
    expect(doc.provenance.confidence_overall).toBeGreaterThanOrEqual(0);
    expect(doc.provenance.confidence_overall).toBeLessThanOrEqual(1);
  });

  it("every editable object traces back to a source evidence id", () => {
    const analysis = analyze({ source_asset_id: "a", known_object_types: ["staircase", "kitchen"] });
    const doc = reconstructFromVision(analysis);
    for (const o of doc.objects) {
      expect(o.source_evidence.length).toBeGreaterThan(0);
    }
  });

  it("carries reconstructor_version + generated_at", () => {
    const analysis = analyze({ source_asset_id: "a", known_object_types: ["thing"] });
    const doc = reconstructFromVision(analysis);
    expect(doc.provenance.reconstructor_version).toContain("reconstructor");
    expect(doc.provenance.generated_at).toBeTruthy();
  });
});
