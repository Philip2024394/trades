// src/components/nex-app/shell/ControlCenterPanel.test.tsx
//
// NEX Phase 3 · Control Center panel tests · pure structural (§4)
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 3
//
// Uses react-test-renderer style via vitest snapshot-free assertions
// on JSDOM. Focuses on the §4 immutable rules:
//   · isOpen=false renders nothing
//   · isOpen=true renders panel with the 5 §4 groups
//   · destinations that don't exist render as disabled buttons with
//     the "Not available yet" chip (never fabricated)
//   · at least one AVAILABLE destination (Messages) links out

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlCenterPanel } from "./ControlCenterPanel";

describe("ControlCenterPanel · §4 structural contract", () => {
  it("isOpen=false renders nothing", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: false,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toBe("");
  });

  it("isOpen=true renders the panel with the 5 §4 groups", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    for (const label of ["Account", "Conversation", "Privacy", "Your World", "NEX"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Control Center");
  });

  it("destinations that don't exist yet render disabled with an honest chip", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain("Not available yet");
    // Security is one of the destinations known to not ship until later.
    expect(html).toContain("Security");
    expect(html).toContain('data-availability="NOT_YET_AVAILABLE"');
  });

  it("Live in your city is available and rendered as a real link", () => {
    // Messages entry removed 2026-09-06 per Founder direction · Live
    // in your city is now the primary AVAILABLE destination in the
    // Control Center taxonomy.
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain('href="/nex-app/live"');
    expect(html).toContain('data-availability="AVAILABLE"');
    expect(html).not.toContain('href="/nex-app/messages"');
  });

  it("carries the honesty footer per §4 immutable", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain("NEX never fabricates a destination");
  });

  it("panelId is applied to the root element (aria-controls target)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "nex-control-center-hero",
      }),
    );
    expect(html).toContain('id="nex-control-center-hero"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-label="NEX Control Center"');
  });
});
