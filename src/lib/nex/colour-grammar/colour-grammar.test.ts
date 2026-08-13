// Colour Grammar · tests.
//
// Doctrine: docs/brains/nex-six-intelligence-layers-and-design-genome-libraries-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { COLOUR_GRAMMAR, meaningsFor, huesForMeaning, themePacksForMeaning, huesFeeling, feelingsFromThemePacks, count } from "./index";

describe("Colour Grammar", () => {
  it("seeds at least 12 canonical hues", () => {
    expect(count()).toBeGreaterThanOrEqual(12);
  });

  it("black means strength · premium · engineering", () => {
    const m = meaningsFor("black");
    expect(m).toContain("strength");
    expect(m).toContain("premium");
    expect(m).toContain("engineering");
  });

  it("blue means trust · professional", () => {
    const m = meaningsFor("blue");
    expect(m).toContain("trust");
    expect(m).toContain("professional");
  });

  it("huesForMeaning(trust) surfaces blue + teal at minimum", () => {
    const h = huesForMeaning("trust");
    expect(h).toContain("blue");
    expect(h).toContain("teal");
  });

  it("themePacksForMeaning(luxury) includes luxury_black_gold + luxury_burgundy + premium_purple", () => {
    const t = themePacksForMeaning("luxury");
    expect(t).toContain("luxury_black_gold");
    expect(t).toContain("luxury_burgundy");
    expect(t).toContain("premium_purple");
  });

  it("huesFeeling ranks hues by count of matched feelings", () => {
    const results = huesFeeling(["premium", "luxury", "heritage"]);
    // burgundy meanings=[luxury,premium,heritage] matches all 3 · walnut_brown matches 2.
    expect(results[0].hue).toBe("burgundy");
    expect(results[0].matched.length).toBe(3);
    expect(results.map((r) => r.hue)).toContain("walnut_brown");
  });

  it("feelingsFromThemePacks reverses theme → feelings", () => {
    const feelings = feelingsFromThemePacks(["luxury_black_gold", "modern_blue"]);
    expect(feelings).toContain("strength");
    expect(feelings).toContain("trust");
  });

  it("unknown hue returns empty meanings", () => {
    expect(meaningsFor("unknown_hue")).toEqual([]);
  });

  it("Every grammar entry has at least one hex example + one meaning + one brand + one theme pack", () => {
    for (const c of COLOUR_GRAMMAR) {
      expect(c.hex_examples.length).toBeGreaterThan(0);
      expect(c.meanings.length).toBeGreaterThan(0);
      expect(c.works_with_brand.length).toBeGreaterThan(0);
      expect(c.works_with_theme_packs.length).toBeGreaterThan(0);
    }
  });
});
