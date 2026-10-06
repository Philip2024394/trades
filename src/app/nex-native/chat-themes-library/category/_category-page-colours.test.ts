// src/app/nex-native/chat-themes-library/category/_category-page-colours.test.ts
//
// Universal Theme Colour Rule · Category Showcase · sealed 2026-10-06.
//
// Guards that the category showcase page derives EVERY wrapper colour
// from the registered ThemeCategory palette rather than from a generic
// NEX constant. The rule the founder sealed:
//
//   "The category phone/showcase page should not have its own generic
//    NEX colours. The surrounding animation, background, glow, buttons,
//    typography accents, and transitions should be derived from the
//    same ThemePackage colour system as the theme being previewed.
//    DO NOT create a second colour system for animations.
//    DO NOT create if ocean / if cafe branches."
//
// Three coverage layers:
//
//   A · the category registry provides a ColourSystem per entry
//   B · the showcase page source consumes category.colours and
//       contains none of the generic-NEX palette literals that lived
//       there before Step 2 follow-up
//   C · architectural guards · the file has no per-category id
//       colour branches

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getCategory,
  listCategories,
  EXPLORE_CATEGORY_ID,
} from "@/lib/nex-native/theme-category/registry";

const REPO_ROOT = path.resolve(__dirname, "../../../../..");
const CATEGORY_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library/category/[categoryId]/page.tsx",
);

// ─── A · registry carries a ColourSystem for every category ─────────

describe("A · every registered category declares a ColourSystem", () => {
  const cats = listCategories();

  test("there are categories to validate", () => {
    expect(cats.length).toBeGreaterThan(0);
  });

  test.each(cats.map((c) => [c.id] as const))(
    "category '%s' declares a non-null `colours` field with a primary",
    (id) => {
      const cat = getCategory(id);
      expect(cat).not.toBeNull();
      expect(cat?.colours).toBeDefined();
      expect(cat?.colours.primary).toBeTruthy();
      // deep is used as the page background · if a category omits it
      // the showcase falls back cleanly, but we assert that every
      // currently-registered category DOES declare it so the fallback
      // path is only ever used by future / typo'd categories.
      expect(cat?.colours.deep).toBeTruthy();
      expect(cat?.colours.highlight).toBeTruthy();
    },
  );

  test("Ocean category palette is blue/cyan (matches the Ocean world's atmosphere)", () => {
    const ocean = getCategory("ocean");
    expect(ocean?.colours.primary).toBe("#2E90B5");
    expect(ocean?.colours.deep).toBe("#0A2535");
  });

  test("Café category palette is warm/espresso (matches the café family atmosphere)", () => {
    const cafe = getCategory("cafe");
    expect(cafe?.colours.primary).toBe("#6B3F22");
    expect(cafe?.colours.deep).toBe("#2A160A");
  });

  test("Explore category palette is the NEX default (coherent with its uncategorised-bucket role)", () => {
    const explore = getCategory(EXPLORE_CATEGORY_ID);
    expect(explore?.colours.primary).toBe("#00AFFF");
    expect(explore?.colours.deep).toBe("#020914");
  });
});

// ─── B · the page source consumes category.colours · no generic palette

describe("B · category showcase page derives wrapper colours from category.colours", () => {
  const src = fs.readFileSync(CATEGORY_PAGE, "utf8");

  test("source references category.colours (or the derived `palette` alias)", () => {
    expect(src).toMatch(/category\.colours|palette\./);
  });

  test("source does NOT redeclare the generic NEX palette constant", () => {
    // Before the rule was sealed, this file carried:
    //   const NEX = {
    //     bg: "#020914",
    //     cyan: "#00AFFF",
    //     orange: "#FF7800",
    //     text: "#F4F7FC",
    //     textDim: "#8BA9D1",
    //     textMute: "#526B89",
    //   };
    // That constant is the archetypal violation of the rule.
    expect(src).not.toMatch(/const\s+NEX\s*=\s*\{/);
  });

  test("source does NOT contain the removed legacy palette hex literals", () => {
    // The six legacy constants that drove the whole wrapper
    // atmosphere · their presence in this file would mean the rule
    // has been bypassed. These hexes are legitimately present in the
    // Explore category palette (because Explore IS the NEX default) ·
    // but they must never appear in the PAGE file as inline literals.
    const legacyLiterals = [
      '"#020914"',
      '"#00AFFF"',
      '"#FF7800"',
      '"#F4F7FC"',
      '"#8BA9D1"',
      '"#526B89"',
    ];
    for (const lit of legacyLiterals) {
      expect(src, `category page must not inline ${lit} · derive from category.colours`).not.toContain(lit);
    }
  });

  test("source does NOT contain the removed semi-transparent empty-state card fill", () => {
    // The removed `background: "rgba(16,30,52,0.6)"` and `border:
    // "1px solid rgba(139,169,209,0.18)"` were themselves generic-NEX
    // palette derivatives. The replacement uses category.colours.
    expect(src).not.toContain('rgba(16,30,52');
    expect(src).not.toContain('rgba(139,169,209');
  });

  test("source carries the sealed Universal Theme Colour Rule doctrine comment", () => {
    expect(src.toLowerCase()).toContain("universal theme colour rule");
  });
});

// ─── C · no per-category colour branches · the rule stays universal ─

describe("C · architectural guards · no per-category colour branches", () => {
  const src = fs.readFileSync(CATEGORY_PAGE, "utf8");

  test("no `if categoryId === \"ocean\"` style per-category colour selection", () => {
    const forbidden = [
      /categoryId\s*===\s*["'`]ocean["'`]/,
      /categoryId\s*===\s*["'`]cafe["'`]/,
      /categoryId\s*===\s*["'`]explore["'`]/,
      /category\.id\s*===\s*["'`]ocean["'`]/,
      /category\.id\s*===\s*["'`]cafe["'`]/,
      /category\.id\s*===\s*["'`]explore["'`]/,
    ];
    for (const pat of forbidden) {
      expect(src, `category page must not branch on specific id · ${pat}`).not.toMatch(pat);
    }
  });

  test("no world-specific hex literals leak into the page (ocean · coffee)", () => {
    // The CATEGORY page should never carry a world's hex directly ·
    // the category registry owns the palette and the file consumes
    // it through the ThemeCategory contract.
    expect(src).not.toContain("#2E90B5"); // ocean primary
    expect(src).not.toContain("#6B3F22"); // coffee primary
  });
});
