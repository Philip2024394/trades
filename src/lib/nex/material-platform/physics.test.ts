// Material Physics · tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { getPhysics, listPhysics } from "./index";

describe("Material Physics", () => {
  it("catalogs physics for the key materials", () => {
    expect(listPhysics().length).toBeGreaterThanOrEqual(6);
  });

  it("oak has hardness + moisture movement + gentle amber ageing", () => {
    const p = getPhysics("oak_american_white_satin_lacquer");
    expect(p?.janka_hardness_lbf).toBe(1360);
    expect(p?.moisture_movement_pct_per_pct_mc).toBeGreaterThan(0);
    expect(p?.uv_ageing_10yr).toBe("gentle_amber");
  });

  it("pine is easy to machine + absorbs oil highly + yellows over time", () => {
    const p = getPhysics("scandinavian_pine");
    expect(p?.machining).toBe("easy");
    expect(p?.oil_absorption).toBe("high");
    expect(p?.uv_ageing_10yr).toBe("significant_yellowing");
  });

  it("glass paint adhesion is not_recommended (constitutional accuracy)", () => {
    const p = getPhysics("glass_toughened_10mm");
    expect(p?.paint_adhesion).toBe("not_recommended");
  });

  it("steel requires carbide tooling + accepts paint excellently", () => {
    const p = getPhysics("steel_black_powder_coated");
    expect(p?.machining).toBe("requires_carbide");
    expect(p?.paint_adhesion).toBe("excellent");
  });

  it("every physics record carries Rule-c provenance", () => {
    for (const p of listPhysics()) {
      expect(p.provenance.named_expert).toBe("Philip O'Farrell");
      expect(p.provenance.authored).toBe("2026-08-04");
    }
  });
});
