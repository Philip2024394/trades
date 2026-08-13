// Object Library · subcomponent hierarchy tests.
//
// Doctrine: docs/brains/nex-object-dna-subcomponent-hierarchy-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { getSubcomponent, walkSubcomponents, flattenSubcomponents, hasSubcomponent, subcomponentSlots } from "./index";
import type { ObjectDNA } from "./index";

function makeStaircase(): ObjectDNA {
  return {
    object_id: "STAIR_STRAIGHT_BULLNOSE_CLOSED_STRING_001",
    family: "OTHER",
    display_name: "Straight bullnose closed-string oak staircase (canonical)",
    shape: { primary_shape: "rectangle", edge_treatment: "rounded", proportions: "large", style_class: "traditional" },
    material_id: "oak_american_white_satin_lacquer",
    dimensions: { length_mm: 3600, width_mm: 900, height_mm: 2600, thickness_mm: 45 },
    style: "traditional",
    compatible_objects: [],
    construction_rules: [],
    image_example_asset_ids: [],
    history: [{ version: 1, captured_at: "2026-08-04T00:00:00Z", changes: ["seed"], changed_by: "test", confidence: 1 }],
    aggregate_confidence: 1,
    observation_count: 1,
    subcomponents: [
      { slot: "flight_type", value: "straight" },
      { slot: "structural_system", value: "closed_string" },
      { slot: "entrance_system", value: "single_bullnose" },
      { slot: "balustrade_system", value: "turned_baluster" },
      { slot: "newel_family", value: "raised_panel_box" },
      { slot: "joinery", value: "housed_treads", children: [
        { slot: "joinery_technique", value: "mortise_and_tenon" },
        { slot: "joinery_technique", value: "dowel_fixings" },
      ] },
      { slot: "decorative_elements", value: "bullnose_return" },
      { slot: "material", value: "oak", object_ref: "oak_american_white_satin_lacquer" },
      { slot: "finish", value: "satin_lacquer" },
    ],
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    created_at: "2026-08-04T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
  };
}

describe("ObjectDNA · Subcomponents", () => {
  it("getSubcomponent returns the direct entry for a named slot", () => {
    const obj = makeStaircase();
    expect(getSubcomponent(obj, "flight_type")?.value).toBe("straight");
    expect(getSubcomponent(obj, "structural_system")?.value).toBe("closed_string");
    expect(getSubcomponent(obj, "newel_family")?.value).toBe("raised_panel_box");
  });

  it("getSubcomponent returns undefined for unknown slots", () => {
    expect(getSubcomponent(makeStaircase(), "nonexistent")).toBeUndefined();
  });

  it("walkSubcomponents yields root + descendants depth-first", () => {
    const entries = Array.from(walkSubcomponents(makeStaircase()));
    const slots = entries.map((e) => `${e.slot}=${e.value}`);
    // Root joinery entry appears before its two children.
    const joineryIdx = slots.indexOf("joinery=housed_treads");
    const morticeIdx = slots.indexOf("joinery_technique=mortise_and_tenon");
    const dowelIdx = slots.indexOf("joinery_technique=dowel_fixings");
    expect(joineryIdx).toBeLessThan(morticeIdx);
    expect(morticeIdx).toBeLessThan(dowelIdx);
    expect(entries.length).toBe(11);   // 9 root + 2 children
  });

  it("flattenSubcomponents produces a flat slot → value map", () => {
    const flat = flattenSubcomponents(makeStaircase());
    expect(flat.flight_type).toBe("straight");
    expect(flat.structural_system).toBe("closed_string");
    expect(flat.entrance_system).toBe("single_bullnose");
    expect(flat.material).toBe("oak");
    expect(flat.finish).toBe("satin_lacquer");
  });

  it("hasSubcomponent supports filter-style querying", () => {
    const obj = makeStaircase();
    expect(hasSubcomponent(obj, "flight_type", "straight")).toBe(true);
    expect(hasSubcomponent(obj, "entrance_system", "single_bullnose")).toBe(true);
    expect(hasSubcomponent(obj, "entrance_system", "double_volute")).toBe(false);
    // Also matches child entries via depth-first walk
    expect(hasSubcomponent(obj, "joinery_technique", "dowel_fixings")).toBe(true);
  });

  it("subcomponentSlots returns unique declared slots including descendants", () => {
    const slots = subcomponentSlots(makeStaircase());
    expect(slots).toContain("flight_type");
    expect(slots).toContain("joinery");
    expect(slots).toContain("joinery_technique");
    expect(slots).toContain("finish");
  });

  it("object with no subcomponents returns empty from every helper (backward compatible)", () => {
    const plain: ObjectDNA = { ...makeStaircase(), subcomponents: undefined };
    expect(getSubcomponent(plain, "flight_type")).toBeUndefined();
    expect(Array.from(walkSubcomponents(plain))).toHaveLength(0);
    expect(flattenSubcomponents(plain)).toEqual({});
    expect(subcomponentSlots(plain)).toEqual([]);
    expect(hasSubcomponent(plain, "flight_type", "straight")).toBe(false);
  });
});
