// Font Catalog · tests for 11 text roles × 6 personalities.
//
// Doctrine: docs/brains/nex-design-platform-and-design-object-model-philip-2026-08-04.md

import { describe, it, expect } from "vitest";
import { resolveFontStyle, requiredFontFamilies, fontFamilyStack, listTextRoles, listPersonalities } from "./font-catalog";

describe("Font Catalog", () => {
  it("lists all 11 text roles", () => {
    expect(listTextRoles()).toHaveLength(11);
  });

  it("lists all 6 personalities", () => {
    expect(listPersonalities()).toHaveLength(6);
  });

  it("resolves a font style for every (role × personality) combination", () => {
    const roles = listTextRoles();
    const personalities = listPersonalities();
    for (const p of personalities) {
      for (const r of roles) {
        const style = resolveFontStyle(r, p);
        expect(style.family).toBeTruthy();
        expect(style.fallback_stack.length).toBeGreaterThan(0);
        expect(style.weight).toBeGreaterThan(0);
        expect(style.size_px).toBeGreaterThan(0);
        expect(style.line_height).toBeGreaterThan(0);
      }
    }
  });

  it("luxury headline uses Playfair Display", () => {
    const style = resolveFontStyle("headline", "luxury");
    expect(style.family).toBe("Playfair Display");
    expect(style.weight).toBe(700);
  });

  it("sales_event display uses uppercase transform", () => {
    const style = resolveFontStyle("display", "sales_event");
    expect(style.transform).toBe("uppercase");
  });

  it("family personality prefers Poppins for headline", () => {
    const style = resolveFontStyle("headline", "family");
    expect(style.family).toBe("Poppins");
  });

  it("heritage body prefers Merriweather serif", () => {
    const style = resolveFontStyle("body", "heritage");
    expect(style.family).toBe("Merriweather");
  });

  it("fontFamilyStack produces a valid CSS declaration", () => {
    const style = resolveFontStyle("headline", "luxury");
    const stack = fontFamilyStack(style);
    expect(stack).toContain("Playfair Display");
    expect(stack).toContain("serif");
    expect(stack).toMatch(/"Playfair Display",/);
  });

  it("requiredFontFamilies returns a deduplicated sorted list", () => {
    const families = requiredFontFamilies();
    expect(families.length).toBeGreaterThan(5);
    // Sorted
    const sorted = [...families].sort();
    expect(families).toEqual(sorted);
    // Deduplicated
    expect(new Set(families).size).toBe(families.length);
    // Includes key families
    expect(families).toContain("Playfair Display");
    expect(families).toContain("Montserrat");
    expect(families).toContain("Inter");
  });

  it("size_ratio_to_headline is set for supporting roles when appropriate", () => {
    const sub = resolveFontStyle("sub_headline", "luxury");
    expect(sub.size_ratio_to_headline).toBeGreaterThan(0);
    expect(sub.size_ratio_to_headline).toBeLessThan(1);
  });

  it("cta uses larger letter spacing than body across all personalities", () => {
    for (const p of listPersonalities()) {
      const cta = resolveFontStyle("cta", p);
      const body = resolveFontStyle("body", p);
      const ctaSpacing = parseFloat(cta.letter_spacing);
      const bodySpacing = parseFloat(body.letter_spacing);
      expect(ctaSpacing).toBeGreaterThanOrEqual(bodySpacing);
    }
  });
});
