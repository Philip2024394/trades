// Universal Design Language · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { convert } from "./index";

describe("Universal Design Language (UDL)", () => {
  it("photo modality produces an EditableDesignDocument", () => {
    const r = convert({
      modality: "photo",
      asset_id: "photo_001",
      known_object_types: ["staircase"],
      known_materials: ["oak"],
      known_room_type: "hallway",
    });
    expect(r.input_modality).toBe("photo");
    expect(r.design_document.source_kind).toBe("vision");
    expect(r.design_document.objects.length).toBeGreaterThan(0);
    expect(r.provenance.confidence).toBeGreaterThan(0);
  });

  it("sketch modality produces an EditableDesignDocument", () => {
    const r = convert({
      modality: "sketch",
      sketch_id: "sk_001",
      source: "hand_paper",
      user_intent: "table lamp with round base",
      requested_material: "oak",
      requested_style: "scandinavian",
      detected_primitives: [{ kind: "circle" }, { kind: "line" }, { kind: "arc" }],
    });
    expect(r.input_modality).toBe("sketch");
    expect(r.design_document.source_kind).toBe("sketch");
    expect(r.design_document.objects.length).toBeGreaterThan(0);
  });

  it("text modality parses staircase + oak from free text", () => {
    const r = convert({ modality: "text", utterance_id: "t1", text: "Design an oak staircase for the hallway" });
    expect(r.input_modality).toBe("text");
    expect(r.design_document.objects.some((o) => o.kind === "staircase")).toBe(true);
    expect(r.design_document.objects[0].material).toBe("oak");
  });

  it("voice modality routes through text pipeline via transcript", () => {
    const r = convert({ modality: "voice", utterance_id: "v1", transcript: "Design a walnut kitchen island please" });
    expect(r.input_modality).toBe("voice");
    expect(r.design_document.objects.some((o) => o.kind === "kitchen_island")).toBe(true);
  });

  it("stubs throw a clear phased-not-yet message", () => {
    expect(() => convert({ modality: "cad", asset_id: "c1", file_format: "dxf" })).toThrow(/stub/);
    expect(() => convert({ modality: "pdf", asset_id: "p1" })).toThrow(/stub/);
    expect(() => convert({ modality: "scan_3d", asset_id: "s1", file_format: "ply" })).toThrow(/stub/);
    expect(() => convert({ modality: "video", asset_id: "v1" })).toThrow(/stub/);
  });

  it("every result carries converter_version + generated_at", () => {
    const r = convert({ modality: "text", utterance_id: "cv", text: "oak staircase" });
    expect(r.provenance.converter_version).toContain("udl");
    expect(r.provenance.generated_at).toBeTruthy();
  });
});
