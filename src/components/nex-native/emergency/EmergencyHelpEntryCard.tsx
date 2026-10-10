// src/components/nex-native/emergency/EmergencyHelpEntryCard.tsx
//
// Emergency Help · pinned-to-top settings entry card · sealed
// 2026-10-10.
// -------------------------------------------------------------
// Visually distinct from ordinary settings rows (red border, slightly
// taller, pulsing icon). Routes the owner to the "Do you need help?"
// confirmation screen · no action fires from this card.
//
// Load-bearing anti-patterns:
//   · Do NOT fire createEmergencyDraftAction from this card. The
//     2-tap discipline is enforced on the confirmation screen only.
//   · Do NOT request geolocation from this card. The user has not
//     yet expressed intent.
//   · Do NOT nest inside the SETTINGS_GROUPS array · the IA tests
//     seal that structure at 7 groups. This card is a special "above
//     the groups" affordance owned by the Emergency Help feature.

import * as React from "react";
import Link from "next/link";
import { EMERGENCY_PALETTE } from "./_palette";
import { SimulatedBadge } from "./SimulatedBadge";

export interface EmergencyHelpEntryCardProps {
  /** Route the card links to. Defaults to the confirmation screen. */
  href?: string;
  /** Suppresses the pulsing animation (for tests / reduced motion). */
  disableAnimation?: boolean;
}

export function EmergencyHelpEntryCard({
  href = "/nex-native/emergency-help",
  disableAnimation = false,
}: EmergencyHelpEntryCardProps): React.JSX.Element {
  return (
    <>
      {!disableAnimation && (
        <style>{`
          @keyframes nex-emergency-pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.08); opacity: 0.85; }
          }
        `}</style>
      )}
      <Link
        href={href}
        prefetch={false}
        data-nex-emergency-entry="true"
        data-testid="nex-emergency-entry"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 18px",
          background: `linear-gradient(135deg, ${EMERGENCY_PALETTE.emergencyMuted} 0%, ${EMERGENCY_PALETTE.surfaceMuted} 100%)`,
          border: `2px solid ${EMERGENCY_PALETTE.emergency}`,
          borderRadius: 14,
          textDecoration: "none",
          color: EMERGENCY_PALETTE.textPrimary,
          minHeight: 86,
          boxShadow: `0 0 0 1px ${EMERGENCY_PALETTE.emergencyBorder}, 0 4px 14px rgba(220,38,38,0.18)`,
        }}
      >
        <div
          aria-hidden
          data-testid="nex-emergency-entry-hero"
          style={{
            flexShrink: 0,
            width: 80,
            height: 80,
            borderRadius: 14,
            overflow: "hidden",
            display: "grid",
            placeItems: "center",
            animation: disableAnimation
              ? undefined
              : "nex-emergency-pulse 2.2s ease-in-out infinite",
          }}
        >
          <img
            src="/nex-emergency/emergency-help-entry-icon.png"
            alt=""
            width={80}
            height={80}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: "0.005em",
              }}
            >
              NEX Emergency Help
            </span>
            <SimulatedBadge size="sm" />
          </div>
          <div
            style={{
              marginTop: 4,
              fontSize: 12.5,
              color: EMERGENCY_PALETTE.textSecondary,
              lineHeight: 1.45,
            }}
          >
            Request urgent help from nearby NEX community members
          </div>
        </div>
        <div
          aria-hidden
          style={{
            color: EMERGENCY_PALETTE.emergency,
            fontSize: 20,
            fontWeight: 700,
          }}
        >
          →
        </div>
      </Link>
    </>
  );
}
