// Interior Relationship Engine · tests.
//
// Doctrine: docs/brains/nex-phase-e8-e10-geometry-vision-sketch-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import { addRelationship, walkRelated, planPropagation, count, clear, edgesFrom, edgesOfKind } from "./index";

beforeEach(() => clear());

describe("Interior Relationship Engine", () => {
  it("addRelationship + count", () => {
    addRelationship({ from_id: "staircase", to_id: "flooring", kind: "matches_material", propagation: "propagate_material", strength: 0.9 });
    expect(count()).toBe(1);
  });

  it("walkRelated returns reachable objects up to depth", () => {
    addRelationship({ from_id: "kitchen", to_id: "island", kind: "contains", propagation: "propagate_theme_pack", strength: 1 });
    addRelationship({ from_id: "island", to_id: "worktop", kind: "contains", propagation: "propagate_material", strength: 1 });
    addRelationship({ from_id: "worktop", to_id: "splashback", kind: "coordinates_with", propagation: "propagate_material", strength: 0.8 });
    const reach = walkRelated("kitchen", 2);
    expect(reach).toContain("island");
    expect(reach).toContain("worktop");
    expect(reach).not.toContain("splashback");
    const reachDeep = walkRelated("kitchen", 3);
    expect(reachDeep).toContain("splashback");
  });

  it("planPropagation returns only edges whose rule matches the property", () => {
    addRelationship({ from_id: "staircase", to_id: "flooring", kind: "matches_material", propagation: "propagate_material", strength: 0.9 });
    addRelationship({ from_id: "staircase", to_id: "doors", kind: "coordinates_with", propagation: "propagate_style", strength: 0.7 });
    const plan = planPropagation("staircase", "material", "oak", "walnut");
    expect(plan.affected.map((a) => a.to_id)).toEqual(["flooring"]);
  });

  it("planPropagation is PURE · returns a plan · never mutates", () => {
    addRelationship({ from_id: "s", to_id: "f", kind: "matches_material", propagation: "propagate_material", strength: 1 });
    const before = count();
    planPropagation("s", "material", "oak", "walnut");
    expect(count()).toBe(before);
  });

  it("edgesFrom + edgesOfKind filter correctly", () => {
    addRelationship({ from_id: "kitchen", to_id: "island", kind: "contains", propagation: "propagate_none", strength: 1 });
    addRelationship({ from_id: "kitchen", to_id: "cabinets", kind: "contains", propagation: "propagate_none", strength: 1 });
    addRelationship({ from_id: "staircase", to_id: "kitchen", kind: "adjacent_to", propagation: "propagate_none", strength: 0.5 });
    expect(edgesFrom("kitchen")).toHaveLength(2);
    expect(edgesOfKind("adjacent_to")).toHaveLength(1);
  });

  it("walkRelated excludes the source itself · deduplicates cycles", () => {
    addRelationship({ from_id: "a", to_id: "b", kind: "adjacent_to", propagation: "propagate_none", strength: 1 });
    addRelationship({ from_id: "b", to_id: "a", kind: "adjacent_to", propagation: "propagate_none", strength: 1 });
    const reach = walkRelated("a", 5);
    expect(reach).not.toContain("a");
    expect(reach).toContain("b");
    expect(reach).toHaveLength(1);
  });
});
