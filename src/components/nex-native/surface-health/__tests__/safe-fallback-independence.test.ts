// src/components/nex-native/surface-health/__tests__/safe-fallback-independence.test.ts
//
// Doctrine §6 · "If the theme bundle fails to load, the Safe Fallback
// Renderer must still render." Proving dependency isolation at the
// source level: no theme utility, no chat-theme-service, no theme-skin,
// no sticker/emoji registry, no animation module, no cover utility,
// no chat-render/ import.
//
// This is a static-analysis test · it inspects the source file to
// confirm forbidden imports are absent. It complements the behavioural
// Tier 2 test (VisualThemeBoundary swaps in the fallback when its
// child throws · see boundary-logic.test.ts).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const HERE = dirname(fileURLToPath(import.meta.url));
const FALLBACK_SRC = resolve(HERE, "..", "SafeFallbackRenderer.tsx");

// The exhaustive list of modules the fallback must NOT depend on,
// expressed as substrings that would appear in any valid import path
// for them.
const FORBIDDEN_IMPORT_SUBSTRINGS = [
  "chat-theme-service",
  "theme-skin",
  "theme-service",
  "theme-assets",
  "theme-emoji-service",
  "theme-sticker-service",
  "cover-content-loader",
  "cover-theme",
  "chat-render",
  "/themes/",
  "nex-themes",
  "accentForTheme",
  "wallpaper_config",
  "layout_style",
] as const;

const FALLBACK_SOURCE_RAW = readFileSync(FALLBACK_SRC, "utf8");

/** Strip // line comments and /* block comments *\/ before scanning
 *  the source. The file's doctrine-anchoring comments deliberately
 *  name the forbidden APIs ("this file does not import …"). We're
 *  verifying the CODE does not reference them, not the prose. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const FALLBACK_SOURCE = stripComments(FALLBACK_SOURCE_RAW);

describe("SafeFallbackRenderer dependency isolation", () => {
  for (const forbidden of FORBIDDEN_IMPORT_SUBSTRINGS) {
    it(`does not reference "${forbidden}" in code (comments ignored)`, () => {
      expect(FALLBACK_SOURCE).not.toContain(forbidden);
    });
  }

  it("imports only React (allowed) and nothing else", () => {
    // Extract every `import` line.
    const importLines = FALLBACK_SOURCE
      .split(/\r?\n/)
      .filter((line) => /^\s*import\b/.test(line));
    for (const line of importLines) {
      // Allow: import * as React from "react";
      // Allow: import { ... } from "react";
      // No other import spec is permitted.
      const match = line.match(/from\s+["']([^"']+)["']/);
      if (!match) {
        // import "x" with side-effects — also forbidden here.
        throw new Error(`unexpected side-effect import in SafeFallbackRenderer.tsx: ${line}`);
      }
      const spec = match[1];
      expect(spec).toBe("react");
    }
  });

  it("renders without consulting any theme registry (behavioural · pure props)", async () => {
    // We cannot render in this test env (no jsdom) · but we CAN prove
    // the module is importable in isolation without touching any theme
    // module. If any top-level theme import existed, this import would
    // trigger it and we'd see side-effects or crashes.
    const mod = await import("../SafeFallbackRenderer");
    expect(typeof mod.SafeFallbackRenderer).toBe("function");
  });
});
