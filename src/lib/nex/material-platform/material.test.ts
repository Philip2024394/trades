// Material Intelligence Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e3-e8-roadmap-and-design-history-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import {
  countMaterials, getMaterial, byCategory, byTag,
  byFireRatingAtLeast, underCarbonBudget, underCostPerM2, fscCertifiedOnly,
} from "./index";

describe("Material Intelligence Platform", () => {
  it("catalog seed has 15 authored materials", () => {
    expect(countMaterials()).toBeGreaterThanOrEqual(15);
  });

  it("every material is Rule-c attributable to Philip O'Farrell", () => {
    for (const m of [getMaterial("oak_american_white_satin_lacquer"), getMaterial("european_walnut_matt_lacquer"), getMaterial("glass_toughened_10mm")]) {
      expect(m?.provenance.named_expert).toBe("Philip O'Farrell");
      expect(m?.provenance.authored).toBe("2026-08-04");
    }
  });

  it("oak carries density + FSC + lifespan + patina", () => {
    const oak = getMaterial("oak_american_white_satin_lacquer");
    expect(oak?.density_kg_per_m3).toBe(720);
    expect(oak?.fsc_certified).toBe(true);
    expect(oak?.expected_lifespan_years).toBe(80);
    expect(oak?.patina_behaviour).toBeTruthy();
  });

  it("byCategory returns only matching materials", () => {
    const timbers = byCategory("timber");
    expect(timbers.length).toBeGreaterThan(0);
    for (const t of timbers) expect(t.category).toBe("timber");
  });

  it("byTag filters by tag", () => {
    const luxury = byTag("luxury");
    expect(luxury.length).toBeGreaterThan(0);
    for (const l of luxury) expect(l.tags).toContain("luxury");
  });

  it("byFireRatingAtLeast returns A1-rated materials when passed A1", () => {
    const nonCombustible = byFireRatingAtLeast("A1");
    // Steel · brass · aluminium · glass · quartz · granite · concrete are all A1
    expect(nonCombustible.length).toBeGreaterThanOrEqual(5);
    for (const m of nonCombustible) expect(m.fire_rating).toBe("A1");
  });

  it("byFireRatingAtLeast('B') includes A1 + A2 + B materials", () => {
    const withinB = byFireRatingAtLeast("B");
    for (const m of withinB) expect(["A1", "A2", "B"]).toContain(m.fire_rating);
  });

  it("underCarbonBudget respects the threshold", () => {
    const low = underCarbonBudget(0.5);
    for (const m of low) expect(m.carbon_kg_co2e_per_kg!).toBeLessThanOrEqual(0.5);
  });

  it("underCostPerM2 returns budget-friendly finishes", () => {
    const cheap = underCostPerM2(100);
    expect(cheap.length).toBeGreaterThan(0);
    for (const c of cheap) expect(c.cost_per_m2_gbp!).toBeLessThanOrEqual(100);
  });

  it("fscCertifiedOnly returns FSC-marked timbers/insulation", () => {
    const fsc = fscCertifiedOnly();
    expect(fsc.length).toBeGreaterThan(0);
    for (const f of fsc) expect(f.fsc_certified).toBe(true);
  });

  it("wood-fibre insulation has NEGATIVE embodied carbon (biogenic)", () => {
    const ins = getMaterial("wood_fibre_insulation");
    expect(ins?.carbon_kg_co2e_per_kg).toBeLessThan(0);
  });
});
