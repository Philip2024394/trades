// src/components/nex-native/emergency/__tests__/IncidentAlertCard.test.tsx
//
// Structural tests for the responder-facing incident alert card.
// react-testing-library is NOT installed · tests use
// `renderToStaticMarkup` and assert on the HTML string.

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { IncidentAlertCard } from "../IncidentAlertCard";
import type {
  EmergencyIncident,
  IncidentRecipient,
} from "../types";

const baseIncident: EmergencyIncident = {
  incidentId: "inc-test",
  requesterAccountId: "requester-1",
  state: "active",
  category: "general_assistance",
  locationLat: -8.65,
  locationLng: 115.21,
  locationAccuracyMeters: 12,
  locationCapturedAt: new Date().toISOString(),
  simulated: true,
  createdAt: new Date().toISOString(),
  activatedAt: new Date().toISOString(),
  resolvedAt: null,
  cancelledAt: null,
  expiresAt: null,
};

const baseRecipient: IncidentRecipient = {
  recipientId: "rec-test",
  incidentId: "inc-test",
  recipientAccountId: "responder-1",
  layer: "nearby_opted_in",
  distanceMeters: 420,
  notifiedAt: new Date().toISOString(),
  responseStatus: "pending",
  respondedAt: null,
  etaMinutes: null,
};

const noopServices = {
  accept: async (incidentId: string, etaMinutes: number) => ({
    incidentId,
    status: "accepted" as const,
    etaMinutes,
  }),
  decline: async (incidentId: string) => ({
    incidentId,
    status: "declined" as const,
  }),
  withdraw: async (incidentId: string) => ({
    incidentId,
    status: "withdrawn" as const,
  }),
};

describe("IncidentAlertCard · pending state", () => {
  it("shows the SIMULATED badge and the EMERGENCY headline", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain("SIMULATED · v1");
    expect(html).toContain("EMERGENCY — HELP NEEDED");
  });

  it("renders the safety reminder before the primary buttons", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-safety-reminder"');
    const idxReminder = html.indexOf("Help only if it is safe");
    const idxAccept = html.indexOf('data-testid="nex-emergency-accept"');
    expect(idxReminder).toBeGreaterThan(-1);
    expect(idxAccept).toBeGreaterThan(idxReminder);
  });

  it("renders accept + decline buttons on the first paint", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-accept"');
    expect(html).toContain('data-testid="nex-emergency-decline"');
  });

  it("does NOT auto-open the ETA picker on first paint", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-eta-picker"');
  });

  it("renders the distance in metres from the recipient row", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain("420 m away");
  });
});

describe("IncidentAlertCard · accepted state", () => {
  const accepted: IncidentRecipient = {
    ...baseRecipient,
    responseStatus: "accepted",
    etaMinutes: 5,
    respondedAt: new Date().toISOString(),
  };

  it("shows the accepted banner and the withdraw button", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={accepted}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-accepted-state"');
    expect(html).toContain("You accepted · ETA 5 min");
    expect(html).toContain('data-testid="nex-emergency-withdraw"');
  });

  it("hides the primary accept + decline buttons when already accepted", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={accepted}
        services={noopServices}
      />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-accept"');
    expect(html).not.toContain('data-testid="nex-emergency-decline"');
  });
});

describe("IncidentAlertCard · terminal state", () => {
  it("shows the terminal copy when the incident is resolved", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={{ ...baseIncident, state: "resolved" }}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-incident-terminal"');
    expect(html).toContain("This incident is resolved");
    // No actionable buttons when terminal.
    expect(html).not.toContain('data-testid="nex-emergency-accept"');
    expect(html).not.toContain('data-testid="nex-emergency-decline"');
  });

  it("hides the Report to Police entry on terminal incidents", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={{ ...baseIncident, state: "resolved" }}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-report-police"');
  });
});

