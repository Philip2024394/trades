// src/components/nex-native/family-safety/ChildAccountChip.tsx
//
// NEX Family Safety · FS-3 · child-row chip for the parent dashboard.
//
// Deliberate scope:
//   · Displays ONLY the viewer-safe fields the sealed
//     dashboard-service returns to a guardian · never a nex_handle,
//     DOB, or any child-content column.
//   · The chip is interactive (links to the per-child dashboard)
//     ONLY when state === 'active'. Pending/revoked/expired rows
//     render as non-interactive status rows.
//   · Palette inherits FAMILY_SAFETY_PALETTE · no bespoke colours.

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";
import type { StatusChipTone } from "./types";

export interface ChildAccountChipProps {
  /** The sealed account id · passed to the per-child route. The chip
   *  does NOT render this id to the user. */
  readonly childAccountId: string;
  /** Opaque display label. Callers resolve from `account-service` ·
   *  this component never queries anything. Pass a safe default
   *  ("Linked child") when no display name is available. */
  readonly displayLabel: string;
  readonly linkId: string;
  readonly state: "pending" | "active" | "revoked" | "expired";
  readonly role: "guardian_primary" | "guardian_secondary" | "trusted_adult" | "mentor";
  readonly testId?: string;
}

const STATE_TONE: Readonly<Record<ChildAccountChipProps["state"], StatusChipTone>> = {
  pending: "pending",
  active: "active",
  revoked: "revoked",
  expired: "expired",
};

const STATE_LABEL: Readonly<Record<ChildAccountChipProps["state"], string>> = {
  pending: "Pending",
  active: "Active",
  revoked: "Revoked",
  expired: "Expired",
};

const ROLE_LABEL: Readonly<Record<ChildAccountChipProps["role"], string>> = {
  guardian_primary: "Primary guardian",
  guardian_secondary: "Secondary guardian",
  trusted_adult: "Trusted adult",
  mentor: "Mentor",
};

export function ChildAccountChip({
  childAccountId,
  displayLabel,
  linkId,
  state,
  role,
  testId,
}: ChildAccountChipProps): React.JSX.Element {
  const row = (
    <div
      data-nex-family-safety-child-chip="true"
      data-nex-family-safety-child-chip-state={state}
      data-testid={testId ?? "nex-family-safety-child-chip"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "14px 16px",
        background: FAMILY_SAFETY_PALETTE.surface,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 12,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {displayLabel}
        </div>
        <div
          style={{
            fontSize: 11,
            color: FAMILY_SAFETY_PALETTE.textDim,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          {ROLE_LABEL[role]}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <StatusChip tone={STATE_TONE[state]} label={STATE_LABEL[state]} />
        {state === "active" ? (
          <span
            aria-hidden
            style={{ fontSize: 14, color: FAMILY_SAFETY_PALETTE.textDim }}
          >
            →
          </span>
        ) : null}
      </div>
    </div>
  );

  if (state !== "active") {
    return row;
  }
  return (
    <Link
      href={`/nex-native/family-safety/dashboard/children/${encodeURIComponent(childAccountId)}`}
      data-nex-family-safety-child-chip-link="true"
      data-nex-family-safety-child-chip-link-id={linkId}
      prefetch={false}
      style={{ textDecoration: "none", display: "block" }}
    >
      {row}
    </Link>
  );
}
