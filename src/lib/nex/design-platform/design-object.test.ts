// Design Platform · DesignObject Model tests.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

import { describe, it, expect, beforeEach } from "vitest";
import {
  defaultCapabilities, register, upsert, get, all, byCategory, byTag, byType, compatibleWith, clear, count,
  isProduct, isMarketing, isConstruction, isDesignToken, isEnvironment,
} from "./index";
import type { ProductObject, MarketingObject, ConstructionObject, DesignTokenObject, EnvironmentObject } from "./index";

beforeEach(() => clear());

function makeHandrail(): ProductObject {
  return {
    id: "oak_handrail_50mm_traditional",
    category: "ProductObject",
    type: "ProductObject.Staircase.Handrail",
    properties: { material: "oak_american_white", profile: "50mm_round", finish: "satin_lacquer" },
    capabilities: defaultCapabilities({
      configurable: ["length_mm", "mounting_style"],
      compatible_with: ["oak_newel", "oak_spindle", "oak_string", "glass_panel"],
      manufacturable: true,
      marketable: true,
    }),
    provenance: { named_expert: "Philip O'Farrell", authored: "2026-08-04" },
    tags: ["oak", "traditional", "staircase"],
  };
}

function makeCTA(): MarketingObject {
  return {
    id: "cta_get_quote",
    category: "MarketingObject",
    type: "MarketingObject.CTA",
    properties: { text: "Get Quote", role: "cta", max_chars: 12 },
    capabilities: defaultCapabilities({ marketable: true }),
    provenance: { named_expert: "Philip O'Farrell" },
    tags: ["cta", "conversion"],
  };
}

describe("Design Object Model", () => {
  it("registers and retrieves a ProductObject", () => {
    const h = register(makeHandrail());
    expect(get(h.id)).toEqual(h);
    expect(count()).toBe(1);
  });

  it("prevents duplicate id registration", () => {
    register(makeHandrail());
    expect(() => register(makeHandrail())).toThrow(/already registered/);
  });

  it("upsert allows overwriting", () => {
    register(makeHandrail());
    const modified: ProductObject = { ...makeHandrail(), properties: { ...makeHandrail().properties, finish: "matt_lacquer" } };
    upsert(modified);
    expect((get(modified.id) as ProductObject).properties.finish).toBe("matt_lacquer");
  });

  it("filters by category", () => {
    register(makeHandrail());
    register(makeCTA());
    expect(byCategory("ProductObject")).toHaveLength(1);
    expect(byCategory("MarketingObject")).toHaveLength(1);
    expect(byCategory("EnvironmentObject")).toHaveLength(0);
  });

  it("filters by tag", () => {
    register(makeHandrail());
    register(makeCTA());
    expect(byTag("oak")).toHaveLength(1);
    expect(byTag("cta")).toHaveLength(1);
    expect(byTag("nonexistent")).toHaveLength(0);
  });

  it("filters by type", () => {
    register(makeHandrail());
    register(makeCTA());
    expect(byType("ProductObject.Staircase.Handrail")).toHaveLength(1);
  });

  it("resolves compatibility (silently drops unregistered refs)", () => {
    const h = register(makeHandrail());
    // Register only one of the four compatible objects
    register({
      id: "oak_newel",
      category: "ProductObject",
      type: "ProductObject.Staircase.Newel",
      properties: { material: "oak_american_white" },
      capabilities: defaultCapabilities(),
      provenance: {},
    });
    const compat = compatibleWith(h.id);
    expect(compat).toHaveLength(1);
    expect(compat[0].id).toBe("oak_newel");
  });

  it("default capabilities are sensible", () => {
    const c = defaultCapabilities();
    expect(c.renderable).toBe(true);
    expect(c.searchable).toBe(true);
    expect(c.recommendable).toBe(true);
    expect(c.configurable).toEqual([]);
    expect(c.compatible_with).toEqual([]);
    expect(c.manufacturable).toBe(false);
    expect(c.marketable).toBe(false);
  });

  it("type guards discriminate correctly", () => {
    const h = makeHandrail();
    const cta = makeCTA();
    const beam: ConstructionObject = { id: "beam", category: "ConstructionObject", type: "ConstructionObject.Beam", properties: { load_bearing: true }, capabilities: defaultCapabilities(), provenance: {} };
    const token: DesignTokenObject = { id: "oak_hex", category: "DesignTokenObject", type: "DesignTokenObject.Color.Oak", properties: { token_kind: "color", value: "#a86832" }, capabilities: defaultCapabilities(), provenance: {} };
    const env: EnvironmentObject = { id: "morning_light", category: "EnvironmentObject", type: "EnvironmentObject.Lighting.Morning", properties: { kind: "lighting" }, capabilities: defaultCapabilities(), provenance: {} };
    expect(isProduct(h)).toBe(true);
    expect(isMarketing(cta)).toBe(true);
    expect(isConstruction(beam)).toBe(true);
    expect(isDesignToken(token)).toBe(true);
    expect(isEnvironment(env)).toBe(true);
    expect(isProduct(cta)).toBe(false);
  });

  it("all() returns every registered object", () => {
    register(makeHandrail());
    register(makeCTA());
    expect(all()).toHaveLength(2);
  });
});
