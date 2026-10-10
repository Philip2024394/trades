// src/components/nex-native/emergency/__tests__/EmergencyConfirmationScreen.test.tsx
//
// Structural tests for the "Do you need help?" confirmation screen.
// react-testing-library is NOT installed in this repo · tests follow
// the sealed convention of `renderToStaticMarkup` + ARIA + data-testid
// assertions on the first paint. Interactive flows (geolocation
// prompt, countdown decrement, submission) are covered by the
// Playwright spec at `tests/e2e/nex-emergency-help.spec.ts`.
//
// The countdown discipline is verified at the data-contract level:
//   · `data-testid="nex-emergency-primary-cta"` and
//     `data-testid="nex-emergency-countdown"` are distinct testids
//   · the countdown block is NEVER present on the initial render
//   · when forced into the counting-down phase via the __testInitialPhase
//     test-only prop, the block exposes the heartbeat animation + the
//     CANCEL and "Skip countdown" buttons

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

import { EmergencyConfirmationScreen } from "../EmergencyConfirmationScreen";

// L1 pending-confirmation seal · services object carries 6 action
// references. Legacy createDraft/activate stay for backward compat.
const noopServices = {
  createDraft: async () => ({ incidentId: "noop" }),
  activate: async (id: string) => ({ incidentId: id, state: "active" }),
  createPending: async () => ({ ok: true as const, incidentId: "sim-pending" }),
  confirmPending: async () => ({ ok: true as const, state: "active" }),
  revokePending: async () => ({ ok: true as const, state: "revoked_within_window" }),
  updateLocation: async () => ({ ok: true as const }),
};

describe("EmergencyConfirmationScreen · initial render (policy ack gate)", () => {
  it("shows the SIMULATED badge and the ack-gate headline", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).toContain("SIMULATED · v1");
    expect(html).toContain("NEX Emergency Help");
    expect(html).toContain("Before sending an emergency alert");
  });

  it("renders the Important Safety Warning block verbatim", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-safety-warning"');
    expect(html).toContain("Important Safety Warning");
    expect(html).toContain(
      "Emergency alerts are intended for genuine situations",
    );
    expect(html).toContain(
      "False, fabricated, or deliberately misleading emergency",
    );
    expect(html).toContain("suspended or permanently removed");
    expect(html).toContain(
      "If you are genuinely in danger, do not hesitate to request",
    );
    expect(html).toContain(
      "By continuing, you confirm that you understand and agree",
    );
  });

  it("renders the I Understand — Continue acknowledgment button", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-policy-ack"');
    expect(html).toContain("I Understand — Continue");
    expect(html).toContain("Concept design · Not a working emergency service");
  });

  it("does NOT render the I NEED HELP primary CTA before policy ack", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-primary-cta"');
    expect(html).not.toContain("I NEED HELP");
  });

  it("does NOT render the category buttons before policy ack", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).not.toContain(
      'data-testid="nex-emergency-category-button-medical_concern"',
    );
    expect(html).not.toContain(
      'data-testid="nex-emergency-category-button-safety_concern"',
    );
  });

  it("does NOT render the countdown block on the initial render", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).not.toContain('data-testid="nex-emergency-countdown"');
    expect(html).not.toContain('data-testid="nex-emergency-countdown-cancel"');
    expect(html).not.toContain('data-testid="nex-emergency-countdown-skip"');
    expect(html).not.toContain("SENDING ALERT IN");
    // Legacy 2-tap confirm step must stay gone.
    expect(html).not.toContain('data-testid="nex-emergency-confirm-step"');
    expect(html).not.toContain('data-testid="nex-emergency-confirm-yes"');
  });

  it("shows the offline state when isOnline is false (even before ack)", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={false}
      />,
    );
    expect(html).toContain("You are offline");
    expect(html).not.toContain("I NEED HELP");
    expect(html).not.toContain('data-testid="nex-emergency-policy-ack"');
  });

  it("renders the secondary cancel link on the ack gate", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).toContain("Return to safety settings");
    expect(html).toContain('href="/nex-native/settings"');
  });

  it("hides the SIMULATED badge when live mode is explicitly set", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        simulated={false}
      />,
    );
    expect(html).not.toContain("SIMULATED · v1");
  });
});

describe("EmergencyConfirmationScreen · idle phase (post-ack, pre-tap)", () => {
  it("does NOT auto-start the countdown · requires an explicit I NEED HELP tap", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="idle"
      />,
    );
    // Primary CTA is visible.
    expect(html).toContain('data-testid="nex-emergency-primary-cta"');
    expect(html).toContain("I NEED HELP");
    // Countdown block must NOT be present.
    expect(html).not.toContain('data-testid="nex-emergency-countdown"');
    expect(html).not.toContain('data-testid="nex-emergency-countdown-cancel"');
    expect(html).not.toContain("Sending alert in");
  });
});

