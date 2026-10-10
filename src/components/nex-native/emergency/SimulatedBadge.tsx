// src/components/nex-native/emergency/SimulatedBadge.tsx
//
// SIMULATED · v1 chip · sealed 2026-10-10.
// -----------------------------------------
// This chip MUST appear on every Emergency Help touchpoint until the
// `isEmergencyLiveMode()` feature flag flips. In v1 that flag is
// always false. The chip is intentionally prominent so no visitor can
// mistake the pilot build for a real emergency broadcast system.
//
// Load-bearing anti-patterns:
//   · Never hide this chip based on viewport, scroll, or any other
//     condition. If live mode flips, the chip disappears via the
//     explicit `live` prop, nothing else.
//   · Never translate "SIMULATED · v1" without a founder decision ·
//     this phrase is the universal safety anchor.
//   · Never shrink below the readable 11px font size.

import * as React from "react";
import { EMERGENCY_PALETTE } from "./_palette";

export interface SimulatedBadgeProps {
  /** When true, the chip is suppressed. Defaults to false (SIMULATED). */
  live?: boolean;
  /** Visual size variant. */
  size?: "sm" | "md";
  /** Optional data-testid override. */
  testId?: string;
}

export function SimulatedBadge({
  live = false,
  size = "md",
  testId,
}: SimulatedBadgeProps): React.JSX.Element | null {
  if (live) return null;
  const padding = size === "sm" ? "2px 8px" : "4px 10px";
  const fontSize = size === "sm" ? 10 : 11;
  return (
    <span
      role="status"
      aria-label="simulated pilot build"
      title="No real alerts are broadcast · this is a pilot build. Call local emergency services for real emergencies."
      data-nex-emergency-simulated-badge="true"
      data-testid={testId ?? "nex-emergency-simulated-badge"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding,
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: EMERGENCY_PALETTE.textPrimary,
        background: EMERGENCY_PALETTE.emergencyMuted,
        border: `1px solid ${EMERGENCY_PALETTE.emergencyBorder}`,
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
          background: EMERGENCY_PALETTE.emergency,
          boxShadow: `0 0 0 2px ${EMERGENCY_PALETTE.emergencyMuted}`,
        }}
      />
      SIMULATED · v1
    </span>
  );
}