describe("IncidentAlertCard · Report to Police hand-off", () => {
  it("renders the Report to Police entry on pending state", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-report-police"');
    expect(html).toContain("Too far to help in person?");
  });

  it("renders the Report to Police entry on accepted state", () => {
    const accepted = {
      ...baseRecipient,
      responseStatus: "accepted" as const,
      etaMinutes: 5,
      respondedAt: new Date().toISOString(),
    };
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={accepted}
        services={noopServices}
        requesterCountryCode="US"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-report-police"');
  });

  it("defaults the Report to Police panel to collapsed", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
        requesterCountryCode="ID"
      />,
    );
    // The entry button is present but the panel itself is not yet
    // rendered until the responder taps it.
    expect(html).toContain('data-testid="nex-emergency-report-police"');
    expect(html).not.toContain(
      'data-testid="nex-emergency-report-police-panel"',
    );
    expect(html).toContain('aria-expanded="false"');
  });

  it("entry button has data-nex-emergency-report-police-open=false by default", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain('data-nex-emergency-report-police-open="false"');
  });
});

describe("IncidentAlertCard · pending_confirmation state", () => {
  // Local components-level IncidentState doesn't yet carry the two new
  // L1 states. Cast at the test boundary; the component uses an
  // internal `ExtendedIncidentState` shim that accepts both strings.
  const pendingIncident = {
    ...baseIncident,
    state: "pending_confirmation" as unknown as EmergencyIncident["state"],
    activatedAt: null,
    createdAt: new Date().toISOString(),
  };

  it("renders the cyan pending banner with a 10-second confirmation copy", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={pendingIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-pending-banner"');
    expect(html).toContain("10-second safety confirmation window");
    expect(html).toMatch(/WAIT until it is confirmed/);
  });

  it("renders accept + decline buttons DISABLED during pending_confirmation", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={pendingIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-accept"');
    expect(html).toContain('data-testid="nex-emergency-decline"');
    expect(html).toContain(
      'data-nex-emergency-accept-disabled-reason="pending_confirmation"',
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("cursor:not-allowed");
  });

  it("keeps the Report to Police entry enabled during pending_confirmation", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={pendingIncident}
        myRecipient={baseRecipient}
        services={noopServices}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-report-police"');
  });
});

describe("IncidentAlertCard · revoked_within_window state", () => {
  const revokedIncident = {
    ...baseIncident,
    state: "revoked_within_window" as unknown as EmergencyIncident["state"],
    cancelledAt: new Date().toISOString(),
  };

  it("renders the terminal revoked banner and hides accept/decline/withdraw", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={revokedIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-revoked-banner"');
    expect(html).toContain(
      "cancelled by the requester within the 10-second safety window",
    );
    expect(html).not.toContain('data-testid="nex-emergency-accept"');
    expect(html).not.toContain('data-testid="nex-emergency-decline"');
    expect(html).not.toContain('data-testid="nex-emergency-withdraw"');
  });

  it("keeps the Report to Police entry visible with the independent-concern subtext", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={revokedIncident}
        myRecipient={baseRecipient}
        services={noopServices}
        requesterCountryCode="ID"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-report-police"');
    expect(html).toContain(
      'data-testid="nex-emergency-report-police-revoked-note"',
    );
    expect(html).toContain(
      "Only call if you have independent reason to be concerned",
    );
  });
});

describe("IncidentAlertCard · regressions after pending/revoked wiring", () => {
  it("active state renders the standard accept + decline buttons", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-accept"');
    expect(html).toContain('data-testid="nex-emergency-decline"');
    expect(html).not.toContain('data-testid="nex-emergency-pending-banner"');
    expect(html).not.toContain('data-testid="nex-emergency-revoked-banner"');
    expect(html).not.toContain(
      'data-nex-emergency-accept-disabled-reason="pending_confirmation"',
    );
  });

  it("resolved state continues to render the generic terminal copy", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={{ ...baseIncident, state: "resolved" }}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-incident-terminal"');
    expect(html).not.toContain('data-testid="nex-emergency-revoked-banner"');
  });
});

describe("IncidentAlertCard · custom ETA options", () => {
  // The ETA picker is hidden on first paint · but if a future
  // phase defaults the picker open, this guards the sealed set.
  it("accepts the default [3,5,10,15] ETA options prop", () => {
    const html = renderToStaticMarkup(
      <IncidentAlertCard
        incident={baseIncident}
        myRecipient={baseRecipient}
        services={noopServices}
      />,
    );
    // The props were accepted · the ETA picker still renders only
    // after a tap, so the data-testid is absent on first paint.
    expect(html).not.toContain('data-testid="nex-emergency-eta-3"');
    expect(html).not.toContain('data-testid="nex-emergency-eta-5"');
  });
});
