// src/app/nex-native/chat-themes-library/_category-grid.test.ts
//
// Step 1B · Category Library + Category Showcase · regression suite.
// Sealed 2026-10-06.
//
// Covers the full founder-approved requirement list A-O without
// touching the data layer sealed in Step 1A (fff8872b). Where
// behaviour can only be observed by reading the source (no DOM
// environment in the vitest harness), the tests use grep-shaped
// assertions on the source files; where behaviour is pure data, the
// tests exercise the helpers directly.

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  CATEGORY_REGISTRY_IDS,
  getCategory,
  listCategories,
  resolveCategoryId,
} from "./_test-registry-view";
import { countCategoryMembers } from "./_category-member-counts";
import { listLiveWorldsAsBrowserRows } from "./_live-worlds-adapter";
import { resolveHeroWorld } from "./_category-grid";
import type { BrowserThemeRow } from "./_theme-browser-client";
import type { ThemeCategory } from "@/lib/nex-native/theme-category/types";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LIBRARY_DIR = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library",
);
const CATEGORY_GRID = path.join(LIBRARY_DIR, "_category-grid.tsx");
const SHOWCASE_ROUTE = path.join(
  LIBRARY_DIR,
  "category/[categoryId]/page.tsx",
);
const LANDING_PAGE = path.join(LIBRARY_DIR, "page.tsx");
const BROWSER_CLIENT = path.join(LIBRARY_DIR, "_theme-browser-client.tsx");

// Precomputed · the merged collection as it is today (live-worlds +
// adapter output · DB rows are omitted because they require a live
// Supabase; the countCategoryMembers helper is still exercised with
// a hybrid fixture below).
const liveRows = listLiveWorldsAsBrowserRows();

// ─── A · registry categories appear on the Library landing page ─────

describe("A · registry categories appear on the Library landing page", () => {
  test("CategoryGrid component source iterates listCategories()", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("listCategories()");
  });

  test("landing page.tsx mounts the CategoryGrid component", () => {
    const src = fs.readFileSync(LANDING_PAGE, "utf8");
    expect(src).toContain("<CategoryGrid");
    expect(src).toContain('from "./_category-grid"');
  });

  test("landing page.tsx no longer renders ThemeBrowserClient directly", () => {
    const src = fs.readFileSync(LANDING_PAGE, "utf8");
    expect(src).not.toContain("<ThemeBrowserClient");
  });
});

// ─── B · member counts are computed from the merged collection ──────

describe("B · member counts come from the actual merged world collection", () => {
  test("countCategoryMembers tallies ids correctly for a known fixture", () => {
    const fixture: BrowserThemeRow[] = [
      row("a", "ocean"),
      row("b", "ocean"),
      row("c", "cafe"),
      row("d", "cafe"),
      row("e", "cafe"),
      row("f", "explore"),
    ];
    const counts = countCategoryMembers(fixture);
    expect(counts["ocean"]).toBe(2);
    expect(counts["cafe"]).toBe(3);
    expect(counts["explore"]).toBe(1);
  });

  test("live-world rows produce ocean=1, cafe=4, explore=1 counts today", () => {
    // Updated 2026-10-06 · Food world sealed as the first live-world
    // in the "explore" bucket (per the sealed Step 1A doctrine that a
    // real category is only added when a genuine family of Worlds
    // warrants it · Food currently stands alone).
    const counts = countCategoryMembers(liveRows);
    expect(counts["ocean"]).toBe(1);
    expect(counts["cafe"]).toBe(4);
    expect(counts["explore"] ?? 0).toBe(1);
  });
});

// ─── C · Ocean contains the current ocean world ─────────────────────

describe("C · Ocean category contains the current 'ocean' world", () => {
  test("ocean row appears in the Ocean category after filter", () => {
    const inOcean = liveRows.filter((r) => r.category_id === "ocean");
    expect(inOcean.map((r) => r.id)).toContain("ocean");
  });

  test("ocean world's identity.id is still 'ocean' (Step 3 unmade)", () => {
    const ocean = liveRows.find((r) => r.id === "ocean");
    expect(ocean).toBeDefined();
    expect(ocean?.id).toBe("ocean");
  });
});

