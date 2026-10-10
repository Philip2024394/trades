// src/components/nex-native/family-safety/LegalClearancePendingBanner.tsx
//
// NEX Family Safety · legal-clearance pending banner · authored 2026-10-10.
// ------------------------------------------------------------------------
// Rendered on every create-child/* and status surface when the live-mode
// flag `isFamilySafetyProductionAuthorised()` returns FALSE.
//
// This banner is load-bearing: it is the UI contract between NEX and
// the parent that:
//   · their submission is HELD safely
//   · no live child account is created yet
//   · Indonesian legal clearance is a prerequisite
//
// Load-bearing anti-patterns:
//   · Do NOT soften the copy to "coming soon". The parent must know
//     the review is a legal gate, not a feature flag.
//   · Do NOT render this banner when the live-mode flag is TRUE ·
//     a stale banner during live mode would be a lie.
//   · Do NOT make this dismissable. It is a disclosure, not a toast.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";

export interface LegalClearancePendingBannerProps {
  /** TRUE if live-mode is authorised. Banner suppressed when true. */
  readonly liveModeAuthorised: boolean;
  readonly testId?: string;
}

const BODY =
  "Awaiting Indonesian legal clearance before NEX can create live child accounts. Your submission is held safely and will be processed once clearance is received.";

export function LegalClearancePendingBanner({
  liveModeAuthorised,
  testId,
}: LegalClearancePendingBannerProps): React.JSX.Element | null {
  if (liveModeAuthorised) return null;
  return (
    <aside
      role="status"
      aria-label="Legal clearance pending"
      data-nex-family-safety-legal-clearance-banner="true"
      data-testid={testId ?? "nex-family-safety-legal-clearance-banner"}
      style={{
        display: "flex",
        gap: 12,
        padding: "14px 16px",
        background: FAMILY_SAFETY_PALETTE.amberMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.amberBorder}`,
        borderRadius: 12,
        color: FAMILY_SAFETY_PALETTE.textPrimary,
        marginBottom: 12,
      }}
    >
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 32,
          height: 32,
          borderRadius: 8,
          background: FAMILY_SAFETY_PALETTE.amberMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.amberBorder}`,
          color: FAMILY_SAFETY_PALETTE.amber,
          display: "grid",
          placeItems: "center",
          fontSize: 16,
        }}
      >
        ⚖️
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: FAMILY_SAFETY_PALETTE.amber,
            marginBottom: 4,
          }}
        >
          Legal clearance pending
        </div>
        <div
          style={{
            fontSize: 13,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          {BODY}
        </div>
      </div>
    </aside>
  );
}
