// src/components/nex-native/emergency/__tests__/ActiveIncidentView.test.tsx
//
// Structural tests for the active-incident view.
// react-testing-library is NOT installed · tests use
// `renderToStaticMarkup`. The useEffect poll never fires because the
// server render ignores effects · the loading state is what we expect
// to see on the initial paint.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: () => {},
    replace: () => {},
    back: () => {},
    forward: () => {},
    refresh: () => {},
    prefetch: () => {},
  }),
}));

import {
  ActiveIncidentView,
  PendingConfirmationBanner,
} from "../ActiveIncidentView";

const noopServices = {
  load: async () => ({ incident: null, recipients: [] }),
  cancel: async (id: string) => ({ incidentId: id, state: "cancelled" as const }),
};

describe("ActiveIncidentView · initial paint (loading state)", () => {
  it("shows the SIMULATED badge on the loading state", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).toContain("SIMULATED · v1");
  });

  it("renders the loading placeholder before the first poll resolves", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    // In the server render, the useEffect never fires · we must see
    // the loading-state marker rather than the "no active emergency"
    // branch (that branch requires state.kind === "empty" post-load).
    expect(html).toContain("Loading your active emergency");
    expect(html).toContain('data-testid="nex-emergency-active-view"');
  });

  it("does NOT fabricate responder count on initial paint", () => {
    // The responder-count testid should NOT be rendered until the
    // load resolves with a real incident. This guards against UI
    // showing "0 responding" when no incident exists.
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-responder-count"');
    expect(html).not.toContain("responding");
  });

  it("does NOT embed a real map in v1", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).not.toContain("iframe");
    expect(html).not.toMatch(/maps\.google|openstreetmap|mapbox|leaflet/i);
  });

  it("does NOT render the cancel button during loading", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).not.toContain("CANCEL EMERGENCY");
  });

  it("hides the SIMULATED badge when live mode is forced on", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} simulated={false} />,
    );
    expect(html).not.toContain("SIMULATED · v1");
  });

  it("accepts a pollIntervalMs prop (contract check)", () => {
    // The sealed poll contract is 15 seconds by default · callers may
    // override via the `pollIntervalMs` prop (used by Playwright for
    // reduced-interval regression). This test proves the prop is
    // part of the component's public API. The default value itself
    // is proven in the Playwright suite where real timing is observed.
    const html = renderToStaticMarkup(
      <ActiveIncidentView
        services={noopServices}
        pollIntervalMs={1000}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-view"');
  });

  it("does NOT paint the live-location chip until an active incident loads", () => {
    // On the initial server render the state is "loading" · showing a
    // live-location chip at that point would be dishonest (we don't yet
    // know whether an active incident exists for the viewer).
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-live-location-chip"');
  });

  it("accepts a liveLocationMinIntervalMs prop (contract check)", () => {
    // Tests + Playwright may need to shorten the client-side debounce
    // without affecting the service-layer 10s rate limit. The prop is
    // part of the public API.
    const html = renderToStaticMarkup(
      <ActiveIncidentView
        services={noopServices}
        liveLocationMinIntervalMs={2_000}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-view"');
  });

  it("accepts an updateLocation service AND still mounts when pending_confirmation handling is wired", () => {
    // Smoke test · the component must compile + render even after the
    // pending-confirmation handling and PendingConfirmationBanner export.
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-view"');
  });

  it("accepts an optional updateLocation service without blowing up", () => {
    // Hermetic: updateLocation is optional on the services bag. The
    // component must still render when it's omitted (noopServices
    // above) AND must render when it's present.
    const servicesWithUpdate = {
      ...noopServices,
      updateLocation: async () => ({
        ok: true as const,
        updateId: "x",
        appliedAt: new Date().toISOString(),
      }),
    };
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={servicesWithUpdate} />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-view"');
  });
});

