// src/app/nex-native/family-safety/custody/[custodyId]/_revoke-button.tsx

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { revokeCustodyAction } from "@/lib/nex-native/family-safety/child-account-creation/actions";

export function RevokeCustodyButton({
  custodyId,
}: {
  readonly custodyId: string;
}): React.JSX.Element {
  const router = useRouter();
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function revoke() {
    setBusy(true);
    setError(null);
    try {
      await revokeCustodyAction(custodyId);
      router.refresh();
      setConfirming(false);
    } catch {
      setError("Could not revoke. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        data-testid="nex-fs-custody-action-revoke"
        style={{
          padding: "10px 14px",
          background: FAMILY_SAFETY_PALETTE.emergencyMuted,
          color: FAMILY_SAFETY_PALETTE.emergency,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.emergencyBorder}`,
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        Revoke custody
      </button>
    );
  }
  return (
    <div
      role="group"
      aria-label="Confirm revoke custody"
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: 10,
        background: FAMILY_SAFETY_PALETTE.emergencyMuted,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.emergencyBorder}`,
        borderRadius: 10,
      }}
    >
      <span
        style={{
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
          fontWeight: 600,
          alignSelf: "center",
        }}
      >
        Revoke custody for this child?
      </span>
      <button
        type="button"
        onClick={revoke}
        disabled={busy}
        data-testid="nex-fs-custody-action-revoke-confirm"
        style={{
          padding: "6px 12px",
          background: FAMILY_SAFETY_PALETTE.emergency,
          color: "#FFF",
          border: "none",
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 12,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy ? "Revoking…" : "Yes, revoke"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={busy}
        style={{
          padding: "6px 12px",
          background: FAMILY_SAFETY_PALETTE.surfaceHi,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 8,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
      {error ? (
        <div
          role="alert"
          style={{
            flexBasis: "100%",
            color: FAMILY_SAFETY_PALETTE.emergency,
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
