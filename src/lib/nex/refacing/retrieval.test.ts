// retrieval.test.ts — PR-12 spec §5 retrieval behaviour.

import { describe, it, expect } from "vitest";
import {
  retrieveSeeDirections,
  retrieveTryAlternates,
  resolveReferences,
} from "./retrieval";
import type { ImagesV3Entry } from "./image-schema";

function makeHero(overrides: Partial<ImagesV3Entry> = {}): ImagesV3Entry {
  return {
    image_id: "img_hero_default",
    src: "/x.png",
    alt: "",
    component_role: "whole_staircase",
    component_role_confidence: "observed",
    material: "wood",
    material_confidence: "observed",
    sub_material: "oak",
    sub_material_confidence: "inferred",
    governance: {
      owner_type: "nex_curated",
      owner_id: "nex",
      visibility_label: "INSPIRATION_LIBRARY",
      created_at: "2026-01-01",
      updated_at: "2026-01-01",
      superseded_by: null,
      retention_class: "long_term",
    },
    ...overrides,
  };
}

describe("retrieveSeeDirections", () => {
  it("returns nothing when the library has no whole_staircase or in_situ_room entries", () => {
    const library: ImagesV3Entry[] = [
      makeHero({ image_id: "img_b1", component_role: "baluster" }),
    ];
    const result = retrieveSeeDirections(library, {});
    expect(result).toEqual([]);
  });

  it("filters by material_family_hint", () => {
    const library = [
      makeHero({ image_id: "img_wood", material: "wood" }),
      makeHero({ image_id: "img_glass", material: "glass" }),
    ];
    const result = retrieveSeeDirections(library, { material_family_hint: "glass" });
    expect(result).toHaveLength(1);
    expect(result[0].hero_image.image_id).toBe("img_glass");
  });

  it("attaches reference_image_ids (PR-18 provenance anchor) on every direction", () => {
    const library = [
      makeHero({ image_id: "img_a" }),
      makeHero({ image_id: "img_b" }),
      makeHero({ image_id: "img_c" }),
    ];
    const result = retrieveSeeDirections(library, {});
    expect(result.length).toBeGreaterThan(0);
    for (const d of result) {
      expect(d.reference_image_ids.length).toBeGreaterThan(0);
      expect(d.reference_image_ids[0]).toBe(d.hero_image.image_id);
    }
  });

  it("assigns Safe Centre / Warm Character / Stretch Statement labels to first three", () => {
    const library = [
      makeHero({ image_id: "img_1", canonical_profile_ids: ["modern_restrained"], canonical_profile_ids_confidence: "inferred" }),
      makeHero({ image_id: "img_2", canonical_profile_ids: ["warm-natural_cosy"],  canonical_profile_ids_confidence: "inferred" }),
      makeHero({ image_id: "img_3", canonical_profile_ids: ["signature_bold"],     canonical_profile_ids_confidence: "inferred" }),
    ];
    const result = retrieveSeeDirections(library, {});
    const directions = result.map((r) => r.direction);
    expect(directions).toContain("safe-centre");
    if (result.length >= 2) expect(directions).toContain("warm-character");
    if (result.length >= 3) expect(directions).toContain("stretch-statement");
  });

  it("returns 2-4 directions · never more than 3 named + custom fill", () => {
    const library = Array.from({ length: 10 }, (_, i) =>
      makeHero({ image_id: `img_${i}` })
    );
    const result = retrieveSeeDirections(library, {});
    expect(result.length).toBeLessThanOrEqual(3);
    expect(result.length).toBeGreaterThan(0);
  });

  it("PR-18 · every returned direction anchors on a real library image_id", () => {
    const library = [
      makeHero({ image_id: "img_x" }),
      makeHero({ image_id: "img_y" }),
    ];
    const libraryIds = new Set(library.map((e) => e.image_id));
    const result = retrieveSeeDirections(library, {});
    for (const d of result) {
      for (const id of d.reference_image_ids) {
        expect(libraryIds.has(id)).toBe(true);
      }
    }
  });
});

describe("retrieveTryAlternates", () => {
  it("returns only entries matching target_component_role", () => {
    const library = [
      makeHero({ image_id: "img_bal_1", component_role: "baluster", compatibility_group_ids: ["cg_test"] }),
      makeHero({ image_id: "img_new_1", component_role: "newel",    compatibility_group_ids: ["cg_test"] }),
      makeHero({ image_id: "img_bal_2", component_role: "baluster", compatibility_group_ids: ["cg_test"] }),
    ];
    const result = retrieveTryAlternates(library, {
      target_component_role: "baluster",
      current_design_compatibility_groups: ["cg_test"],
    });
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.entry.component_role === "baluster")).toBe(true);
  });

  it("excludes entries with no compatibility_group_ids overlap", () => {
    const library = [
      makeHero({ image_id: "img_bal_x", component_role: "baluster", compatibility_group_ids: ["cg_other"] }),
    ];
    const result = retrieveTryAlternates(library, {
      target_component_role: "baluster",
      current_design_compatibility_groups: ["cg_target"],
    });
    expect(result).toEqual([]);
  });
});

describe("resolveReferences", () => {
  it("resolves image_ids to their full entries preserving order", () => {
    const library = [
      makeHero({ image_id: "img_a" }),
      makeHero({ image_id: "img_b" }),
      makeHero({ image_id: "img_c" }),
    ];
    const result = resolveReferences(library, ["img_c", "img_a"]);
    expect(result.map((e) => e.image_id)).toEqual(["img_c", "img_a"]);
  });

  it("silently skips unknown image_ids", () => {
    const library = [makeHero({ image_id: "img_a" })];
    const result = resolveReferences(library, ["img_a", "img_ghost"]);
    expect(result).toHaveLength(1);
    expect(result[0].image_id).toBe("img_a");
  });
});
