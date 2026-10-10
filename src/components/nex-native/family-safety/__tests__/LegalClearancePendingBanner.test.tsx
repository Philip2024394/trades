// src/components/nex-native/family-safety/__tests__/LegalClearancePendingBanner.test.tsx
//
// Structural tests for the Family Safety legal-clearance banner.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LegalClearancePendingBanner } from "../LegalClearancePendingBanner";

describe("LegalClearancePendingBanner", () => {
  it("renders the sealed copy when liveModeAuthorised=false", () => {
    const html = renderToStaticMarkup(
      <LegalClearancePendingBanner liveModeAuthorised={false} />,
    );
    expect(html).toContain(
      "Awaiting Indonesian legal clearance before NEX can create live child accounts.",
    );
    expect(html).toContain("Your submission is held safely");
  });

  it("has a stable data-attribute anchor", () => {
    const html = renderToStaticMarkup(
      <LegalClearancePendingBanner liveModeAuthorised={false} />,
    );
    expect(html).toContain(
      'data-nex-family-safety-legal-clearance-banner="true"',
    );
  });

  it("renders nothing when liveModeAuthorised=true", () => {
    const html = renderToStaticMarkup(
      <LegalClearancePendingBanner liveModeAuthorised={true} />,
    );
    expect(html).toBe("");
  });

  it("exposes a role of 'status' for assistive tech", () => {
    const html = renderToStaticMarkup(
      <LegalClearancePendingBanner liveModeAuthorised={false} />,
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-label="Legal clearance pending"');
  });
});
