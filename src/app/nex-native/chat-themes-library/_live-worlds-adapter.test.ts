// src/app/nex-native/chat-themes-library/_live-worlds-adapter.test.ts
//
// Live-world Theme Library visibility · regression sealed 2026-10-06.
//
// Protects the architectural rule authorised by the founder:
//
//   "Standard Experience worlds (ocean, coffee, botanical-cafe,
//    midnight-cafe, french-cafe) appear in the Theme Library through
//    the live-worlds adapter · code remains the source of truth · the
//    DB is NEVER augmented with rows for these worlds."
//
// Three layers of protection:
//
//   A · unit test that every registered live-world appears in the
//       adapter output + fields are derived correctly
//   B · architectural guards · no DB migration file for live-worlds ·
//       no theme-ID branches in the Library page
//   C · future-world auto-discovery · the count stays in lockstep
//       with the live-world registry

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  liveWorldAsBrowserRow,
  listLiveWorldsAsBrowserRows,
} from "./_live-worlds-adapter";
import {
  LIVE_WORLD_IDS,
  LIVE_WORLD_PACKAGES,
} from "../chat-standard/_live-worlds";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const LIBRARY_PAGE = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library/page.tsx",
);
const MIGRATIONS_DIR = path.join(REPO_ROOT, "nex-supabase/migrations");

// ─── A · adapter output ──────────────────────────────────────────────

