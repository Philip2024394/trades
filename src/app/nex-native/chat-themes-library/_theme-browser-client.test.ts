// src/app/nex-native/chat-themes-library/_theme-browser-client.test.ts
//
// Universal theme handoff regression · sealed 2026-10-06 pre-Stage-2.
//
// Protects the architectural rule authorised by the founder in the
// Theme View → Live App Handoff Audit:
//
//   "Every active theme gets the same universal handoff:
//        theme.id → /nex-native/themes/${theme.id}
//    No theme list. No Motorbike exception. No Cakes exception.
//    No future-theme exception."
//
// The previous four-entry hardcoded allowlist (`THEME_PREVIEW_HREF`)
// is removed. This file ensures the pattern stays universal: if
// somebody six months from now accidentally reintroduces an allowlist,
// or re-adds a theme-id branch anywhere in the Theme Library CTA
// path, these tests fail loudly.
//
// Two layers of coverage:
//   A · unit test on the `themePreviewHref` helper (exported for test)
//   B · static source-file assertions that lock the universality rule

import { describe, test, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { _themePreviewHrefForTest as themePreviewHref } from "./_theme-browser-client";

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const BROWSER_CLIENT = path.join(
  REPO_ROOT,
  "src/app/nex-native/chat-themes-library/_theme-browser-client.tsx",
);
const SOURCE = fs.readFileSync(BROWSER_CLIENT, "utf8");

// ─── A · themePreviewHref produces the universal destination ────────

describe("A · themePreviewHref is universal (no allowlist)", () => {
  test("maps a theme id to /nex-native/themes/<id>", () => {
    expect(themePreviewHref("theme-0")).toBe("/nex-native/themes/theme-0");
  });

  // Each theme the audit named explicitly must get a destination.
  const AUDIT_THEMES = [
    "theme-0", // Joker · previously worked (was in the allowlist)
    "motorbike-rental", // Motorbike · previously broken (NOT in allowlist)
    "cakes", // Cakes · previously broken (NOT in allowlist)
    "vitamins", // Vitamins · previously broken (NOT in allowlist)
  ] as const;

  for (const themeId of AUDIT_THEMES) {
    test(`${themeId} → /nex-native/themes/${themeId}`, () => {
      expect(themePreviewHref(themeId)).toBe(`/nex-native/themes/${themeId}`);
    });
  }

  test("an arbitrary future-style theme id resolves identically", () => {
    // This is the load-bearing assertion. If somebody re-introduces an
    // allowlist, this fails because the arbitrary id is not in the
    // list.
    const futureId = "future-theme-" + Math.random().toString(36).slice(2, 10);
    expect(themePreviewHref(futureId)).toBe(`/nex-native/themes/${futureId}`);
  });

  test("the function is pattern-based (not allowlist-based)", () => {
    // Fuzz-ish · 100 random ids all resolve to the universal pattern.
    for (let i = 0; i < 100; i++) {
      const id = `t${i}-${Math.random().toString(36).slice(2, 8)}`;
      expect(themePreviewHref(id)).toBe(`/nex-native/themes/${id}`);
    }
  });
});

// ─── B · source-level enforcement of universality ───────────────────

describe("B · source enforces universality (no hardcoded allowlist)", () => {
  test("THEME_PREVIEW_HREF object literal does not exist in source", () => {
    // The removed allowlist used to live at a `const THEME_PREVIEW_HREF`
    // declaration. If somebody reintroduces it, this test catches it.
    // We allow the string to appear only inside the helper's docstring
    // (which documents what it replaced).
    const codeOnlyMatches = SOURCE.match(
      /const\s+THEME_PREVIEW_HREF\s*[:=]/g,
    );
    expect(codeOnlyMatches, "no `const THEME_PREVIEW_HREF` declaration").toBeNull();
  });

  test("source does not use any ThemeId → href lookup map", () => {
    // No per-theme routing map · the pattern must be computed from the
    // id, not read from a per-id lookup. We detect the most common
    // shapes a lookup would take.
    expect(SOURCE).not.toMatch(/Record<\s*(?:"theme-0"|'theme-0')/);
    expect(SOURCE).not.toMatch(
      /["'`]theme-0["'`]\s*:\s*["'`]\/nex-native\/themes\//,
    );
  });

  test("source does not branch on specific theme ids in the CTA path", () => {
    // Guard against reintroducing per-theme branches ·
    //   theme.id === "motorbike-rental" / "cakes" / "theme-0" / etc.
    const perThemeBranches: readonly RegExp[] = [
      /theme\.id\s*===\s*["'`]theme-0["'`]/,
      /theme\.id\s*===\s*["'`]motorbike-rental["'`]/,
      /theme\.id\s*===\s*["'`]cakes["'`]/,
      /theme\.id\s*===\s*["'`]vitamins["'`]/,
      /themeId\s*===\s*["'`]theme-0["'`]/,
      /themeId\s*===\s*["'`]motorbike-rental["'`]/,
      /themeId\s*===\s*["'`]cakes["'`]/,
      /themeId\s*===\s*["'`]vitamins["'`]/,
    ];
    for (const pat of perThemeBranches) {
      expect(
        SOURCE,
        `source must not branch on specific theme ids · ${pat}`,
      ).not.toMatch(pat);
    }
  });

  test("every call site that previously used the allowlist now uses themePreviewHref(theme.id)", () => {
    // The 5 historical call sites · active-grid link · inactive-grid
    // link · hidden `next` input · modal preview openFullScreenHref ·
    // phone-frame iframe src.
    const uses = SOURCE.match(/themePreviewHref\s*\(/g) ?? [];
    // Expect at least 5 call sites (allowing the definition + any
    // future legitimate additions). Fail hard if any site reverts.
    expect(uses.length).toBeGreaterThanOrEqual(5);
  });

  test("the universal destination pattern is explicitly `/nex-native/themes/${id}`", () => {
    // Pin the exact pattern · if somebody rewrites the helper to a
    // different scheme (e.g. /themes-live/<id>) they must update the
    // audit doctrine too.
    expect(SOURCE).toMatch(
      /return\s+`\/nex-native\/themes\/\$\{themeId\}`;/,
    );
  });
});
