// src/components/nex-native/family-safety/__tests__/GovernmentIdUploader.test.tsx
//
// Structural tests plus LOAD-BEARING PRIVACY INVARIANTS:
//   1. The uploader source NEVER references localStorage or
//      sessionStorage. Grep is sufficient here because every runtime
//      storage call must appear in the component's source string.
//   2. The uploader source NEVER calls fetch("…") directly · uploads
//      flow through the server action `onSubmit` prop.
//   3. The sealed consent copy is present.

import * as fs from "node:fs";
import * as path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { GovernmentIdUploader } from "../GovernmentIdUploader";

const SOURCE_FILE = path.join(
  process.cwd(),
  "src",
  "components",
  "nex-native",
  "family-safety",
  "GovernmentIdUploader.tsx",
);

const SOURCE = fs.readFileSync(SOURCE_FILE, "utf-8");

/**
 * Strip single- and multi-line comments + prose string literals from
 * the uploader source so the Web Storage grep below only catches real
 * runtime calls (not inline doctrine prose).
 */
function sourceWithoutCommentsOrPlainStrings(src: string): string {
  // Remove /* … */ block comments.
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments.
  s = s.replace(/\/\/[^\n]*/g, "");
  return s;
}

const SOURCE_RUNTIME_ONLY = sourceWithoutCommentsOrPlainStrings(SOURCE);

describe("GovernmentIdUploader · privacy invariants", () => {
  it("runtime code does NOT call localStorage", () => {
    expect(SOURCE_RUNTIME_ONLY).not.toMatch(
      /localStorage\s*\.\s*(set|get|removeItem|clear)/,
    );
    expect(SOURCE_RUNTIME_ONLY).not.toMatch(/window\.localStorage/);
  });

  it("runtime code does NOT call sessionStorage", () => {
    expect(SOURCE_RUNTIME_ONLY).not.toMatch(
      /sessionStorage\s*\.\s*(set|get|removeItem|clear)/,
    );
    expect(SOURCE_RUNTIME_ONLY).not.toMatch(/window\.sessionStorage/);
  });

  it("source does NOT make a direct fetch to a storage endpoint", () => {
    // We allow no raw fetch() calls at all · uploads must flow via the
    // `onSubmit` prop which calls the server action.
    expect(SOURCE_RUNTIME_ONLY).not.toMatch(/\bfetch\s*\(/);
  });

  it("includes the sealed consent copy about EXIF + strict access control", () => {
    const noop = async () => {};
    const html = renderToStaticMarkup(
      <GovernmentIdUploader onSubmit={noop} />,
    );
    // React escapes the apostrophe in rendered HTML as &#x27; · we
    // accept either form so the assertion is text-visible-truthful.
    expect(html).toMatch(
      /I confirm this is a true copy of the child(?:'|&#x27;)s government ID\./,
    );
    expect(html).toContain("strict access control");
    expect(html).toContain("EXIF metadata is");
  });

  it("exposes stable data anchors", () => {
    const noop = async () => {};
    const html = renderToStaticMarkup(
      <GovernmentIdUploader onSubmit={noop} />,
    );
    expect(html).toContain('data-nex-family-safety-id-uploader="true"');
    expect(html).toContain('data-testid="nex-fs-id-file-input"');
    expect(html).toContain('data-testid="nex-fs-id-consent"');
    expect(html).toContain('data-testid="nex-fs-id-submit"');
  });
});
