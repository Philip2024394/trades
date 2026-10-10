// src/components/nex-native/emergency/__tests__/ReportToPolicePanel.test.tsx
//
// Structural tests for the responder-side "Report to Police"
// hand-off panel. react-testing-library is NOT installed in this
// repo · we use `renderToStaticMarkup` and assert on the HTML string.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  POLICE_HANDOFF_DISCLAIMER,
  ReportToPolicePanel,
} from "../ReportToPolicePanel";

describe("ReportToPolicePanel · country routing", () => {
  it("Indonesia → shows 112 and tel:112 link", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain("Indonesia");
    expect(html).toContain('href="tel:112"');
    expect(html).toContain("Call 112");
  });

  it("United States → tel:911", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={37.77}
        requesterLng={-122.42}
        requesterCountryCode="US"
      />,
    );
    expect(html).toContain('href="tel:911"');
    expect(html).toContain("Call 911");
    expect(html).toContain("United States");
  });

  it("United Kingdom → tel:999", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={51.5}
        requesterLng={-0.12}
        requesterCountryCode="GB"
      />,
    );
    expect(html).toContain('href="tel:999"');
  });

  it("Australia → tel:000", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-33.87}
        requesterLng={151.21}
        requesterCountryCode="AU"
      />,
    );
    expect(html).toContain('href="tel:000"');
  });

  it("unknown country → international fallback tel:112", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={0}
        requesterLng={0}
        requesterCountryCode="XX"
      />,
    );
    expect(html).toContain('href="tel:112"');
    expect(html).toContain("International (fallback)");
  });

  it("null country code → international fallback tel:112", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={0}
        requesterLng={0}
        requesterCountryCode={null}
      />,
    );
    expect(html).toContain('href="tel:112"');
  });

  it("lower-case country code is still resolved", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={0}
        requesterLng={0}
        requesterCountryCode="id"
      />,
    );
    expect(html).toContain('href="tel:112"');
    expect(html).toContain("Indonesia");
  });
});

describe("ReportToPolicePanel · tel href invariant", () => {
  it("tel: href is exactly the number literal · never contains coordinates", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65123}
        requesterLng={115.21456}
        requesterCountryCode="US"
      />,
    );
    expect(html).toMatch(/href="tel:911"/);
    expect(html).not.toMatch(/href="tel:[^"]*,[^"]*"/);
    expect(html).not.toMatch(/href="tel:[^"]*-8\.65/);
  });

  it("tel: href never contains lat/lng even for unknown country", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={37.123}
        requesterLng={-122.456}
        requesterCountryCode="ZZ-UNKNOWN"
      />,
    );
    expect(html).toMatch(/href="tel:112"/);
    expect(html).not.toContain('href="tel:37.123');
  });
});

describe("ReportToPolicePanel · coordinates block", () => {
  it("renders the coordinates block to 5 decimal places when provided", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.651234567}
        requesterLng={115.214567890}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain("-8.65123, 115.21457");
    expect(html).toContain(
      "Share these coordinates when speaking to the operator",
    );
  });

  it("renders a Copy coordinates button when coordinates are present", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toMatch(
      /data-testid="nex-emergency-report-police-panel-copy"/,
    );
    expect(html).toContain("Copy coordinates");
  });

  it("renders muted 'no coordinates' copy when lat/lng are null", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={null}
        requesterLng={null}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain(
      'data-testid="nex-emergency-report-police-panel-no-coords"',
    );
    expect(html).not.toContain(
      'data-testid="nex-emergency-report-police-panel-coords"',
    );
    expect(html).not.toContain("Copy coordinates");
  });

  it("coordinates value is in a <code> block (selectable)", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toMatch(
      /<code[^>]*data-testid="nex-emergency-report-police-panel-coords-value"/,
    );
  });

  it("missing lng alone still routes to the 'no coords' branch", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={null}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain(
      'data-testid="nex-emergency-report-police-panel-no-coords"',
    );
  });
});

describe("ReportToPolicePanel · load-bearing disclaimer", () => {
  it("renders the exact disclaimer verbatim (apostrophe HTML-entity-encoded by React SSR)", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    // React's server renderer encodes apostrophes as &#x27;. The
    // runtime DOM text content equals POLICE_HANDOFF_DISCLAIMER
    // exactly · we assert on both the encoded HTML form and the
    // literal (unencoded) decoded form.
    const encoded = POLICE_HANDOFF_DISCLAIMER.replace(/'/g, "&#x27;");
    expect(html).toContain(encoded);
    expect(html).toContain("NEX has not contacted emergency services");
    expect(html).toContain("opens your");
    expect(html).toContain("dialer");
    expect(html).toContain("speak to the operator");
  });

  it("exports the disclaimer constant for reuse by consumer tests", () => {
    expect(POLICE_HANDOFF_DISCLAIMER).toMatch(
      /^NEX has not contacted emergency services on your behalf\./,
    );
    expect(POLICE_HANDOFF_DISCLAIMER).toContain("opens your phone's dialer");
    expect(POLICE_HANDOFF_DISCLAIMER).toContain("speak to the operator");
  });

  it("disclaimer is in the DOM AFTER the Call button (visual hierarchy)", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    const idxCall = html.indexOf(
      'data-testid="nex-emergency-report-police-panel-call-link"',
    );
    const idxDisclaimer = html.indexOf(
      'data-testid="nex-emergency-report-police-panel-disclaimer"',
    );
    expect(idxCall).toBeGreaterThan(-1);
    expect(idxDisclaimer).toBeGreaterThan(idxCall);
  });
});

describe("ReportToPolicePanel · SIMULATED chip", () => {
  it("renders the SIMULATED chip by default", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain("SIMULATED · v1");
  });

  it("suppresses the SIMULATED chip when simulated=false", () => {
    const html = renderToStaticMarkup(
      <ReportToPolicePanel
        requesterLat={-8.65}
        requesterLng={115.21}
        requesterCountryCode="ID"
        simulated={false}
      />,
    );
    expect(html).not.toContain("SIMULATED · v1");
  });
});
