// src/lib/nex-native/theme-category/registry.test.ts
//
// Theme Category Registry · regression tests · sealed 2026-10-06.
//
// Protects the architectural rules authorised by the founder for
// Step 1A of the Category → World architecture:
//
//   · exactly three categories registered: ocean, cafe, explore
//   · ids are stable, unique and valid
//   · resolveCategoryId defaults missing/unknown ids to "explore"
//   · every code-registered live-world ThemePackage declares a
//     REGISTERED categoryId (ocean → ocean · 4 cafés → cafe)
//   · no DB migration seeds category rows / columns
//   · no category-specific Library UI exists yet (Step 1B scope)
//   · no "waterworld" implementation yet (Step 3 scope)
//   · the current Ocean world's identity.id remains "ocean"

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  EXPLORE_CATEGORY_ID,
  getCategory,
  isRegisteredCategory,
  listCategories,
  resolveCategoryId,
} from "./registry";
import {
  LIVE_WORLD_IDS,
  LIVE_WORLD_PACKAGES,
} from "@/app/nex-native/chat-standard/_live-worlds";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const MIGRATIONS_DIR = path.join(REPO_ROOT, "nex-supabase/migrations");
const LIBRARY_DIR = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library",
);

// ─── A · the three registered categories ────────────────────────────

