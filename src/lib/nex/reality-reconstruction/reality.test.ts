// Reality Reconstruction Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { reconstructRoom } from "./index";

describe("Reality Reconstruction Platform", () => {
  it("reconstructs a rectangular starter room from 2 photos + one calibration reference", () => {
    const r = reconstructRoom(
      [
        { photo_id: "p1", camera_hint: "wide", hint_room_type: "kitchen", known_reference: { object_kind: "standard_uk_door", real_length_mm: 762, pixel_length: 500 } },
        { photo_id: "p2", camera_hint: "corner", hint_room_type: "kitchen" },
      ],
      { reconstruction_id: "r_kitchen_001" }
    );
    expect(r.room_type_guess).toBe("kitchen");
    expect(r.walls).toHaveLength(4);
    expect(r.openings.some((o) => o.kind === "window")).toBe(true);
    expect(r.openings.some((o) => o.kind === "door")).toBe(true);
    expect(r.floor.approx_area_m2).toBeGreaterThan(0);
    expect(r.ceiling.approx_height_mm).toBeGreaterThan(0);
  });

  it("requires at least one photo", () => {
    expect(() => reconstructRoom([], { reconstruction_id: "x" })).toThrow(/at least one photo/);
  });

  it("kitchen room hint adds pendant + downlight + under_cabinet lighting", () => {
    const r = reconstructRoom(
      [{ photo_id: "p1", hint_room_type: "kitchen" }],
      { reconstruction_id: "r_k_002" }
    );
    expect(r.lighting.length).toBeGreaterThanOrEqual(3);
    expect(r.lighting.some((l) => l.kind === "pendant")).toBe(true);
    expect(r.lighting.some((l) => l.kind === "under_cabinet")).toBe(true);
  });

  it("non-kitchen room hint returns baseline lighting + no cabinets", () => {
    const r = reconstructRoom(
      [{ photo_id: "p1", hint_room_type: "living_room" }],
      { reconstruction_id: "r_lr_001" }
    );
    expect(r.cabinets).toHaveLength(0);
  });

  it("without a calibration reference · overall_confidence downgrades from calibrated", () => {
    const withRef = reconstructRoom([{ photo_id: "p1", hint_room_type: "kitchen", known_reference: { object_kind: "door", real_length_mm: 762, pixel_length: 500 } }], { reconstruction_id: "wr" });
    const withoutRef = reconstructRoom([{ photo_id: "p2", hint_room_type: "kitchen" }], { reconstruction_id: "nr" });
    expect(withRef.overall_confidence.percent).toBeGreaterThan(withoutRef.overall_confidence.percent);
  });

  it("every measurement carries its confidence (constitutional: never hide the band)", () => {
    const r = reconstructRoom([{ photo_id: "p1", hint_room_type: "kitchen" }], { reconstruction_id: "cx" });
    for (const w of r.walls) expect(w.length_confidence.percent).toBeGreaterThan(0);
    for (const o of r.openings) expect(o.measurement_confidence.percent).toBeGreaterThan(0);
    expect(r.floor.area_confidence.percent).toBeGreaterThan(0);
    expect(r.ceiling.height_confidence.percent).toBeGreaterThan(0);
  });

  it("carries reconstructor_version + generated_at", () => {
    const r = reconstructRoom([{ photo_id: "p1" }], { reconstruction_id: "cv" });
    expect(r.reconstructor_version).toContain("reality_reconstruction");
    expect(r.generated_at).toBeTruthy();
  });
});