describe("A · live-worlds adapter · every world appears in the Library collection", () => {
  const EXPECTED_WORLDS = [
    "ocean",
    "coffee",
    "botanical-cafe",
    "midnight-cafe",
    "french-cafe",
  ] as const;

  test("listLiveWorldsAsBrowserRows returns a row for every registered live-world", () => {
    const rows = listLiveWorldsAsBrowserRows();
    const ids = rows.map((r) => r.id);
    for (const expected of EXPECTED_WORLDS) {
      expect(
        ids,
        `Theme Library must present live-world "${expected}"`,
      ).toContain(expected);
    }
  });

  test("the adapter stays in lockstep with the live-world registry (future worlds auto-appear)", () => {
    // If someone adds a new entry to LIVE_WORLD_PACKAGES, the adapter
    // picks it up automatically · we assert count parity so this test
    // forces the test author to add a case above when a sixth world
    // lands, but the adapter itself needs no code change.
    expect(listLiveWorldsAsBrowserRows().length).toBe(LIVE_WORLD_IDS.length);
    expect(listLiveWorldsAsBrowserRows().length).toBe(EXPECTED_WORLDS.length);
  });

  for (const id of EXPECTED_WORLDS) {
    test(`${id} · derived fields match the ThemePackage identity + colours`, () => {
      const row = liveWorldAsBrowserRow(id);
      const pkg = LIVE_WORLD_PACKAGES[id];
      expect(row.id).toBe(pkg.identity.id);
      expect(row.name).toBe(pkg.identity.name);
      expect(row.tagline).toBe(pkg.identity.tagline ?? null);
      expect(row.accent_hex).toBe(pkg.colours.primary);
      // tier/category sealed · live-worlds are core NEX, free, standard.
      expect(row.tier).toBe("gratis");
      expect(row.category).toBe("standard");
      // sort_order negative · live-worlds sort before DB themes.
      expect(row.sort_order).toBeLessThan(0);
    });
  }

  test("every live-world id resolves to /nex-native/themes/${id} (universal handoff pattern)", () => {
    // Mirrors the universal destination contract sealed in 4974edc9.
    // The adapter doesn't own the destination logic (that lives in
    // _theme-browser-client.tsx's themePreviewHref) · but the id
    // flowing out of the adapter MUST match the dynamic viewer's
    // route segment pattern so the handoff "just works" for every
    // live-world.
    for (const row of listLiveWorldsAsBrowserRows()) {
      expect(row.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
      const expectedHref = `/nex-native/themes/${row.id}`;
      // Pure string construction mirroring themePreviewHref · the test
      // is really: "does the id survive URL concatenation cleanly?"
      expect(expectedHref).toBe(`/nex-native/themes/${row.id}`);
    }
  });

  test("Ocean carries the sealed intro + wallpaper assets threaded from its ThemePackage", () => {
    const row = liveWorldAsBrowserRow("ocean");
    // Both of these were sealed into ocean.package.ts in commit
    // 8672b5a4 · if someone unsets them in the package the adapter
    // propagates null and this test fails loudly.
    expect(row.hero_image_url).toBe("/nex-themes/ocean-ship.png");
    expect(row.intro_video_url).toBe("/nex-themes/ocean-intro.mp4");
  });
});

// ─── B · architectural guards ───────────────────────────────────────

describe("B · code remains the source of truth · DB is never augmented", () => {
  test("no migration file seeds nex_chat_theme rows for live-worlds", () => {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    const forbidden = ["ocean", "coffee", "botanical-cafe", "midnight-cafe", "french-cafe"];
    for (const file of files) {
      if (!file.endsWith(".sql")) continue;
      const content = fs.readFileSync(path.join(MIGRATIONS_DIR, file), "utf8");
      for (const worldId of forbidden) {
        // Look for an INSERT or an id='<worldId>' pattern specific to
        // the nex_chat_theme table. We match the common seed shape:
        // `INSERT INTO ... nex_chat_theme ... '<worldId>'`
        if (/INSERT\s+INTO\s+(?:public\.)?nex_chat_theme/i.test(content)) {
          const quoted = new RegExp(`['"\`]${worldId}['"\`]`);
          if (quoted.test(content)) {
            throw new Error(
              `Migration ${file} seeds nex_chat_theme with live-world id "${worldId}" · ` +
                `live-worlds must remain code-only. Remove the seed and let the adapter ` +
                `handle visibility.`,
            );
          }
        }
      }
    }
  });

  test("Library page does not branch on specific live-world ids", () => {
    const source = fs.readFileSync(LIBRARY_PAGE, "utf8");
    const forbiddenPatterns: readonly RegExp[] = [
      /theme\.id\s*===\s*["'`]ocean["'`]/,
      /theme\.id\s*===\s*["'`]coffee["'`]/,
      /theme\.id\s*===\s*["'`]botanical-cafe["'`]/,
      /theme\.id\s*===\s*["'`]midnight-cafe["'`]/,
      /theme\.id\s*===\s*["'`]french-cafe["'`]/,
      /themeId\s*===\s*["'`]ocean["'`]/,
      /t\.id\s*===\s*["'`]ocean["'`]/,
    ];
    for (const pat of forbiddenPatterns) {
      expect(
        source,
        `Library page must not branch on specific live-world ids · ${pat}`,
      ).not.toMatch(pat);
    }
  });

  test("Library page consumes the adapter (not a hardcoded live-world list)", () => {
    const source = fs.readFileSync(LIBRARY_PAGE, "utf8");
    expect(source).toContain("listLiveWorldsAsBrowserRows");
    expect(source).toContain("_live-worlds-adapter");
  });

  test("Library page dedupes against collisions (code wins)", () => {
    const source = fs.readFileSync(LIBRARY_PAGE, "utf8");
    // The merge must drop any DB row whose id collides with a
    // registered live-world · otherwise the grid shows duplicates.
    expect(source).toMatch(/liveWorldIds/);
    expect(source).toMatch(/liveWorldIds\.has/);
  });
});

// ─── C2 · Step 1A · category_id field is populated universally ──────

describe("C2 · category_id is populated on every live-world row (Step 1A)", () => {
  test("Ocean row carries category_id = 'ocean'", () => {
    const row = liveWorldAsBrowserRow("ocean");
    expect(row.category_id).toBe("ocean");
  });

  const CAFE_WORLDS = ["coffee", "botanical-cafe", "midnight-cafe", "french-cafe"] as const;
  for (const id of CAFE_WORLDS) {
    test(`${id} row carries category_id = 'cafe'`, () => {
      const row = liveWorldAsBrowserRow(id);
      expect(row.category_id).toBe("cafe");
    });
  }

  test("every live-world row has a non-empty category_id string", () => {
    for (const row of listLiveWorldsAsBrowserRows()) {
      expect(row.category_id).toBeTruthy();
      expect(typeof row.category_id).toBe("string");
    }
  });

  test("category_id is always a REGISTERED category id (never a raw / unknown value)", () => {
    for (const row of listLiveWorldsAsBrowserRows()) {
      expect(["ocean", "cafe", "explore"]).toContain(row.category_id);
    }
  });
});

// ─── C · merged collection has no duplicate ids ─────────────────────

describe("C · merged collection has no duplicate ids", () => {
  test("every row produced by the adapter has a unique id", () => {
    const rows = listLiveWorldsAsBrowserRows();
    const ids = rows.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("every adapter row id matches a live-world registry key", () => {
    const rows = listLiveWorldsAsBrowserRows();
    for (const row of rows) {
      expect(
        LIVE_WORLD_IDS as readonly string[],
        `adapter emitted id "${row.id}" that is not registered as a live-world`,
      ).toContain(row.id);
    }
  });
});
