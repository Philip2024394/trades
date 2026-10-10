// src/components/nex-native/emergency/ReportToPolicePanel.tsx
//
// NEX Emergency Help · "Report to Police" responder-side hand-off.
// Sealed 2026-10-10 by the Radius + Report-to-Police agent (H2).
// -----------------------------------------------------------------
// Purpose:
//   A responder who is too far away OR unable to physically assist
//   can still help by calling local emergency services and relaying
//   the requester's GPS coordinates. This panel:
//     · Looks up the responder's local emergency number by country.
//     · Opens the device dialer via `tel:` on primary tap.
//     · Shows the requester's coordinates in a copyable block so
//       the responder can read them to the operator.
//     · Shouts the "NEX has NOT contacted emergency services"
//       invariant in muted copy. This is the load-bearing legal
//       disclosure — do not weaken it.
//
// Doctrine · load-bearing anti-patterns:
//   · Never put the lat/lng in the `tel:` href. Phone dialers do not
//     interpret coordinates and some will refuse to open a `tel:`
//     link containing commas / minus signs.
//   · Never auto-dial. The responder must consciously tap the link.
//   · Never claim NEX "called" or "notified" emergency services.
//     NEX hands off, nothing more.
//   · Keep text selectable (no `user-select: none`) so the responder
//     can copy coordinates if the clipboard API is blocked.
//
// Country-code source:
//   The country-code prop is expected to be ISO 3166-1 alpha-2 (e.g.
//   "ID", "US"). v1 passes the requester-side value verbatim; later
//   phases may switch to the responder's locale (because they are the
//   one placing the call). Both are supported by the resolver's
//   `null`-safe fallback.

"use client";

import * as React from "react";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";
import {
  resolveEmergencyNumber,
  type LocalEmergencyNumber,
} from "@/lib/nex-native/emergency/local-emergency-numbers";

export interface ReportToPolicePanelProps {
  /** Requester latitude (WGS84). Null when the requester did not share location. */
  readonly requesterLat: number | null;
  /** Requester longitude (WGS84). Null when the requester did not share location. */
  readonly requesterLng: number | null;
  /** ISO 3166-1 alpha-2 country code · null/empty → international 112 fallback. */
  readonly requesterCountryCode: string | null;
  /** When true (default), the SIMULATED chip is rendered. */
  readonly simulated?: boolean;
  /** Optional override of the test-id prefix. */
  readonly testId?: string;
}

/**
 * Load-bearing legal disclaimer. The exact wording is referenced
 * by unit tests and by the Emergency Help doctrine · do not reword
 * without updating both.
 */
export const POLICE_HANDOFF_DISCLAIMER =
  "NEX has not contacted emergency services on your behalf. Tapping the button above opens your phone's dialer. You must speak to the operator and relay the location.";