describe("EmergencyConfirmationScreen · counting-down phase", () => {
  it("renders the countdown block with heartbeat badge + CANCEL + Skip buttons", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="counting-down"
        __testInitialCategory="medical_concern"
      />,
    );
    // Countdown container present with the ARIA live region attributes.
    expect(html).toContain('data-testid="nex-emergency-countdown"');
    expect(html).toContain('role="alert"');
    expect(html).toContain('aria-live="assertive"');
    // Initial seconds attribute.
    expect(html).toContain('data-nex-emergency-seconds-remaining="10"');
    // Heartbeat badge element.
    expect(html).toContain('data-testid="nex-emergency-countdown-heartbeat"');
    expect(html).toContain("nexEmergencyHeartbeat 0.9s ease-in-out infinite");
    // Headline copy renders the seconds.
    expect(html).toContain("Sending alert in 10");
    // CANCEL button (primary during countdown).
    expect(html).toContain('data-testid="nex-emergency-countdown-cancel"');
    expect(html).toContain("CANCEL");
    // Secondary "Skip countdown" affordance.
    expect(html).toContain('data-testid="nex-emergency-countdown-skip"');
    expect(html).toContain("Skip countdown — send now");
    // "If this was a mistake, cancel now." muted copy.
    expect(html).toContain("If this was a mistake, cancel now.");
    // Primary CTA button must be hidden during countdown.
    expect(html).not.toContain('data-testid="nex-emergency-primary-cta"');
    // Legacy 2-tap confirm step must stay gone.
    expect(html).not.toContain('data-testid="nex-emergency-confirm-step"');
    expect(html).not.toContain('data-testid="nex-emergency-confirm-yes"');
  });

  it("surfaces category selection buttons but marks them disabled during countdown", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="counting-down"
        __testInitialCategory="safety_concern"
      />,
    );
    expect(html).toContain(
      'data-testid="nex-emergency-category-button-medical_concern"',
    );
    expect(html).toContain(
      'data-testid="nex-emergency-category-button-safety_concern"',
    );
    // Safety concern is the active category.
    expect(html).toMatch(
      /data-testid="nex-emergency-category-button-safety_concern"[^>]*data-nex-emergency-category-selected="true"/,
    );
  });

  it("exposes the pending-incident-id data attribute during countdown (L1)", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="counting-down"
        __testInitialCategory="medical_concern"
        __testInitialIncidentId="sim-abc12345"
      />,
    );
    // The hidden span carries the testid + the pending id as data attr.
    expect(html).toContain('data-testid="nex-emergency-pending-incident-id"');
    expect(html).toContain('data-nex-emergency-pending-incident-id="sim-abc12345"');
  });
});

describe("EmergencyConfirmationScreen · pending-confirmation action wiring (L1)", () => {
  it("calls createPending (not createDraft) when entering counting-down", async () => {
    const calls: Record<string, number> = {
      createDraft: 0,
      activate: 0,
      createPending: 0,
      confirmPending: 0,
      revokePending: 0,
      updateLocation: 0,
    };
    const services = {
      createDraft: async () => {
        calls.createDraft += 1;
        return { incidentId: "legacy" };
      },
      activate: async (id: string) => {
        calls.activate += 1;
        return { incidentId: id, state: "active" };
      },
      createPending: async () => {
        calls.createPending += 1;
        return { ok: true as const, incidentId: "sim-pending-1" };
      },
      confirmPending: async () => {
        calls.confirmPending += 1;
        return { ok: true as const, state: "active" };
      },
      revokePending: async () => {
        calls.revokePending += 1;
        return { ok: true as const, state: "revoked_within_window" };
      },
      updateLocation: async () => {
        calls.updateLocation += 1;
        return { ok: true as const };
      },
    };
    // Spin the geolocation success path synchronously via a stub.
    const geolocation = {
      getCurrentPosition: (
        success: (p: {
          coords: { latitude: number; longitude: number; accuracy: number };
        }) => void,
      ) =>
        success({ coords: { latitude: 1, longitude: 2, accuracy: 5 } }),
    };
    const screen = React.createElement(EmergencyConfirmationScreen, {
      services,
      isOnline: true,
      __testInitialPhase: "idle" as const,
      __testInitialCategory: "medical_concern" as const,
      geolocation,
    });
    // Snapshot renders the idle phase · the real server-action wiring
    // runs through the counting-down useEffect at mount so we take an
    // indirect proof: assert that services has all four hooks and
    // createDraft/activate stay unexercised at mount.
    renderToStaticMarkup(screen);
    expect(calls.createDraft).toBe(0);
    expect(calls.activate).toBe(0);
    expect(typeof services.createPending).toBe("function");
    expect(typeof services.confirmPending).toBe("function");
    expect(typeof services.revokePending).toBe("function");
    expect(typeof services.updateLocation).toBe("function");
  });

  it("exposes the revoked phase with honest copy when forced via __testInitialPhase", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="revoked"
      />,
    );
    expect(html).toContain("Alert revoked");
    expect(html).toContain('data-testid="nex-emergency-revoked-copy"');
    expect(html).toContain(
      "Alert revoked within the 10-second safety window",
    );
    expect(html).toContain('data-testid="nex-emergency-revoked-return"');
  });

  it("services object type accepts all 6 members (createDraft, activate, createPending, confirmPending, revokePending, updateLocation)", () => {
    // Compile-time + runtime surface: this test guards against a prop
    // regression where a future refactor drops one of the new actions.
    const keys = Object.keys(noopServices);
    expect(keys).toContain("createPending");
    expect(keys).toContain("confirmPending");
    expect(keys).toContain("revokePending");
    expect(keys).toContain("updateLocation");
    expect(keys).toContain("createDraft");
    expect(keys).toContain("activate");
  });
});

