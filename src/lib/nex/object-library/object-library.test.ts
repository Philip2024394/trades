// Object Library · tests.
//
// Doctrine: docs/brains/nex-phase-e16-visual-learning-object-dna-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { register, upsertVersion, reinforce, merge, get, count, byFamily, findMatches, similarity, nextId, clear } from "./index";
import type { ObjectDNA } from "./index";

beforeEach(() => clear());

function makeHandrail(overrides?: Partial<ObjectDNA>): ObjectDNA {
  return {
    object_id: "STAIR_HANDRAIL_000001",
    family: "STAIR_HANDRAIL",
    display_name: "Oak Handrail · 50mm round · satin lacquer",
    shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" },
    material_id: "oak_american_white_satin_lacquer",
    dimensions: { length_mm: 3600, diameter_mm: 50 },
    style: "traditional",
    manufacturing_steps: ["turn", "sand", "lacquer"],
    compatible_objects: ["STAIR_NEWEL_000001", "STAIR_SPINDLE_000001"],
    cost_gbp: 42,
    weight_kg: 5.4,
    construction_rules: [{ rule: "Handrail top 900-1000mm above pitch line", citation: "Building Regs Part K", severity: "required" }],
    image_example_asset_ids: ["asset_hero_001"],
    supplier_links: [{ name: "AHEC UK", region: "UK", lead_time_weeks: 4 }],
    history: [{ version: 1, captured_at: "2026-08-04T00:00:00Z", changes: ["initial registration"], changed_by: "philip", confidence: 0.9 }],
    variants: [{ variant_id: "v_walnut", label: "walnut · matt · 50mm", material_id: "european_walnut_matt_lacquer", cost_gbp: 65 }],
    aggregate_confidence: 0.9,
    observation_count: 1,
    tags: ["oak", "handrail", "traditional"],
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    created_at: "2026-08-04T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

describe("Object Library · Object DNA", () => {
  it("registers + retrieves an ObjectDNA by id", () => {
    register(makeHandrail());
    expect(get("STAIR_HANDRAIL_000001")?.display_name).toContain("Oak Handrail");
    expect(count()).toBe(1);
  });

  it("nextId returns unique per-family incrementing ids", () => {
    expect(nextId("STAIR_HANDRAIL")).toBe("STAIR_HANDRAIL_000001");
    expect(nextId("STAIR_HANDRAIL")).toBe("STAIR_HANDRAIL_000002");
    expect(nextId("STAIR_NEWEL")).toBe("STAIR_NEWEL_000001");
  });

  it("rejects duplicate registration · use upsertVersion for edits", () => {
    register(makeHandrail());
    expect(() => register(makeHandrail())).toThrow(/already registered/);
  });

  it("upsertVersion appends to history · never rewrites prior versions", () => {
    register(makeHandrail());
    const v2 = upsertVersion("STAIR_HANDRAIL_000001", ["material_id changed"], "philip", { material_id: "european_walnut_matt_lacquer" });
    expect(v2.history).toHaveLength(2);
    expect(v2.history[1].version).toBe(2);
    expect(v2.history[0].changes[0]).toBe("initial registration");
    expect(v2.material_id).toBe("european_walnut_matt_lacquer");
  });

  it("reinforce bumps observation_count and confidence + adds evidence", () => {
    register(makeHandrail());
    const r = reinforce("STAIR_HANDRAIL_000001", 0.05, "visual_learning_platform", "asset_hero_002");
    expect(r.observation_count).toBe(2);
    expect(r.aggregate_confidence).toBeGreaterThan(0.9);
    expect(r.aggregate_confidence).toBeLessThanOrEqual(1);
    expect(r.image_example_asset_ids).toContain("asset_hero_002");
    expect(r.history[r.history.length - 1].changes.join(" ")).toContain("observation_count");
  });

  it("reinforce does not lift confidence above 1.0", () => {
    register(makeHandrail({ aggregate_confidence: 0.98 }));
    const r = reinforce("STAIR_HANDRAIL_000001", 0.5, "vlp");
    expect(r.aggregate_confidence).toBeLessThanOrEqual(1);
  });

  it("similarity returns 0 for different families", () => {
    const a = makeHandrail();
    const b = makeHandrail({ family: "STAIR_NEWEL" });
    expect(similarity(a, b)).toBe(0);
  });

  it("similarity increases with matching shape + style + dimensions", () => {
    const a = makeHandrail();
    const b = makeHandrail();
    expect(similarity(a, b)).toBeGreaterThan(0.7);
  });

  it("findMatches ranks candidates by similarity descending", () => {
    register(makeHandrail());
    register(makeHandrail({ object_id: "STAIR_HANDRAIL_000002", style: "modern", shape: { primary_shape: "cylinder", edge_treatment: "sharp", proportions: "small", style_class: "modern" } }));
    const candidate = { family: "STAIR_HANDRAIL" as const, shape: { primary_shape: "cylinder", edge_treatment: "rounded", proportions: "medium", style_class: "traditional" }, style: "traditional", dimensions: { length_mm: 3600, diameter_mm: 50 } };
    const matches = findMatches(candidate, 0.5);
    expect(matches[0].object.object_id).toBe("STAIR_HANDRAIL_000001");
  });

  it("byFamily filters correctly", () => {
    register(makeHandrail());
    register(makeHandrail({ object_id: "STAIR_NEWEL_000001", family: "STAIR_NEWEL" }));
    expect(byFamily("STAIR_HANDRAIL")).toHaveLength(1);
    expect(byFamily("STAIR_NEWEL")).toHaveLength(1);
  });

  it("merge absorbs variants + evidence + observations and deletes the merged id", () => {
    register(makeHandrail());
    register(makeHandrail({ object_id: "STAIR_HANDRAIL_000002", variants: [{ variant_id: "v_ash", label: "ash", material_id: "ash_white" }], image_example_asset_ids: ["asset_hero_009"], observation_count: 3 }));
    const { kept } = merge("STAIR_HANDRAIL_000001", "STAIR_HANDRAIL_000002", "duplicate detected", "vlp");
    expect(get("STAIR_HANDRAIL_000002")).toBeUndefined();
    expect(kept.variants?.length).toBe(2);
    expect(kept.image_example_asset_ids).toContain("asset_hero_009");
    expect(kept.observation_count).toBe(4);
    expect(kept.history[kept.history.length - 1].changes.join(" ")).toContain("merged");
  });

  it("cannot merge an object with itself", () => {
    register(makeHandrail());
    expect(() => merge("STAIR_HANDRAIL_000001", "STAIR_HANDRAIL_000001", "reason", "vlp")).toThrow(/itself/);
  });
});