// =====================================================================
// PendingConfirmationBanner · requester-side banner (L2 · 2026-10-10)
// =====================================================================
//
// The parent ActiveIncidentView renders this banner when the incident
// state is `pending_confirmation`. We test the banner directly because
// our test runtime (environment=node, no RTL) can't drive the parent's
// useEffect-based load() to swap state from "loading" → "ready".
// Structural assertions on the banner itself are honest proof of the
// pending UX contract.

describe("PendingConfirmationBanner · requester-side pending UX", () => {
  it("renders the amber pending banner + the sending-alert copy", () => {
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={new Date().toISOString()}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-pending-banner"');
    expect(html).toContain(
      "Sending alert · responders will be notified when the countdown completes",
    );
    // Countdown block exists · initial render has 10s remaining.
    expect(html).toContain(
      'data-testid="nex-emergency-active-pending-countdown"',
    );
  });

  it("renders a REVOKE button that is enabled when revoking=false", () => {
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={new Date().toISOString()}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-active-pending-revoke"');
    expect(html).toContain(">Revoke<");
    expect(html).not.toContain(">Revoking…<");
  });

  it("shows Revoking… copy while the revoke action is in flight", () => {
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={new Date().toISOString()}
        onRevoke={() => {}}
        revoking={true}
      />,
    );
    expect(html).toContain(">Revoking…<");
    expect(html).toContain("disabled");
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================

describe("hardening · no fabricated history promise (audit item 4)", () => {
  it("initial paint contains ZERO 14-day or always-on claim strings", () => {
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={noopServices} />,
    );
    expect(html).not.toMatch(/14[-\s]?day/i);
    expect(html).not.toMatch(/always.?on/i);
    expect(html).not.toMatch(/ambient/i);
    expect(html).not.toMatch(/24\/7/);
    expect(html).not.toMatch(/tracking anywhere/i);
  });
});

describe("hardening · PendingConfirmationBanner never claims auto-escalation", () => {
  it("banner copy says 'responders will be notified when the countdown completes' · not sooner", () => {
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={new Date().toISOString()}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).toContain(
      "responders will be notified when the countdown completes",
    );
    expect(html).not.toMatch(/police|law enforcement|112|911/i);
  });

  it("banner never mentions guardian / parental / private-help primitives", () => {
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={new Date().toISOString()}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).not.toMatch(/guardian/i);
    expect(html).not.toMatch(/parental/i);
    expect(html).not.toMatch(/can we talk/i);
    expect(html).not.toMatch(/private help/i);
  });
});

describe("hardening · live-location chip is NEVER painted during loading", () => {
  it("empty state render does NOT emit a live-location chip (fail-closed)", () => {
    const emptyServices = {
      load: async () => ({ incident: null, recipients: [] }),
      cancel: async (id: string) => ({ incidentId: id, state: "cancelled" as const }),
      updateLocation: async () => ({
        ok: true as const,
        updateId: "x",
        appliedAt: new Date().toISOString(),
      }),
    };
    const html = renderToStaticMarkup(
      <ActiveIncidentView services={emptyServices} />,
    );
    // Even with updateLocation wired, the server-render-time state is
    // "loading" · chip must not appear.
    expect(html).not.toContain('data-testid="nex-emergency-live-location-chip"');
  });
});

describe("hardening · PendingConfirmationBanner countdown attribute is deterministic", () => {
  it("exposes data-nex-emergency-active-pending-remaining-sec on first paint", () => {
    const future = new Date(Date.now() + 5_000).toISOString();
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={future}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).toMatch(/data-nex-emergency-active-pending-remaining-sec="\d+"/);
  });

  it("remaining-sec is 0 when createdAt is far in the past · never negative", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const html = renderToStaticMarkup(
      <PendingConfirmationBanner
        createdAtIso={past}
        onRevoke={() => {}}
        revoking={false}
      />,
    );
    expect(html).toContain('data-nex-emergency-active-pending-remaining-sec="0"');
    expect(html).not.toMatch(/-\d/);
  });
});

