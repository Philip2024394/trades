// src/components/nex-native/family-safety/ChildAccountDashboardPanel.test.tsx
//
// CC-3 · Per-child dashboard panel render tests. SSR-only.

import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChildAccountDashboardPanel } from "./ChildAccountDashboardPanel";

const BASE_PROPS = {
  childDisplayLabel: "Linked child",
  linkType: "created_minor" as const,
  autoTransferAt: "2027-04-01T00:00:00.000Z",
  transferredAt: null,
  nowIso: "2026-10-10T00:00:00.000Z",
  simulated: true,
  safechatEnforced: true,
  ageTransitionHref: "/nex-native/family-safety/age-transition/x",
  safeChatHref: "/nex-native/family-safety/dashboard/children/x/safechat",
};

describe("ChildAccountDashboardPanel", () => {
  it("renders the child display label", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toContain("Linked child");
  });

  it("renders the age-transition countdown when autoTransferAt is set", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(/nex-family-safety-age-transition-countdown/);
  });

  it("renders the age-transition deep link only when not yet transferred", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(/nex-family-safety-child-age-transition-link/);
  });

  it("hides the age-transition link when transferred_at is set", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel
        {...BASE_PROPS}
        transferredAt="2027-04-02T00:00:00.000Z"
      />,
    );
    expect(html).not.toMatch(/nex-family-safety-child-age-transition-link/);
    expect(html).toMatch(/nex-family-safety-age-transition-completed/);
  });

  it("renders the SafeChat always-on chip when safechatEnforced=true", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(/nex-family-safety-child-safechat-chip/);
    expect(html).toMatch(/safechat on/i);
  });

  it("omits the SafeChat always-on chip when safechatEnforced=false", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} safechatEnforced={false} />,
    );
    expect(html).not.toMatch(/nex-family-safety-child-safechat-chip/);
  });

  it("renders the simulated chip when simulated=true", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(/nex-family-safety-child-simulated-chip/);
  });

  it("renders the CC-2 audit log slot when provided", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel
        {...BASE_PROPS}
        customAuditLog={<p data-testid="cc2-slot">cc2 action log here</p>}
      />,
    );
    expect(html).toMatch(/nex-family-safety-child-audit-log-slot/);
    expect(html).toContain("cc2 action log here");
  });

  it("renders the audit-log placeholder when CC-2 slot is missing", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(/nex-family-safety-child-audit-log-pending/);
  });

  it("does NOT leak any UUID-shaped account id in the DOM", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
    );
  });

  it("surfaces the link type as a human label", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} linkType="manual_grant" />,
    );
    expect(html).toMatch(/Manual grant/i);
  });

  it("tags the panel with the link-type data attribute", () => {
    const html = renderToStaticMarkup(
      <ChildAccountDashboardPanel {...BASE_PROPS} />,
    );
    expect(html).toMatch(
      /data-nex-family-safety-child-dashboard-link-type="created_minor"/,
    );
  });
});