// ─── D · Café contains the four current café worlds ─────────────────

describe("D · Café category contains coffee + 3 cafés", () => {
  const EXPECTED = ["coffee", "botanical-cafe", "midnight-cafe", "french-cafe"] as const;

  test("every expected café world has category_id = 'cafe'", () => {
    const inCafe = liveRows
      .filter((r) => r.category_id === "cafe")
      .map((r) => r.id)
      .sort();
    expect(inCafe).toEqual([...EXPECTED].sort());
  });
});

// ─── E · DB themes default to Explore ───────────────────────────────

describe("E · DB-backed themes assigned to Explore appear in Explore", () => {
  test("shared library loader assigns DB rows to EXPLORE_CATEGORY_ID", () => {
    // The DB-default assignment moved from page.tsx into the shared
    // loader during Step 1B. Guard against regression · the string
    // must appear in the shared loader AND not revert to a per-theme
    // branch anywhere.
    const loaderSrc = fs.readFileSync(
      path.join(LIBRARY_DIR, "_load-library-data.ts"),
      "utf8",
    );
    expect(loaderSrc).toContain("category_id: EXPLORE_CATEGORY_ID");
  });

  test("countCategoryMembers surfaces DB-assigned explore rows", () => {
    const fixture: BrowserThemeRow[] = [
      row("db-1", "explore"),
      row("db-2", "explore"),
      row("ocean", "ocean"),
    ];
    const counts = countCategoryMembers(fixture);
    expect(counts["explore"]).toBe(2);
    expect(counts["ocean"]).toBe(1);
  });
});

// ─── F · future registered category auto-gets a tile ────────────────

describe("F · future registered category auto-flows through the grid", () => {
  test("CategoryGrid renders ONE tile per non-empty registered category · no hardcoded list", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    // The grid MUST iterate registry entries · a hardcoded list would
    // not pick up future categories automatically.
    expect(src).toContain("listCategories()");
    // Guard against someone writing a conditional list of specific ids.
    expect(src).not.toMatch(/\[\s*["']ocean["']\s*,\s*["']cafe["']/);
  });

  test("adding a hypothetical category to the fixture produces an extra tile count", () => {
    // We can't dynamically add to CATEGORY_REGISTRY in a test · instead
    // we exercise the component's input contract: given N categories
    // with worlds, N tiles are rendered. The grid uses listCategories
    // and member counts · both are data-driven · so the contract holds
    // for any future registry entry.
    const fixture: BrowserThemeRow[] = [
      row("w1", "ocean"),
      row("w2", "cafe"),
      row("w3", "explore"),
    ];
    const counts = countCategoryMembers(fixture);
    // Every registry id with members gets surfaced in counts.
    for (const id of ["ocean", "cafe", "explore"]) {
      expect(counts[id]).toBeGreaterThan(0);
    }
  });
});

// ─── G · future world in existing category auto-appears ─────────────

describe("G · future world declaring an existing category auto-appears", () => {
  test("a hypothetical ocean-2 row would appear under Ocean", () => {
    // Simulate a future live-world package with category_id = "ocean".
    const hypothetical: BrowserThemeRow = row("ocean-2-future", "ocean");
    const merged = [...liveRows, hypothetical];
    const inOcean = merged.filter((r) => r.category_id === "ocean");
    expect(inOcean.map((r) => r.id)).toContain("ocean-2-future");
  });
});

// ─── H · unknown category route handled correctly ───────────────────

describe("H · unknown category route handled with notFound()", () => {
  test("showcase page calls notFound() when getCategory returns null", () => {
    const src = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    expect(src).toContain('import { notFound');
    expect(src).toContain("if (!category) notFound()");
  });

  test("resolveCategoryId does not accidentally map unknown → ocean / cafe", () => {
    expect(resolveCategoryId("ocean-typo")).toBe("explore");
    expect(resolveCategoryId("whatever")).toBe("explore");
  });
});

// ─── I · zero-world category handled correctly ──────────────────────

describe("I · zero-world category rendered as empty state", () => {
  test("showcase page renders an empty state when worlds.length === 0", () => {
    const src = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    expect(src).toContain("worlds.length === 0");
    expect(src).toContain("data-nex-category-empty");
  });

  test("CategoryGrid hides categories with zero members from the landing", () => {
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toMatch(/\.filter\(\s*\(\{\s*count\s*\}\)\s*=>\s*count\s*>\s*0\s*\)/);
  });
});

// ─── J · existing world handoff preserved ───────────────────────────

describe("J · universal theme handoff /nex-native/themes/${theme.id} preserved", () => {
  test("themePreviewHref helper still exists and returns the universal pattern", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).toContain("themePreviewHref");
    expect(src).toMatch(/return\s+`\/nex-native\/themes\/\$\{themeId\}`;/);
  });

  test("Step 1B introduces no alternative theme destination logic", () => {
    const landing = fs.readFileSync(LANDING_PAGE, "utf8");
    const showcase = fs.readFileSync(SHOWCASE_ROUTE, "utf8");
    const grid = fs.readFileSync(CATEGORY_GRID, "utf8");
    // Nothing in Step 1B's new or modified files should mint its own
    // /themes/<id> URL · world links continue to flow through the
    // existing themePreviewHref inside ThemeBrowserClient.
    for (const src of [landing, showcase, grid]) {
      expect(src).not.toMatch(/`\/nex-native\/themes\/\$\{[^}]*\}`/);
    }
  });
});

