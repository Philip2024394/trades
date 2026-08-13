// Universal Asset Library · validation tests.
//
// Doctrine: docs/brains/nex-phase-e1-universal-design-studio-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { validateAsset } from "./index";
import type { UniversalAsset } from "./index";

function makeAsset(overrides?: Partial<UniversalAsset>): UniversalAsset {
  return {
    id: "asset_001",
    title: "Floating Oak Staircase · Luxury Home",
    description: "Modern floating oak staircase with frameless glass balustrade and warm LED under-tread lighting.",
    industry: "staircase",
    product_family: "floating_oak_staircases",
    hero_product: "floating oak staircase with glass",
    theme_pack: "luxury_burgundy",
    timber_profile: "oak",
    colour_palette: ["#5C1229", "#D4AF37", "#F5F5DC"],
    layout_family: "premium_trade_banner_v1",
    marketing_tone: "premium",
    quality_rating: "flagship",
    provenance: {
      named_expert: "Philip O'Farrell",
      authored: "2026-08-04",
      source: "authored",
      licence: "internal",
      commercial_use: true,
    },
    storage: { url: "https://cdn.example.com/asset_001.png" },
    created_at: "2026-08-04T00:00:00Z",
    ...overrides,
  };
}

describe("Universal Asset Library · schema validation", () => {
  it("valid asset produces no missing fields", () => {
    const missing = validateAsset(makeAsset());
    expect(missing).toEqual([]);
  });

  it("flags missing required top-level fields", () => {
    const missing = validateAsset({ description: "..." });
    expect(missing).toContain("id");
    expect(missing).toContain("title");
    expect(missing).toContain("industry");
    expect(missing).toContain("quality_rating");
    expect(missing).toContain("provenance");
    expect(missing).toContain("storage.url");
    expect(missing).toContain("created_at");
  });

  it("flags missing provenance sub-fields", () => {
    // @ts-expect-error deliberately supplying an incomplete provenance
    const missing = validateAsset({ ...makeAsset(), provenance: {} });
    expect(missing).toContain("provenance.source");
    expect(missing).toContain("provenance.licence");
  });

  it("accepts all quality ratings", () => {
    const ratings: UniversalAsset["quality_rating"][] = ["flagship", "a_plus", "a", "b", "c", "draft"];
    for (const r of ratings) {
      expect(validateAsset(makeAsset({ quality_rating: r }))).toEqual([]);
    }
  });
});
