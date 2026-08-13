// Multi-Modal Design Intelligence · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { ingest } from "./index";

describe("Multi-Modal Design Intelligence", () => {
  it("fuses a photo + a text prompt into one design document", () => {
    const r = ingest({
      request_id: "req_001",
      inputs: [
        { modality: "photo", asset_id: "p1", known_object_types: ["staircase"], known_materials: ["oak"], known_room_type: "hallway" },
        { modality: "text", utterance_id: "t1", text: "Add a walnut kitchen island please" },
      ],
    });
    expect(r.per_modality).toHaveLength(2);
    expect(r.design_document.source_kind).toBe("multi_modal");
    expect(r.design_document.objects.length).toBeGreaterThanOrEqual(2);
    expect(r.provenance_by_modality).toHaveLength(2);
  });

  it("stub modalities are gracefully skipped with a reason in provenance", () => {
    const r = ingest({
      request_id: "req_002",
      inputs: [
        { modality: "text", utterance_id: "t1", text: "oak staircase" },
        { modality: "cad", asset_id: "cad1", file_format: "dxf" },
      ],
    });
    expect(r.per_modality).toHaveLength(1);
    const cadProv = r.provenance_by_modality.find((p) => p.modality === "cad");
    expect(cadProv?.contribution).toContain("skipped");
    expect(cadProv?.confidence).toBe(0);
  });

  it("voice modality is dispatched via the text pipeline", () => {
    const r = ingest({
      request_id: "req_003",
      inputs: [{ modality: "voice", utterance_id: "v1", transcript: "design an oak wardrobe" }],
    });
    expect(r.design_document.objects.length).toBeGreaterThan(0);
  });

  it("fused_confidence is the mean of successful modality confidences", () => {
    const r = ingest({
      request_id: "req_004",
      inputs: [
        { modality: "photo", asset_id: "p1", known_object_types: ["staircase"], known_materials: ["oak"] },
        { modality: "text", utterance_id: "t1", text: "oak staircase" },
      ],
    });
    const mean = r.per_modality.reduce((s, m) => s + m.provenance.confidence, 0) / r.per_modality.length;
    expect(r.fused_confidence).toBeCloseTo(Math.round(mean * 100) / 100, 2);
  });

  it("provenance is recorded PER MODALITY (never blended without trace)", () => {
    const r = ingest({
      request_id: "req_005",
      inputs: [
        { modality: "photo", asset_id: "p1", known_object_types: ["kitchen"] },
        { modality: "sketch", sketch_id: "sk1", source: "hand_paper", user_intent: "table lamp", detected_primitives: [{ kind: "circle" }, { kind: "arc" }] },
      ],
    });
    const modalitiesRecorded = r.provenance_by_modality.map((p) => p.modality);
    expect(modalitiesRecorded).toContain("photo");
    expect(modalitiesRecorded).toContain("sketch");
  });

  it("carries orchestrator_version + generated_at", () => {
    const r = ingest({ request_id: "req_ver", inputs: [{ modality: "text", utterance_id: "u", text: "oak staircase" }] });
    expect(r.orchestrator_version).toContain("multimodal");
    expect(r.generated_at).toBeTruthy();
  });
});
