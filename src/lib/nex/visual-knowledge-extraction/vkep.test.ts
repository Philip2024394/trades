// Visual Knowledge Extraction Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { extract } from "./index";
import { clear as clearDesignMemory, get as getMemory } from "../design-memory";

beforeEach(() => clearDesignMemory());

describe("Visual Knowledge Extraction Platform (VKEP)", () => {
  it("photo ingestion produces vision_analysis + editable document + design memory entry (image kept only as evidence)", () => {
    const r = extract({
      kind: "photo",
      asset_id: "photo_001",
      project_id: "proj_a",
      hints: { known_object_types: ["staircase"], known_materials: ["oak"], known_room_type: "hallway", known_style: "traditional" },
    });
    expect(r.input_kind).toBe("photo");
    expect(r.vision_analysis).toBeDefined();
    expect(r.design_document.objects.length).toBeGreaterThan(0);
    expect(r.evidence_asset_ids).toContain("photo_001");
    expect(r.design_memory_entry_id).toBeTruthy();
    // Design Memory holds the KNOWLEDGE · the raw image is referenced as evidence only.
    const mem = getMemory(r.design_memory_entry_id!);
    expect(mem?.final_rendered_asset_id).toBe("photo_001");
    expect(mem?.design_document).toBeDefined();
  });

  it("sketch ingestion produces sketch_interpretation + editable document + memory entry", () => {
    const r = extract({
      kind: "sketch",
      sketch_id: "sk_001",
      project_id: "proj_b",
      source: "hand_paper",
      user_intent: "table lamp with round base",
      requested_material: "oak",
      requested_style: "scandinavian",
      detected_primitives: [{ kind: "circle" }, { kind: "line" }, { kind: "arc" }],
    });
    expect(r.input_kind).toBe("sketch");
    expect(r.sketch_interpretation).toBeDefined();
    expect(r.design_document.objects.length).toBeGreaterThan(0);
    expect(r.evidence_asset_ids).toContain("sk_001");
    const mem = getMemory(r.design_memory_entry_id!);
    expect(mem?.style_tags).toContain("scandinavian");
  });

  it("room_photos ingestion produces room_reconstruction + measurements + memory entry", () => {
    const r = extract({
      kind: "room_photos",
      reconstruction_id: "rr_001",
      project_id: "proj_c",
      photos: [
        { photo_id: "photo_kitchen_wide", hint_room_type: "kitchen", known_reference: { object_kind: "standard_uk_door", real_length_mm: 762, pixel_length: 500 } },
        { photo_id: "photo_kitchen_corner", hint_room_type: "kitchen" },
      ],
      room_type_hint: "kitchen",
    });
    expect(r.input_kind).toBe("room_photos");
    expect(r.room_reconstruction?.walls).toHaveLength(4);
    expect(r.evidence_asset_ids).toHaveLength(2);
    const mem = getMemory(r.design_memory_entry_id!);
    expect(mem?.measurements?.length).toBeGreaterThan(0);
    // Every measurement carries a confidence band (CORE constitutional)
    expect(mem?.measurements?.every((m) => Boolean(m.confidence))).toBe(true);
  });

  it("design memory entry design_document is STRUCTURED KNOWLEDGE (not pixel bytes)", () => {
    const r = extract({ kind: "photo", asset_id: "asset_pixels", project_id: "proj_d", hints: { known_object_types: ["kitchen"] } });
    const mem = getMemory(r.design_memory_entry_id!);
    expect(typeof mem?.design_document).toBe("object");
    // The design_document has 'objects' not 'bytes' · confirms it's knowledge not pixels.
    expect((mem?.design_document as { objects?: unknown }).objects).toBeDefined();
    expect((mem?.design_document as { bytes?: unknown }).bytes).toBeUndefined();
  });

  it("carries extractor_version + generated_at", () => {
    const r = extract({ kind: "photo", asset_id: "a", project_id: "p", hints: {} });
    expect(r.extractor_version).toContain("vkep");
    expect(r.generated_at).toBeTruthy();
  });
});
