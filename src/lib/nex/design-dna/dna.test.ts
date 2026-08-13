// Design DNA Engine · tests.
//
// Doctrine: docs/brains/nex-phase-e10-e15-reconstruction-udl-multimodal-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { computeDesignDNA, similarity } from "./index";
import { analyze } from "../vision-intelligence";

describe("Design DNA Engine", () => {
  it("aggregates a project fingerprint from multiple vision analyses", () => {
    const a1 = analyze({ source_asset_id: "a1", known_object_types: ["staircase", "kitchen_island"], known_materials: ["oak", "brass"], known_style: "traditional" });
    const a2 = analyze({ source_asset_id: "a2", known_object_types: ["worktop", "sink"], known_materials: ["oak", "brass"], known_style: "traditional" });
    const dna = computeDesignDNA("proj_smith", [a1, a2]);
    expect(dna.sample_size).toBe(2);
    expect(dna.timber).toBe("oak");
    expect(dna.hardware).toBe("brass");
    const styleSum = Object.values(dna.style_weights).reduce((s, v) => s + v, 0);
    expect(styleSum).toBeGreaterThanOrEqual(0.98);
    expect(styleSum).toBeLessThanOrEqual(1.02);
  });

  it("complexity scales with object count", () => {
    const a = analyze({ source_asset_id: "a", known_object_types: ["staircase"] });
    expect(computeDesignDNA("proj_a", [a]).complexity).toBe("very_low");
    const b = analyze({ source_asset_id: "b", known_object_types: Array.from({ length: 15 }, (_, i) => `obj_${i}`) });
    expect(computeDesignDNA("proj_b", [b]).complexity).toBe("high");
  });

  it("similarity is high between two matching project DNAs", () => {
    const a = analyze({ source_asset_id: "a", known_object_types: ["staircase"], known_materials: ["oak"], known_style: "traditional" });
    const dna1 = computeDesignDNA("p1", [a]);
    const dna2 = computeDesignDNA("p2", [a]);
    expect(similarity(dna1, dna2)).toBeCloseTo(1, 1);
  });

  it("similarity is low between opposing projects (luxury oak vs industrial steel)", () => {
    const a = analyze({ source_asset_id: "a", known_object_types: ["staircase"], known_materials: ["oak", "brass"], known_style: "luxury", known_palette: ["oak", "brass", "cream"] });
    const b = analyze({ source_asset_id: "b", known_object_types: ["staircase"], known_materials: ["steel", "concrete"], known_style: "industrial", known_palette: ["steel", "concrete", "charcoal"] });
    const dna1 = computeDesignDNA("p1", [a]);
    const dna2 = computeDesignDNA("p2", [b]);
    expect(similarity(dna1, dna2)).toBeLessThan(0.6);
  });

  it("warmth_score is the mean across analyses (0..100)", () => {
    const a = analyze({ source_asset_id: "a", known_object_types: ["x"], known_materials: ["oak"], known_palette: ["oak", "cream"] });
    const b = analyze({ source_asset_id: "b", known_object_types: ["x"], known_materials: ["steel"], known_palette: ["steel", "concrete"] });
    const dna = computeDesignDNA("mixed", [a, b]);
    expect(dna.warmth_score).toBeGreaterThan(0);
    expect(dna.warmth_score).toBeLessThan(100);
  });

  it("carries engine_version + generated_at", () => {
    const a = analyze({ source_asset_id: "a", known_object_types: ["x"] });
    const dna = computeDesignDNA("p", [a]);
    expect(dna.provenance.engine_version).toContain("design_dna");
    expect(dna.provenance.generated_at).toBeTruthy();
  });
});
