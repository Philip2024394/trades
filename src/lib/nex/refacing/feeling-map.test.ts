// feeling-map.test.ts — locked feeling-to-hint translations per SEE-UI-SPEC §C.2.

import { describe, it, expect } from "vitest";
import {
  mapFeelingsToStyles,
  mapFeelingsToMoods,
  inferMaterialFamilyHint,
  componentRoleFromItem,
} from "./feeling-map";

describe("mapFeelingsToStyles", () => {
  it("returns empty for a single 'not-sure' feeling", () => {
    expect(mapFeelingsToStyles(["not-sure"])).toEqual([]);
  });

  it("maps 'more-natural' to warm-natural + classic", () => {
    expect(mapFeelingsToStyles(["more-natural"])).toEqual(["warm-natural", "classic"]);
  });

  it("unions multiple feelings without duplicates", () => {
    const result = mapFeelingsToStyles(["more-modern", "more-open"]);
    // both map to modern + minimal · deduped
    expect(result).toEqual(["modern", "minimal"]);
  });

  it("preserves first-appearance order across unioned feelings", () => {
    const result = mapFeelingsToStyles(["more-elegant", "more-modern"]);
    // classic, luxury, traditional (from more-elegant), then modern, minimal (from more-modern)
    expect(result).toEqual(["classic", "luxury", "traditional", "modern", "minimal"]);
  });
});

describe("mapFeelingsToMoods", () => {
  it("maps 'more-dramatic' to bold + dramatic", () => {
    expect(mapFeelingsToMoods(["more-dramatic"])).toEqual(["bold", "dramatic"]);
  });

  it("returns empty for 'not-sure'", () => {
    expect(mapFeelingsToMoods(["not-sure"])).toEqual([]);
  });
});

describe("inferMaterialFamilyHint", () => {
  it("returns 'wood' when 'more-natural' is present", () => {
    expect(inferMaterialFamilyHint(["more-natural"])).toBe("wood");
  });

  it("returns 'glass' when 'more-open' is present without a stronger prior signal", () => {
    expect(inferMaterialFamilyHint(["more-open"])).toBe("glass");
  });

  it("prefers earlier feeling's hint when multiple have hints", () => {
    // more-natural (wood) appears first, so wins over more-open (glass)
    expect(inferMaterialFamilyHint(["more-natural", "more-open"])).toBe("wood");
  });

  it("returns undefined for 'not-sure' alone", () => {
    expect(inferMaterialFamilyHint(["not-sure"])).toBeUndefined();
  });

  it("returns undefined for feelings with no material signal", () => {
    expect(inferMaterialFamilyHint(["more-modern", "more-elegant"])).toBeUndefined();
  });
});

describe("componentRoleFromItem", () => {
  it("maps 'newel' to newel role", () => {
    expect(componentRoleFromItem("newel")).toBe("newel");
    expect(componentRoleFromItem("newel post")).toBe("newel");
    expect(componentRoleFromItem("newel_post")).toBe("newel");
  });

  it("handles pluralised item names", () => {
    expect(componentRoleFromItem("treads")).toBe("tread");
    expect(componentRoleFromItem("risers")).toBe("riser");
    expect(componentRoleFromItem("balusters")).toBe("baluster");
  });

  it("is case-insensitive", () => {
    expect(componentRoleFromItem("HANDRAIL")).toBe("handrail");
    expect(componentRoleFromItem("Baluster")).toBe("baluster");
  });

  it("returns null for non-component items", () => {
    expect(componentRoleFromItem("carpet runner")).toBeNull();
    expect(componentRoleFromItem("wall panelling")).toBeNull();
    expect(componentRoleFromItem("")).toBeNull();
  });
});