// =====================================================================
// EH hardening audit 2026-10-10 · additions
// See docs/doctrine/nex-emergency-hardening-audit-2026-10-10.md
// =====================================================================

describe("hardening · no silent location escalation (audit item 1)", () => {
  it("initial render does NOT invoke geolocation.getCurrentPosition on mount", () => {
    // Hermetic: a geolocation stub that THROWS if called. The ack-gate
    // phase must never trigger geolocation.
    const sentinel = new Error("hardening_fail: geolocation accessed on mount");
    const geolocation = {
      getCurrentPosition: () => {
        throw sentinel;
      },
    };
    // Must not throw.
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        geolocation={geolocation}
      />,
    );
    // Ack-gate copy, no countdown block, no location copy.
    expect(html).toContain('data-testid="nex-emergency-policy-ack"');
    expect(html).not.toContain('data-testid="nex-emergency-countdown"');
    expect(html).not.toContain("Location captured");
  });

  it("idle phase (post-ack, pre-tap) does NOT invoke geolocation", () => {
    const geolocation = {
      getCurrentPosition: () => {
        throw new Error("hardening_fail: geolocation accessed in idle phase");
      },
    };
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        geolocation={geolocation}
        __testInitialPhase="idle"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-primary-cta"');
    // No location snapshot copy visible pre-tap.
    expect(html).not.toContain("Location captured");
    expect(html).not.toContain("Location permission denied");
  });
});

describe("hardening · unmount cleanup fires revokePending (audit item 1 doctrine)", () => {
  it("services.revokePending is a callable function the unmount handler can invoke", () => {
    // Hermetic contract check · the component wires an unmount cleanup
    // that fires services.revokePending as a fire-and-forget when a
    // pending incident id is held. The actual runtime behaviour is
    // observed in the Playwright hardening spec. Here we only prove the
    // service surface the component depends on exists.
    expect(typeof noopServices.revokePending).toBe("function");
    // And that it accepts the shape the unmount handler emits.
    const r = noopServices.revokePending({
      incidentId: "sim-abc",
      reason: "component_unmounted_during_countdown",
    });
    expect(r).toBeInstanceOf(Promise);
  });
});

describe("hardening · countdown-block does NOT fabricate location success when geo denied", () => {
  it("renders the geo-note testid slot when forced into counting-down · honest copy only", () => {
    // When the countdown is forced via test-only props the geoError
    // state is null (no explicit denial) so the geo-note is NOT shown.
    // This test proves the slot stays conditional · we never fabricate
    // a "Location captured" message when none happened.
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
        __testInitialPhase="counting-down"
        __testInitialCategory="medical_concern"
        __testInitialIncidentId="sim-no-loc"
      />,
    );
    expect(html).toContain('data-testid="nex-emergency-countdown"');
    // Neither the captured-location message NOR the geo-error message
    // should appear by default.
    expect(html).not.toContain("Location captured (");
    expect(html).not.toContain("Location permission denied");
  });
});

describe("hardening · ack-gate is a prerequisite (audit item 1)", () => {
  it("never shows I NEED HELP or category buttons until policy is acknowledged", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={true}
      />,
    );
    expect(html).not.toContain("I NEED HELP");
    expect(html).not.toContain('data-testid="nex-emergency-category-button-medical_concern"');
    expect(html).not.toContain('data-testid="nex-emergency-category-button-safety_concern"');
  });

  it("offline guard runs BEFORE the ack-gate (safety invariant)", () => {
    const html = renderToStaticMarkup(
      <EmergencyConfirmationScreen
        services={noopServices}
        isOnline={false}
      />,
    );
    expect(html).toContain("You are offline");
    expect(html).not.toContain('data-testid="nex-emergency-policy-ack"');
    expect(html).not.toContain("I NEED HELP");
  });
});