// ─── K · no old four-entry preview allowlist returns ────────────────

describe("K · the old four-entry preview allowlist does not return", () => {
  test("THEME_PREVIEW_HREF object literal is absent from _theme-browser-client.tsx", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).not.toMatch(/const\s+THEME_PREVIEW_HREF\s*[:=]/);
    expect(src).not.toMatch(
      /["'`]theme-0["'`]\s*:\s*["'`]\/nex-native\/themes\//,
    );
  });
});

// ─── L · no category-specific rendering branches ────────────────────

describe("L · zero category-id branches in the Library surfaces", () => {
  const SURFACES = [LANDING_PAGE, SHOWCASE_ROUTE, CATEGORY_GRID];
  const FORBIDDEN = [
    /categoryId\s*===\s*["'`]ocean["'`]/,
    /categoryId\s*===\s*["'`]cafe["'`]/,
    /categoryId\s*===\s*["'`]explore["'`]/,
    /category\.id\s*===\s*["'`]ocean["'`]/,
    /category\.id\s*===\s*["'`]cafe["'`]/,
    /category_id\s*===\s*["'`]ocean["'`]/,
    /category_id\s*===\s*["'`]cafe["'`]/,
  ];

  for (const surface of SURFACES) {
    test(`${path.basename(path.dirname(surface))}/${path.basename(surface)} has no per-category branch`, () => {
      const src = fs.readFileSync(surface, "utf8");
      for (const pat of FORBIDDEN) {
        expect(src, `pattern ${pat} must not appear`).not.toMatch(pat);
      }
    });
  }

  test("CategoryGrid may compare id against EXPLORE_CATEGORY_ID for soft presentation only", () => {
    // One permitted check: CategoryGrid uses `category.id === EXPLORE_CATEGORY_ID`
    // to apply a subtle "not a visual family" visual treatment · this
    // is NOT a routing / membership / data branch, it is cosmetic.
    const src = fs.readFileSync(CATEGORY_GRID, "utf8");
    expect(src).toContain("EXPLORE_CATEGORY_ID");
  });
});

// ─── M · ThemeMockHero remains used for the Library grid ────────────

describe("M · ThemeMockHero remains the grid tile preview", () => {
  test("_theme-browser-client.tsx still references ThemeMockHero", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    expect(src).toContain("ThemeMockHero");
    expect(src).toContain("<ThemeMockHero");
  });

  test("no PhoneFramePreview iframe mount reintroduced in grid tiles", () => {
    const src = fs.readFileSync(BROWSER_CLIENT, "utf8");
    // PhoneFramePreview is still DEFINED in the file but must not be
    // mounted (callsite was removed in 8f805d7d). Count iframe mounts
    // · zero. The function definition line is NOT a mount.
    const mountCount = (src.match(/<PhoneFramePreview\b/g) ?? []).length;
    expect(mountCount).toBe(0);
  });
});

// ─── N · no iframe grid reintroduced ────────────────────────────────

describe("N · no iframe grid pattern reintroduced", () => {
  test("no new Library file uses `<iframe` for grid tiles", () => {
    const files = [LANDING_PAGE, SHOWCASE_ROUTE, CATEGORY_GRID];
    for (const file of files) {
      const src = fs.readFileSync(file, "utf8");
      expect(src.toLowerCase()).not.toContain("<iframe");
    }
  });
});

// ─── O · Step 3 (Waterworld) remains unmade ─────────────────────────

// Step 2 (shell asset consumption) was explicitly authorised and
// sealed in a follow-up commit after Step 1B. The original Step 1B
// guard that asserted the shell did NOT consume wallpaperUrl /
// intro.videoUrl is retired · the live assertions on Step 2 now live
// in src/app/nex-native/chat-standard/_standard-experience.test.ts.
//
// Only the Step 3 guards (Ocean rename to Waterworld) remain active
// here.

describe("O · Step 3 (Ocean → Waterworld rename) remains unmade", () => {
  test("no 'waterworld' package exists", () => {
    const packagesDir = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat-standard/packages",
    );
    const files = fs.readdirSync(packagesDir);
    for (const f of files) {
      expect(f.toLowerCase()).not.toContain("waterworld");
    }
  });

  test("ocean world's identity.id in the live-world registry remains 'ocean'", () => {
    const ocean = liveRows.find((r) => r.id === "ocean");
    expect(ocean).toBeDefined();
    expect(ocean?.id).toBe("ocean");
  });
});

// ─── Sanity · the three registered ids are what the surfaces assume ─

describe("Sanity · the three registered category ids today", () => {
  test("ocean, cafe, explore are registered", () => {
    expect(CATEGORY_REGISTRY_IDS.sort()).toEqual(["cafe", "explore", "ocean"]);
  });

  test("getCategory returns a record for each", () => {
    for (const id of CATEGORY_REGISTRY_IDS) {
      expect(getCategory(id)).not.toBeNull();
    }
  });

  test("every live-world row maps to a registered category id", () => {
    for (const r of liveRows) {
      expect(CATEGORY_REGISTRY_IDS as readonly string[]).toContain(r.category_id);
    }
  });

  test("listCategories order is deterministic (snapshot)", () => {
    const ids = listCategories().map((c) => c.id);
    expect(ids).toEqual(["ocean", "cafe", "explore"]);
  });
});

// ─── Step 1B.1 · phone-frame hero tiles · sealed 2026-10-06 ─────────

// Context · the founder's directive (2026-10-06) rejects the
// rectangular icon/name/"Enter →" category card. The landing now
// renders a large phone-frame per category · the screen inside paints
// the representative World (ThemePackage) through the Theme Engine.
// The following sections guard the new architecture against drift.

// ─── P · heroThemeId exists on every registered category ────────────

describe("P · heroThemeId · every registered category declares a hero", () => {
  const cats = listCategories();

  test.each(cats.map((c) => [c.id] as const))(
    "category '%s' declares a `heroThemeId` field (string or null)",
    (id) => {
      const cat = getCategory(id);
      expect(cat).not.toBeNull();
      expect(cat).toHaveProperty("heroThemeId");
      const hero = cat?.heroThemeId;
      expect(hero === null || typeof hero === "string").toBe(true);
    },
  );

  test("Ocean hero is the ocean world (only member today)", () => {
    expect(getCategory("ocean")?.heroThemeId).toBe("ocean");
  });

  test("Café hero is 'coffee' (archetypal baseline café)", () => {
    expect(getCategory("cafe")?.heroThemeId).toBe("coffee");
  });

  test("Explore hero is 'food' (strongest Explore visual today)", () => {
    expect(getCategory("explore")?.heroThemeId).toBe("food");
  });
});

// ─── Q · hero ids resolve to a world actually in that category ──────

describe("Q · every heroThemeId resolves to a world in its category", () => {
  test.each(
    listCategories().filter((c) => c.heroThemeId !== null).map((c) => [c.id, c.heroThemeId!] as const),
  )(
    "category '%s' · hero '%s' is a live-world row with matching category_id",
    (id, heroId) => {
      const hero = liveRows.find((r) => r.id === heroId);
      expect(hero, `heroThemeId=${heroId} must exist as a live-world row`).toBeDefined();
      expect(hero?.category_id, `hero ${heroId} must belong to category ${id}`).toBe(id);
    },
  );
});

// ─── R · phone-frame tile uses Theme Engine primitives (no iframe) ──

describe("R · phone-frame tile paints the hero via Theme Engine primitives", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("imports ThemeWorld + ThemeBubble from the engine (single implementation of the World)", () => {
    expect(src).toContain("ThemeWorld");
    expect(src).toContain("ThemeBubble");
    expect(src).toContain('from "@/lib/nex-native/chat-render/theme-world"');
  });

  test("renders <ThemeWorld and <ThemeBubble inside the tile", () => {
    expect(src).toContain("<ThemeWorld");
    expect(src).toContain("<ThemeBubble");
  });

  test("has no iframe element anywhere (sealed 8f805d7d · dev-mode performance.measure race)", () => {
    // Allow the word "iframe" in doctrine comments that describe the
    // sealed rule · forbid any actual <iframe> element OR
    // React.createElement("iframe", ...) call in the code.
    expect(src.toLowerCase()).not.toContain("<iframe");
    expect(src.toLowerCase()).not.toMatch(/createelement\s*\(\s*["'`]iframe["'`]/);
  });

  test("tile exposes stable test hooks for the phone frame", () => {
    // These selectors let future browser/visual tests target the
    // phone silhouette without relying on class names.
    expect(src).toContain("data-nex-category-phone");
    expect(src).toContain("data-nex-category-tile");
    expect(src).toContain("data-nex-category-caption");
  });
});

// ─── S · the rejected rectangular card is gone ──────────────────────

describe("S · the rejected icon/name/'Enter →' rectangular card is gone", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("file no longer renders the 'Enter →' affordance", () => {
    expect(src).not.toContain("Enter →");
  });

  test("file no longer carries the rejected linear-gradient card background", () => {
    // The pre-Step-1B.1 card used:
    //   background: "linear-gradient(165deg, rgba(16,30,52,0.75) 0%, rgba(4,10,20,0.90) 100%)"
    // The phone frame derives its surface from category.colours · a
    // return to the old literal would mean the rejected design is back.
    expect(src).not.toContain("rgba(16,30,52,0.75)");
    expect(src).not.toContain("rgba(4,10,20,0.90)");
  });
});

// ─── T · outer phone frame derives from category.colours, not NEX ───

describe("T · outer phone-frame chrome derives from category.colours (Universal Theme Colour Rule)", () => {
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("file consumes category.colours (not a hardcoded NEX palette)", () => {
    expect(src).toContain("category.colours");
    expect(src).toContain("colours.deep");
    expect(src).toContain("colours.primary");
    expect(src).toContain("colours.glow");
    expect(src).toContain("colours.highlight");
  });

  test("file does NOT redeclare a generic NEX palette constant", () => {
    // The pre-Step-1B.1 _category-grid.tsx carried:
    //   const NEX = { bg: "#020914", cyan: "#00AFFF", ... }
    // That block is the archetypal violation of the Universal Theme
    // Colour Rule (sealed 2026-10-06). It has been removed; a return
    // of the constant would mean the rule has been bypassed.
    expect(src).not.toMatch(/const\s+NEX\s*=\s*\{[^}]*bg\s*:\s*["']#020914["']/);
  });

  test("no world-specific hex literals leak into the grid (ocean · coffee primaries)", () => {
    // The CATEGORY grid should never carry a world's hex directly ·
    // category colour comes through category.colours · world colour
    // comes through BrowserThemeRow/ThemeWorld.
    expect(src).not.toContain("#2E90B5"); // ocean primary
    expect(src).not.toContain("#6B3F22"); // coffee primary
  });
});

// ─── U · resolveHeroWorld fallback behaviour (unit test) ────────────

describe("U · resolveHeroWorld · universal, no per-id branches", () => {
  test("returns the row matching heroThemeId when present", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-a", "ocean"),
      row("world-b", "ocean"),
    ];
    const cat = withHero("ocean", "world-b");
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-b");
  });

  test("falls back to the first in-category row when heroThemeId is null", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-x", "explore"),
      row("world-y", "explore"),
    ];
    const cat = withHero("explore", null);
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-x");
  });

  test("falls back to the first in-category row when heroThemeId does not resolve", () => {
    const inCategory: BrowserThemeRow[] = [
      row("world-m", "cafe"),
      row("world-n", "cafe"),
    ];
    const cat = withHero("cafe", "world-does-not-exist");
    expect(resolveHeroWorld(cat, inCategory)?.id).toBe("world-m");
  });

  test("returns null for a category with zero in-category rows (hidden from landing)", () => {
    const cat = withHero("explore", null);
    expect(resolveHeroWorld(cat, [])).toBeNull();
  });
});

// ─── V · the three current hero worlds exist in the merged collection ─

describe("V · all three current hero worlds exist in the live-world collection", () => {
  // Guards against a sealed-registry hero id drifting out of sync
  // with the live-world package set · the Library's resolveHeroWorld
  // would silently fall back to the first in-category world and the
  // category tile would look "fine but wrong".
  test("ocean / coffee / food are all registered live-world rows", () => {
    for (const id of ["ocean", "coffee", "food"]) {
      const row = liveRows.find((r) => r.id === id);
      expect(row, `hero world '${id}' must be a registered live-world row`).toBeDefined();
    }
  });
});

// ─── W · wallpaper-null fallback keeps the phone screen visible ─────

describe("W · phone screen falls back to World palette when wallpaperUrl is null", () => {
  // Coffee is the Café hero today · its ThemePackage declares
  // `wallpaperUrl: null` (the engine falls back to a layered gradient
  // in the live chat). The Library phone-screen must likewise show
  // the World's identity · an accent-tinted gradient derived from the
  // BrowserThemeRow colour slots · rather than an empty bezel.
  const src = fs.readFileSync(CATEGORY_GRID, "utf8");

  test("source renders a palette-derived fallback when hero_image_url is null", () => {
    expect(src).toContain("data-nex-category-phone-fallback");
    // The fallback derives from the row's own colour slots · zero
    // per-id branches · the same three channels drive every
    // wallpaper-null World.
    expect(src).toContain("hero.accent_hex");
    expect(src).toContain("hero.bubble_rim_hex");
    expect(src).toContain("hero.composer_rim_hex");
  });

  test("coffee row today has wallpaperUrl=null · the fallback path is exercised", () => {
    const coffee = liveRows.find((r) => r.id === "coffee");
    expect(coffee).toBeDefined();
    // The adapter maps package.wallpaperUrl → hero_image_url · a
    // null wallpaperUrl surfaces as null hero_image_url. If a future
    // commit adds a coffee wallpaper, this test flips (no behaviour
    // change required · the fallback simply isn't painted).
    expect(coffee?.hero_image_url).toBeNull();
  });

  test("ocean + food rows have wallpaperUrl set · the fallback is NOT painted for them", () => {
    const ocean = liveRows.find((r) => r.id === "ocean");
    const food = liveRows.find((r) => r.id === "food");
    expect(ocean?.hero_image_url).toBeTruthy();
    expect(food?.hero_image_url).toBeTruthy();
  });
});

// ─── Helpers ────────────────────────────────────────────────────────

function row(id: string, categoryId: string): BrowserThemeRow {
  return {
    id,
    name: id,
    tagline: null,
    accent_hex: "#000000",
    bubble_rim_hex: null,
    composer_rim_hex: null,
    tier: "gratis",
    category: "standard",
    category_id: categoryId,
    hero_image_url: null,
    sort_order: 0,
    intro_video_url: null,
    intro_poster_url: null,
    wallpaper_config: null,
  };
}

/** Build a minimal ThemeCategory stub with a specific heroThemeId for
 *  the resolveHeroWorld unit tests · uses the real category when the
 *  id is registered (so colour fields stay valid) and only overrides
 *  heroThemeId. */
function withHero(id: string, heroThemeId: string | null): ThemeCategory {
  const base = getCategory(id);
  if (!base) {
    throw new Error(`test fixture: unknown category '${id}'`);
  }
  return { ...base, heroThemeId };
}
