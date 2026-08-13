// Vision Intelligence Platform · MVP analyzer tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { analyze } from "./index";

describe("Vision Intelligence Platform", () => {
  it("produces objects · shapes · scene from caller hints", () => {
    const r = analyze({
      source_asset_id: "asset_001",
      known_object_types: ["staircase", "kitchen_island"],
      known_materials: ["oak", "oak"],
      known_room_type: "kitchen",
      known_style: "scandinavian",
    });
    expect(r.objects).toHaveLength(2);
    expect(r.objects[0].type).toBe("staircase");
    expect(r.scene.room_type).toBe("kitchen");
    expect(r.scene.style).toBe("scandinavian");
  });

  it("mood profile scores warm palettes highly", () => {
    const r = analyze({
      source_asset_id: "warm_room",
      known_object_types: ["worktop"],
      known_materials: ["oak", "brass", "cream"],
      known_palette: ["oak", "brass", "cream"],
      known_lighting: "warm_white",
    });
    expect(r.mood.overall_warmth_score).toBeGreaterThanOrEqual(70);
    expect(r.mood.colour_temperature).toBe("warm");
  });

  it("mood profile scores cool industrial palettes low", () => {
    const r = analyze({
      source_asset_id: "cool_room",
      known_object_types: ["staircase"],
      known_materials: ["steel", "concrete", "charcoal"],
      known_palette: ["steel", "concrete", "charcoal"],
    });
    expect(r.mood.overall_warmth_score).toBeLessThanOrEqual(30);
    expect(r.mood.colour_temperature).toBe("cool");
    expect(r.mood.mood_label).toBe("industrial");
  });

  it("Style DNA weights are normalised to sum ≈ 1", () => {
    const r = analyze({
      source_asset_id: "asset_dna",
      known_object_types: ["staircase", "kitchen"],
      known_materials: ["oak", "brass"],
      known_style: "traditional",
    });
    const sum = Object.values(r.style_dna.weights).reduce((s, v) => s + v, 0);
    expect(sum).toBeGreaterThanOrEqual(0.98);
    expect(sum).toBeLessThanOrEqual(1.02);
    expect(r.style_dna.timber).toBe("oak");
    expect(r.style_dna.hardware).toBe("brass");
  });

  it("relationships include matches_material for shared materials", () => {
    const r = analyze({
      source_asset_id: "asset_rel",
      known_object_types: ["staircase", "flooring", "doors"],
      known_materials: ["oak", "oak", "oak"],
    });
    expect(r.relationships.length).toBeGreaterThan(0);
    expect(r.relationships.every((e) => e.kind === "matches_material")).toBe(true);
  });

  it("knowledge_graph mirrors image → room → objects hierarchy", () => {
    const r = analyze({
      source_asset_id: "img_1",
      known_object_types: ["staircase"],
      known_room_type: "hallway",
    });
    expect(r.knowledge_graph.kind).toBe("image");
    expect(r.knowledge_graph.children?.[0].kind).toBe("room");
    expect(r.knowledge_graph.children?.[0].children?.[0].kind).toBe("object");
  });

  it("contrast is 'high' when palette mixes light + dark", () => {
    const r = analyze({
      source_asset_id: "high_contrast",
      known_object_types: ["kitchen"],
      known_materials: ["oak", "charcoal"],
      known_palette: ["oak", "charcoal"],
    });
    expect(r.mood.contrast).toBe("high");
  });

  it("carries analyser_version + generated_at", () => {
    const r = analyze({ source_asset_id: "x", known_object_types: ["thing"] });
    expect(r.analyser_version).toContain("vision");
    expect(r.generated_at).toBeTruthy();
  });
});
