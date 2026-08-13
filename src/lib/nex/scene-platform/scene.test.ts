// Scene Intelligence Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { floorAreaM2, roomVolumeM3, totalWallLengthMm, rectangularRoom } from "./index";

describe("Scene Intelligence Platform", () => {
  it("rectangularRoom composes 4 walls · a floor · a ceiling", () => {
    const room = rectangularRoom({ id: "kitchen_001", kind: "kitchen", width_mm: 5000, depth_mm: 4000, ceiling_height_mm: 2500, named_expert: "Philip O'Farrell" });
    expect(room.walls).toHaveLength(4);
    expect(room.floor).toBeDefined();
    expect(room.ceiling.height_mm).toBe(2500);
  });

  it("floorAreaM2 returns 20 m² for a 5m × 4m kitchen", () => {
    const room = rectangularRoom({ id: "k", kind: "kitchen", width_mm: 5000, depth_mm: 4000, ceiling_height_mm: 2500, named_expert: "Philip O'Farrell" });
    expect(floorAreaM2(room.floor)).toBeCloseTo(20);
  });

  it("roomVolumeM3 = 20 m² × 2.5m = 50 m³", () => {
    const room = rectangularRoom({ id: "k", kind: "kitchen", width_mm: 5000, depth_mm: 4000, ceiling_height_mm: 2500, named_expert: "Philip O'Farrell" });
    expect(roomVolumeM3(room)).toBeCloseTo(50);
  });

  it("totalWallLengthMm = perimeter (2×(width+depth))", () => {
    const room = rectangularRoom({ id: "k", kind: "kitchen", width_mm: 5000, depth_mm: 4000, ceiling_height_mm: 2500, named_expert: "Philip O'Farrell" });
    expect(totalWallLengthMm(room)).toBeCloseTo(18000);
  });

  it("carries Rule-c provenance", () => {
    const room = rectangularRoom({ id: "k", kind: "kitchen", width_mm: 5000, depth_mm: 4000, ceiling_height_mm: 2500, named_expert: "Philip O'Farrell" });
    expect(room.provenance.named_expert).toBe("Philip O'Farrell");
  });
});
