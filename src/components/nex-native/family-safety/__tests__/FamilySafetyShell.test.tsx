// src/components/nex-native/family-safety/__tests__/FamilySafetyShell.test.tsx
//
// Structural tests for the Family Safety shell.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/nex-native/_page-header", () => ({
  NexPageHeader: () => React.createElement("div", { "data-mock-header": true }),
}));

vi.mock("@/components/nex-native/account-gate/SettingsHeaderSlot", () => ({
  SettingsHeaderSlot: () =>
    React.createElement("div", { "data-mock-settings-slot": true }),
}));

import { FamilySafetyShell } from "../FamilySafetyShell";

describe("FamilySafetyShell · chrome structure", () => {
  it("renders the sealed Family Safety title", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell>
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain(">Family Safety<");
  });

  it("always mounts the SIMULATED · PILOT badge", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell>
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain("SIMULATED · PILOT");
  });

  it("renders the Settings back-link", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell>
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain('href="/nex-native/settings"');
    expect(html).toContain("← Settings");
  });

  it("mounts the nav chips with the active chip marked", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell activeNav="dashboard">
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain('data-nex-family-safety-nav-chip="dashboard"');
    expect(html).toContain(
      'data-nex-family-safety-shell-active="dashboard"',
    );
    // Dashboard chip is marked active via the sealed data attribute.
    expect(html).toMatch(
      /data-nex-family-safety-nav-chip="dashboard"[^>]*data-nex-family-safety-nav-active-chip="true"/,
    );
  });

  it("passes activeNav='none' when the prop is omitted", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell>
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain('data-nex-family-safety-shell-active="none"');
  });

  it("renders children inside the content region", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell>
        <p data-testid="shell-child">hello</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain('data-testid="shell-child"');
    expect(html).toContain("hello");
  });

  it("renders the optional subtitle when provided", () => {
    const html = renderToStaticMarkup(
      <FamilySafetyShell subtitle="hello world">
        <p>child</p>
      </FamilySafetyShell>,
    );
    expect(html).toContain("hello world");
  });
});
