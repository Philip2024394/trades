// src/components/nex-native/account-gate/__tests__/LockedSettingsIcon.test.tsx
//
// Structural tests for the 3D locked-settings icon.
// react-testing-library is NOT installed · tests use
// `renderToStaticMarkup` and assert on the HTML string.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LockedSettingsIcon } from "../LockedSettingsIcon";

function render(size?: number): string {
  return renderToStaticMarkup(React.createElement(LockedSettingsIcon, { size }));
}

describe("LockedSettingsIcon · structure", () => {
  it("renders an <svg> element", () => {
    const html = render();
    expect(html.startsWith("<svg")).toBe(true);
  });

  it("exposes the sealed testid for Playwright selectors", () => {
    const html = render();
    expect(html).toContain('data-testid="nex-settings-locked-icon"');
  });

  it("declares role='img' for accessibility", () => {
    const html = render();
    expect(html).toContain('role="img"');
  });

  it("declares an aria-label mentioning account requirement", () => {
    const html = render();
    expect(html).toMatch(/aria-label="Settings · account required"/);
  });

  it("uses a linearGradient for the 3D body fill", () => {
    const html = render();
    expect(html).toContain("<linearGradient");
    expect(html).toMatch(/stopColor|stop-color/);
  });

  it("renders a padlock shackle path (semicircle on top)", () => {
    const html = render();
    expect(html).toMatch(/M8 11 V8/);
  });

  it("renders the lock body rect", () => {
    const html = render();
    expect(html).toMatch(/<rect[^>]*x="5"[^>]*y="11"[^>]*width="13"[^>]*height="10"/);
  });

  it("renders a keyhole (circle inside body)", () => {
    const html = render();
    expect(html).toMatch(/<circle[^>]*cx="11\.5"[^>]*cy="15\.4"/);
  });

  it("defaults to size 18 (matches sibling icons)", () => {
    const html = render();
    expect(html).toContain('width="18"');
    expect(html).toContain('height="18"');
  });

  it("honours a custom size prop", () => {
    const html = render(28);
    expect(html).toContain('width="28"');
    expect(html).toContain('height="28"');
  });

  it("rendered markup is under the 2KB performance budget", () => {
    const html = render();
    // Budget: < 2048 bytes. Keep the icon lean.
    expect(html.length).toBeLessThan(2048);
  });

  it("carries the data-nex-account-gate-locked-icon marker for lint", () => {
    const html = render();
    expect(html).toContain("data-nex-account-gate-locked-icon");
  });
});
