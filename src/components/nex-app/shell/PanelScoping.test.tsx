// src/components/nex-app/shell/PanelScoping.test.tsx
//
// NEX · Phase D · P0 · Panel-scoping architectural contract
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase D §2 §3 §4 §5 §44
//
// Locks in the "inside NEX phone frame" invariant:
//   · ControlCenterPanel MUST use `absolute` positioning (not `fixed`)
//     so the overlay never escapes the max-w-md phone shell.
//   · ProfilePanel MUST also use `absolute`.
//   · Both panels expose `data-scope="phone-frame"` for the browser
//     journey proof to bounding-box-check.
//
// If any of these assertions ever regress, the panel would visually
// leak into the empty space beside the phone frame at desktop widths —
// making NEX "feel like a website" instead of an app. This test is a
// hard architectural guard.

import React from "react";
import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ControlCenterPanel } from "./ControlCenterPanel";
import { ProfilePanel } from "./ProfilePanel";

describe("Phase D · panel scoping · §44 no desktop leakage", () => {
  it("ControlCenterPanel root uses `absolute` NOT `fixed` positioning", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    // Extract the outer div className
    expect(html).toMatch(/data-testid="nex-control-center-panel"[^>]*class="[^"]*absolute inset-0[^"]*"/);
    expect(html).not.toMatch(/data-testid="nex-control-center-panel"[^>]*class="[^"]*\bfixed\b[^"]*"/);
  });

  it("ControlCenterPanel carries data-scope=\"phone-frame\" for browser proofs", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain('data-scope="phone-frame"');
  });

  it("ProfilePanel root uses `absolute` NOT `fixed` positioning", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfilePanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toMatch(/data-testid="nex-profile-panel"[^>]*class="[^"]*absolute inset-0[^"]*"/);
    expect(html).not.toMatch(/data-testid="nex-profile-panel"[^>]*class="[^"]*\bfixed\b[^"]*"/);
  });

  it("ProfilePanel carries data-scope=\"phone-frame\" and is DISTINCT from Control Center", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfilePanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test-profile",
      }),
    );
    expect(html).toContain('data-scope="phone-frame"');
    // §5 immutable · Profile identity is a separate surface
    expect(html).toContain('aria-label="NEX Profile"');
    expect(html).not.toContain("Control Center");
  });

  it("Messages entry is no longer present · deleted 2026-09-06", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).not.toContain('href="/nex-app/messages"');
  });

  it("Live in your city is an AVAILABLE Control Center destination · Phase D §11", () => {
    const html = renderToStaticMarkup(
      React.createElement(ControlCenterPanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain('href="/nex-app/live"');
    expect(html).toContain("Live in your city");
  });
});

describe("Phase D · ProfilePanel honest empty state · §5 no fabrication", () => {
  it("shows honest 'coming soon' copy · never fake profile stats", () => {
    const html = renderToStaticMarkup(
      React.createElement(ProfilePanel, {
        isOpen: true,
        onClose: () => {},
        panelId: "test",
      }),
    );
    expect(html).toContain("Not available yet");
    expect(html).toContain("NEX will never fabricate profile data");
    // Should NOT contain fake follower / viewer / stats language
    expect(html.toLowerCase()).not.toContain("followers");
    expect(html.toLowerCase()).not.toContain("viewer count");
  });
});
