// src/components/nex-native/family-safety/SimulatedPilotBadge.tsx
//
// NEX Family Safety · "SIMULATED · PILOT" badge · authored 2026-10-10.
// --------------------------------------------------------------------
// Universal pilot marker · MUST appear on every Family Safety surface
// until `isFamilySafetyProductionAuthorised()` is wired to flip the
// badge off at the surface level. This is NOT the Emergency Help
// SimulatedBadge (that one lives in the emergency package and uses a
// red accent for the medical/safety product). This badge uses the
// Family Safety amber accent so a visitor who glances between
// Emergency Help and Family Safety can tell the two surfaces apart.
//
// Load-bearing anti-patterns:
//   · Never hide this chip based on viewport or scroll. Visibility is
//     controlled by the `live` prop ONLY.
//   · Never translate "SIMULATED · PILOT" without a founder decision.
//   · Never shrink below 10px font (readability floor).

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { FAMILY_SAFETY_PILOT_LABEL } from "./types";

export interface SimulatedPilotBadgeProps {
  /** When true, the badge is suppressed. Defaults to false (shown). */
  readonly live?: boolean;
  /** Visual size variant. */
  readonly size?: "sm" | "md";
  /** Optional data-testid override. */
  readonly testId?: string;
}

export function SimulatedPilotBadge({
  live = false,
  size = "md",
  testId,
}: SimulatedPilotBadgeProps): React.JSX.Element | null {
  if (live) return null;
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <span
      role="status"
      aria-label="simulated pilot build"
      title="No real family-safety actions are performed · this is a pilot build."
      data-nex-family-safety-pilot-badge="true"
      data-testid={testId ?? "nex-family-safety-pilot-badge"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: FAMILY_SAFETY_PALETTE.textPrimary,
        background: FAMILY_SAFETY_PALETTE.amberMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.amberBorder}`,
        borderRadius: 999,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: FAMILY_SAFETY_PALETTE.amber,
          boxShadow: `0 0 0 2px ${FAMILY_SAFETY_PALETTE.amberMuted}`,
        }}
      />
      {FAMILY_SAFETY_PILOT_LABEL}
    </span>
  );
}
