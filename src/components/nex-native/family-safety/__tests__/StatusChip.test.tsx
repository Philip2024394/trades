// src/components/nex-native/family-safety/__tests__/StatusChip.test.tsx
//
// Structural tests for the Family Safety reusable status chip.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StatusChip } from "../StatusChip";
import type { StatusChipTone } from "../types";

const TONES: readonly StatusChipTone[] = [
  "neutral",
  "info",
  "pending",
  "active",
  "revoked",
  "expired",
  "suspended",
];

describe("StatusChip · one chip per tone", () => {
  for (const tone of TONES) {
    it(`renders a chip for tone='${tone}' with the sealed data-attr`, () => {
      const html = renderToStaticMarkup(
        <StatusChip tone={tone} label="hello" />,
      );
      expect(html).toContain(
        `data-nex-family-safety-status-chip-tone="${tone}"`,
      );
      expect(html).toContain(
        `data-testid="nex-family-safety-status-chip-${tone}"`,
      );
      expect(html).toContain("hello");
    });
  }

  it("exposes an accessible label via role='status' + aria-label", () => {
    const html = renderToStaticMarkup(
      <StatusChip tone="active" label="Guardian" />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="status Guardian"');
  });

  it("renders a custom glyph when provided", () => {
    const html = renderToStaticMarkup(
      <StatusChip tone="info" label="Info" glyph="ℹ️" />,
    );
    expect(html).toContain("ℹ️");
  });

  it("accepts a testId override", () => {
    const html = renderToStaticMarkup(
      <StatusChip tone="pending" label="Waiting" testId="my-chip" />,
    );
    expect(html).toContain('data-testid="my-chip"');
  });

  it("uses family-green for the active tone", () => {
    const html = renderToStaticMarkup(
      <StatusChip tone="active" label="Active" />,
    );
    // family-green value from palette · literal check as regression anchor.
    expect(html).toMatch(/#22C55E|rgba\(34, 197, 94/);
  });
});
