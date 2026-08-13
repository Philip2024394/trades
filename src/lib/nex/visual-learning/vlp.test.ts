// Visual Learning Platform · tests.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { learn } from "./index";
import { register, get, count as objectCount, clear as clearObjectLibrary } from "../object-library";
import { clear as clearPatterns } from "../pattern-learning";
import type { ObjectDNA } from "../object-library";

beforeEach(() => {
  clearObjectLibrary();
  clearPatterns();
});

function seedHandrail(): ObjectDNA {
  const seed: ObjectDNA = {
    object_id: "STAIR_HANDRAIL_000001",
    family: "STAIR_HANDRAIL",
    display_name: "Oak Handrail · seed",
    shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" },
    material_id: "oak_american_white_satin_lacquer",
    dimensions: { length_mm: 3600, diameter_mm: 50 },
    style: "traditional",
    compatible_objects: [],
    construction_rules: [],
    image_example_asset_ids: ["asset_seed"],
    history: [{ version: 1, captured_at: "2026-08-04T00:00:00Z", changes: ["seed"], changed_by: "test", confidence: 0.9 }],
    aggregate_confidence: 0.9,
    observation_count: 1,
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    created_at: "2026-08-04T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
  };
  register(seed);
  return seed;
}

describe("Visual Learning Platform", () => {
  it("reinforces an existing library object when a matching candidate arrives", () => {
    seedHandrail();
    const before = get("STAIR_HANDRAIL_000001")!;
    const beforeConf = before.aggregate_confidence;
    const report = learn({
      extraction_id: "ext_001",
      candidates: [{
        candidate_family: "STAIR_HANDRAIL",
        shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" },
        material_id: "oak_american_white_satin_lacquer",
        dimensions: { length_mm: 3600, diameter_mm: 50 },
        style: "traditional",
        observed_confidence: 0.95,
        evidence_asset_id: "asset_new_001",
      }],
    });
    expect(report.existing_objects_updated).toHaveLength(1);
    expect(report.new_objects_registered).toHaveLength(0);
    const after = get("STAIR_HANDRAIL_000001")!;
    expect(after.aggregate_confidence).toBeGreaterThan(beforeConf);
    expect(after.image_example_asset_ids).toContain("asset_new_001");
    expect(report.confidence_improvements[0].delta).toBeGreaterThan(0);
  });

  it("registers a new ObjectDNA when no library match exists", () => {
    const before = objectCount();
    const report = learn({
      extraction_id: "ext_002",
      candidates: [{
        candidate_family: "STAIR_NEWEL",
        shape: { primary_shape: "cylinder", edge_treatment: "sharp", proportions: "large", style_class: "modern" },
        material_id: "steel_black_powder_coated",
        dimensions: { length_mm: 1100, diameter_mm: 80 },
        style: "modern",
        observed_confidence: 0.88,
        evidence_asset_id: "asset_new_002",
        suggested_display_name: "Modern Steel Newel",
      }],
    });
    expect(objectCount()).toBe(before + 1);
    expect(report.new_objects_registered).toHaveLength(1);
    expect(report.new_objects_registered[0].display_name).toBe("Modern Steel Newel");
    expect(report.new_objects_registered[0].observation_count).toBe(1);
  });

  it("mixed candidates: some reinforce · others register", () => {
    seedHandrail();
    const report = learn({
      extraction_id: "ext_003",
      candidates: [
        { candidate_family: "STAIR_HANDRAIL", shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" }, material_id: "oak_american_white_satin_lacquer", dimensions: { length_mm: 3600, diameter_mm: 50 }, style: "traditional", observed_confidence: 0.9, evidence_asset_id: "asset_x1" },
        { candidate_family: "STAIR_SPINDLE", shape: { primary_shape: "prism", edge_treatment: "chamfered", proportions: "small", style_class: "traditional" }, style: "traditional", observed_confidence: 0.8, evidence_asset_id: "asset_x2", suggested_display_name: "Chamfered Oak Spindle" },
      ],
    });
    expect(report.existing_objects_updated).toHaveLength(1);
    expect(report.new_objects_registered).toHaveLength(1);
  });

  it("captures style_signals into Pattern Learning", () => {
    const report = learn({
      extraction_id: "ext_004",
      candidates: [{ candidate_family: "STAIR_HANDRAIL", shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" }, style: "traditional", observed_confidence: 0.9, evidence_asset_id: "asset_x" }],
      style_signals: [{ feature: "timber", value: "oak" }, { feature: "lighting", value: "warm_white" }, { feature: "balustrade", value: "glass" }],
    });
    expect(report.style_signals_learned).toHaveLength(3);
    expect(report.style_signals_learned.some((s) => s.value === "oak")).toBe(true);
  });

  it("returns a fully auditable report with learner_version + generated_at", () => {
    const report = learn({ extraction_id: "ext_005", candidates: [{ candidate_family: "DOOR", shape: { primary_shape: "rectangle" }, observed_confidence: 0.7, evidence_asset_id: "asset_door" }] });
    expect(report.learner_version).toContain("vlp");
    expect(report.generated_at).toBeTruthy();
    expect(report.extraction_id).toBe("ext_005");
  });

  it("empty candidates returns an empty but well-formed report", () => {
    const report = learn({ extraction_id: "ext_empty", candidates: [] });
    expect(report.new_objects_registered).toHaveLength(0);
    expect(report.existing_objects_updated).toHaveLength(0);
    expect(report.style_signals_learned).toHaveLength(0);
  });
});