describe("A · exactly three categories registered (ocean · cafe · explore)", () => {
  test("ocean category exists", () => {
    const cat = getCategory("ocean");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("ocean");
    expect(cat?.name).toBe("Ocean");
    expect(cat?.tagline).not.toBeNull();
    expect(cat?.icon).not.toBeNull();
  });

  test("cafe category exists", () => {
    const cat = getCategory("cafe");
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("cafe");
    expect(cat?.name).toBe("Café");
  });

  test("explore category exists", () => {
    const cat = getCategory(EXPLORE_CATEGORY_ID);
    expect(cat).not.toBeNull();
    expect(cat?.id).toBe("explore");
    expect(cat?.name).toBe("Explore");
  });

  test("EXPLORE_CATEGORY_ID is the string literal 'explore'", () => {
    expect(EXPLORE_CATEGORY_ID).toBe("explore");
  });

  test("listCategories returns exactly those three", () => {
    const cats = listCategories();
    const ids = cats.map((c) => c.id).sort();
    expect(ids).toEqual(["cafe", "explore", "ocean"]);
  });

  test("category ids are unique", () => {
    const cats = listCategories();
    const ids = cats.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every id is lowercase and hyphen-only (no spaces · no emoji · no uppercase)", () => {
    for (const cat of listCategories()) {
      expect(cat.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  test("every category has a non-empty name", () => {
    for (const cat of listCategories()) {
      expect(cat.name.length).toBeGreaterThan(0);
    }
  });
});

// ─── B · resolveCategoryId is deterministic ─────────────────────────

describe("B · resolveCategoryId behaviour", () => {
  test("null → explore", () => {
    expect(resolveCategoryId(null)).toBe("explore");
  });

  test("undefined → explore", () => {
    expect(resolveCategoryId(undefined)).toBe("explore");
  });

  test("empty string → explore", () => {
    expect(resolveCategoryId("")).toBe("explore");
  });

  test("registered id → same id", () => {
    expect(resolveCategoryId("ocean")).toBe("ocean");
    expect(resolveCategoryId("cafe")).toBe("cafe");
    expect(resolveCategoryId("explore")).toBe("explore");
  });

  test("unknown id → explore (safe default · not a throw)", () => {
    expect(resolveCategoryId("ocean-typo")).toBe("explore");
    expect(resolveCategoryId("not-a-category")).toBe("explore");
  });

  test("isRegisteredCategory distinguishes registered from unknown", () => {
    expect(isRegisteredCategory("ocean")).toBe(true);
    expect(isRegisteredCategory("cafe")).toBe(true);
    expect(isRegisteredCategory("explore")).toBe(true);
    expect(isRegisteredCategory("ocean-typo")).toBe(false);
    expect(isRegisteredCategory("")).toBe(false);
  });
});

// ─── C · live-world Theme Packages reference REGISTERED categories ──

describe("C · code-registered packages reference only registered categories", () => {
  test("ocean package → identity.categoryId = 'ocean'", () => {
    const pkg = LIVE_WORLD_PACKAGES.ocean;
    expect(pkg.identity.categoryId).toBe("ocean");
  });

  const CAFE_WORLDS = ["coffee", "botanical-cafe", "midnight-cafe", "french-cafe"] as const;
  for (const id of CAFE_WORLDS) {
    test(`${id} package → identity.categoryId = 'cafe'`, () => {
      const pkg = LIVE_WORLD_PACKAGES[id];
      expect(pkg.identity.categoryId).toBe("cafe");
    });
  }

  test("every live-world package declares an identity.categoryId", () => {
    for (const id of LIVE_WORLD_IDS) {
      const pkg = LIVE_WORLD_PACKAGES[id];
      expect(
        pkg.identity.categoryId,
        `live-world "${id}" must declare identity.categoryId`,
      ).toBeTruthy();
    }
  });

  test("every declared categoryId is REGISTERED (typos fail loudly)", () => {
    for (const id of LIVE_WORLD_IDS) {
      const pkg = LIVE_WORLD_PACKAGES[id];
      const declared = pkg.identity.categoryId;
      if (declared) {
        expect(
          isRegisteredCategory(declared),
          `live-world "${id}" declares categoryId "${declared}" which is NOT in the registry`,
        ).toBe(true);
      }
    }
  });

  test("future package declaring a registered id auto-resolves (parametric)", () => {
    // Simulate a future package shape · the registry has to accept any
    // id we add to it later without a Library code change.
    const futureCategoryId = "ocean"; // already registered
    expect(resolveCategoryId(futureCategoryId)).toBe(futureCategoryId);
  });

  test("future package declaring an UNregistered id falls back to explore", () => {
    const future = "whatever-new-id-nobody-has-added";
    expect(resolveCategoryId(future)).toBe("explore");
    expect(isRegisteredCategory(future)).toBe(false);
  });
});

// ─── D · architectural guards · no DB · no UI · no Waterworld ───────

describe("D · architectural guards", () => {
  test("no migration file seeds a category_id column on nex_chat_theme", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      const content = fs.readFileSync(
        path.join(MIGRATIONS_DIR, file),
        "utf8",
      );
      // Fail if a migration adds a category_id column or seeds category
      // rows into the themes table. Only exact-identifier matches so a
      // legitimate migration mentioning the string "category" in a
      // comment doesn't false-positive.
      const addsCategoryColumn =
        /ALTER\s+TABLE\s+(?:public\.)?nex_chat_theme[\s\S]{0,120}ADD\s+COLUMN\s+category_id/i.test(
          content,
        );
      const seedsCategoryRows =
        /INSERT\s+INTO\s+(?:public\.)?nex_theme_category/i.test(content);
      expect(addsCategoryColumn, `${file} must not add category_id column`).toBe(false);
      expect(seedsCategoryRows, `${file} must not seed nex_theme_category rows`).toBe(false);
    }
  });

  // Step 1A originally asserted that no category UI existed. Step 1B
  // (sealed in a follow-up commit) INTRODUCED the category landing +
  // showcase route · the assertion is now the opposite and lives in
  // `src/app/nex-native/chat-themes-library/_category-grid.test.ts`.
  // Keeping a stub here would misrepresent the architecture; deletion
  // is the correct move. Retained as a comment so git-blame explains
  // the removal.

  test("no 'waterworld' implementation exists yet (Step 3 scope)", () => {
    // Step 3 renames the Ocean World to Waterworld. Step 1A must not
    // touch Ocean's id. Confirm Waterworld does not exist anywhere in
    // the committed source tree.
    const packagesDir = path.join(
      REPO_ROOT,
      "src/app/nex-native/chat-standard/packages",
    );
    const files = fs.readdirSync(packagesDir).filter((f) => f.endsWith(".ts"));
    for (const file of files) {
      expect(file.toLowerCase()).not.toContain("waterworld");
    }
    // Also guard against a world id "waterworld" sneaking in via the
    // LIVE_WORLD_PACKAGES map.
    expect(LIVE_WORLD_IDS as readonly string[]).not.toContain("waterworld");
  });

  test("Ocean world's identity.id remains 'ocean' (Step 3 is NOT this commit)", () => {
    const pkg = LIVE_WORLD_PACKAGES.ocean;
    expect(pkg.identity.id).toBe("ocean");
  });
});
