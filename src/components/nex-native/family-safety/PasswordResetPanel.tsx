// src/components/nex-native/family-safety/PasswordResetPanel.tsx
//
// NEX Family Safety · parent-side password reset UX.
// Authored by CC-2 2026-10-10.
// ---------------------------------------------------
// The parent initiates a password reset for their child's account.
//
// LOAD-BEARING SAFETY INVARIANT: this component NEVER renders or
// stores a plaintext password. It calls
// `requestPasswordResetForChildAction({ custodyId })` which returns
// `{ resetTokenRefOpaque, expiresAt, displayHint }`. The reset flow
// is a "token handoff" · the child picks the password at next sign-in.
//
// We assert this invariant two ways:
//   1. The component simply has no API path that could display a
//      plaintext password · it accepts only the ticket shape above.
//   2. The CustodyActionLog + audit stream show action tokens, never
//      credential content · see sealed CustodyActionLog.
//
// Load-bearing anti-patterns:
//   · Do NOT ever add a prop or hook that accepts a plaintext
//     password. The parent sees NOTHING.
//   · Do NOT persist the ticket to Web Storage. The ticket is a short
//     reference; the plaintext token lives server-side.

"use client";

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { requestPasswordResetForChildAction } from "@/lib/nex-native/family-safety/child-account-creation/actions";
import type { ChildPasswordResetTicket } from "@/lib/nex-native/family-safety/child-account-creation/types";

export interface PasswordResetPanelProps {
  readonly custodyId: string;
  readonly childDisplayName: string;
}

export function PasswordResetPanel({
  custodyId,
  childDisplayName,
}: PasswordResetPanelProps): React.JSX.Element {
  const [busy, setBusy] = React.useState(false);
  const [ticket, setTicket] = React.useState<ChildPasswordResetTicket | null>(
    null,
  );
  const [error, setError] = React.useState<string | null>(null);

  async function issue() {
    setBusy(true);
    setError(null);
    try {
      const t = await requestPasswordResetForChildAction({ custodyId });
      setTicket(t);
    } catch {
      setError("Could not issue a reset. Please try again shortly.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      data-nex-family-safety-password-reset-panel="true"
      aria-label="Password reset"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        background: FAMILY_SAFETY_PALETTE.surfaceMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        Reset your child's password
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
          lineHeight: 1.5,
        }}
      >
        You can reset <strong>{childDisplayName}</strong>'s password. For their
        safety, you will not see the new password. The child will be prompted
        to set a new one on next sign-in.
      </p>

      {ticket ? (
        <div
          role="status"
          data-testid="nex-fs-reset-confirmation"
          style={{
            padding: 12,
            background: FAMILY_SAFETY_PALETTE.familyGreenMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
            borderRadius: 10,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Reset issued
          </div>
          <div
            style={{
              fontSize: 12,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
              lineHeight: 1.5,
            }}
          >
            {ticket.displayHint}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: FAMILY_SAFETY_PALETTE.textDim,
            }}
            data-testid="nex-fs-reset-ticket-ref"
          >
            Reset reference · {ticket.resetTokenRefOpaque.slice(0, 8)}…
            (opaque)
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={issue}
          disabled={busy}
          data-testid="nex-fs-reset-issue"
          style={{
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.familyGreen,
            color: "#02141F",
            border: "none",
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            alignSelf: "flex-start",
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? "Issuing…" : "Issue reset"}
        </button>
      )}

      {error ? (
        <div
          role="alert"
          style={{
            color: FAMILY_SAFETY_PALETTE.emergency,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}
    </section>
  );
}