export function ReportToPolicePanel({
  requesterLat,
  requesterLng,
  requesterCountryCode,
  simulated = true,
  testId = "nex-emergency-report-police-panel",
}: ReportToPolicePanelProps): React.JSX.Element {
  const emergencyNumber: LocalEmergencyNumber = React.useMemo(
    () => resolveEmergencyNumber(requesterCountryCode),
    [requesterCountryCode],
  );

  const hasCoords =
    typeof requesterLat === "number" &&
    typeof requesterLng === "number" &&
    Number.isFinite(requesterLat) &&
    Number.isFinite(requesterLng);

  const coordsText = hasCoords
    ? `${(requesterLat as number).toFixed(5)}, ${(requesterLng as number).toFixed(5)}`
    : null;

  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle");

  const handleCopy = React.useCallback(async () => {
    if (!coordsText) return;
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(coordsText);
        setCopyState("copied");
      } else {
        // Fallback: temporary textarea + execCommand. Deprecated but
        // the only way without the Clipboard API in old WebViews.
        if (typeof document !== "undefined") {
          const ta = document.createElement("textarea");
          ta.value = coordsText;
          ta.setAttribute("readonly", "");
          ta.style.position = "absolute";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          const ok = document.execCommand && document.execCommand("copy");
          document.body.removeChild(ta);
          setCopyState(ok ? "copied" : "failed");
        } else {
          setCopyState("failed");
        }
      }
    } catch {
      setCopyState("failed");
    }
    window.setTimeout(() => setCopyState("idle"), 2500);
  }, [coordsText]);

  return (
    <section
      aria-label="Report to police"
      data-testid={testId}
      data-nex-emergency-report-police="true"
      style={{
        marginTop: 4,
        padding: 14,
        background: EMERGENCY_PALETTE.surfaceMuted,
        border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
        borderRadius: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        {simulated ? <SimulatedBadge size="sm" testId={`${testId}-simulated`} /> : null}
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: EMERGENCY_PALETTE.textPrimary,
          }}
        >
          Call local emergency services
        </h3>
      </header>

      <div
        data-testid={`${testId}-number`}
        style={{
          padding: "10px 12px",
          background: EMERGENCY_PALETTE.surface,
          border: `1px solid ${EMERGENCY_PALETTE.divider}`,
          borderRadius: 10,
          marginBottom: 10,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: EMERGENCY_PALETTE.textDim,
          }}
        >
          {emergencyNumber.countryName}
        </div>
        <div
          style={{
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "0.04em",
            color: EMERGENCY_PALETTE.emergency,
            lineHeight: 1.15,
            marginTop: 2,
          }}
        >
          {emergencyNumber.generalNumber}
        </div>
      </div>

      <a
        href={`tel:${emergencyNumber.generalNumber}`}
        data-testid={`${testId}-call-link`}
        data-nex-emergency-police-tel={emergencyNumber.generalNumber}
        style={{
          display: "block",
          width: "100%",
          padding: "14px 16px",
          background: EMERGENCY_PALETTE.emergency,
          color: "#FFFFFF",
          textAlign: "center",
          textDecoration: "none",
          borderRadius: 12,
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.03em",
          boxShadow: "0 6px 16px rgba(220,38,38,0.35)",
        }}
      >
        Call {emergencyNumber.generalNumber}
      </a>

      {hasCoords ? (
        <div
          data-testid={`${testId}-coords`}
          style={{
            marginTop: 12,
            padding: 10,
            background: EMERGENCY_PALETTE.surface,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 10,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: EMERGENCY_PALETTE.textDim,
              marginBottom: 4,
            }}
          >
            Share these coordinates when speaking to the operator
          </div>
          <code
            data-testid={`${testId}-coords-value`}
            style={{
              display: "block",
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
              fontSize: 14,
              color: EMERGENCY_PALETTE.textPrimary,
              marginTop: 2,
              userSelect: "text",
            }}
          >
            {coordsText}
          </code>
          <button
            type="button"
            data-testid={`${testId}-copy`}
            onClick={handleCopy}
            style={{
              marginTop: 8,
              padding: "6px 10px",
              background: "transparent",
              color: EMERGENCY_PALETTE.cyan,
              border: `1px solid ${EMERGENCY_PALETTE.divider}`,
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
            aria-label="Copy coordinates to clipboard"
          >
            {copyState === "copied"
              ? "Copied"
              : copyState === "failed"
                ? "Copy failed · select text"
                : "Copy coordinates"}
          </button>
        </div>
      ) : (
        <p
          data-testid={`${testId}-no-coords`}
          style={{
            marginTop: 12,
            padding: 10,
            background: EMERGENCY_PALETTE.surface,
            border: `1px solid ${EMERGENCY_PALETTE.divider}`,
            borderRadius: 10,
            margin: "12px 0 0",
            fontSize: 12,
            color: EMERGENCY_PALETTE.textDim,
            lineHeight: 1.5,
          }}
        >
          Coordinates were not shared · describe the location verbally to
          the operator from any other context the requester provided.
        </p>
      )}

      <p
        data-testid={`${testId}-disclaimer`}
        style={{
          marginTop: 12,
          marginBottom: 0,
          fontSize: 12,
          color: EMERGENCY_PALETTE.textDim,
          lineHeight: 1.55,
        }}
      >
        {POLICE_HANDOFF_DISCLAIMER}
      </p>
    </section>
  );
}
