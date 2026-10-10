// src/components/nex-native/family-safety/__tests__/ChildCreateWizardShell.test.tsx

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChildCreateWizardShell } from "../ChildCreateWizardShell";

describe("ChildCreateWizardShell · progress + banner", () => {
  it("renders three step markers · one per step", () => {
    const html = renderToStaticMarkup(
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={false}
        title="Step 1"
      >
        <p>body</p>
      </ChildCreateWizardShell>,
    );
    for (const k of [1, 2, 3]) {
      expect(html).toContain(
        `data-nex-family-safety-wizard-step-marker="${k}"`,
      );
    }
  });

  it("marks the current step with aria-current='step'", () => {
    const html = renderToStaticMarkup(
      <ChildCreateWizardShell
        step={2}
        liveModeAuthorised={false}
        title="Step 2"
      >
        <p>body</p>
      </ChildCreateWizardShell>,
    );
    // React may reorder attributes · we assert both sentinels appear
    // on the same opening tag of the step-2 marker.
    const match = html.match(
      /<li\b[^>]*data-nex-family-safety-wizard-step-marker="2"[^>]*>/,
    );
    expect(match).not.toBeNull();
    expect(match![0]).toContain('aria-current="step"');
    expect(match![0]).toContain(
      'data-nex-family-safety-wizard-step-marker-state="current"',
    );
  });

  it("renders the LegalClearancePendingBanner when live-mode OFF", () => {
    const html = renderToStaticMarkup(
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={false}
        title="Step 1"
      >
        <p>body</p>
      </ChildCreateWizardShell>,
    );
    expect(html).toContain(
      'data-nex-family-safety-legal-clearance-banner="true"',
    );
  });

  it("suppresses the banner when live-mode ON", () => {
    const html = renderToStaticMarkup(
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={true}
        title="Step 1"
      >
        <p>body</p>
      </ChildCreateWizardShell>,
    );
    expect(html).not.toContain(
      'data-nex-family-safety-legal-clearance-banner="true"',
    );
  });

  it("renders a cancel link when cancelHref is provided", () => {
    const html = renderToStaticMarkup(
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={false}
        title="Step 1"
        cancelHref="/nex-native/family-safety"
      >
        <p>body</p>
      </ChildCreateWizardShell>,
    );
    expect(html).toContain('data-testid="nex-family-safety-wizard-cancel"');
  });
});
