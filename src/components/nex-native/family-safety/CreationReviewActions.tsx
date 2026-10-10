// src/components/nex-native/family-safety/CreationReviewActions.tsx
//
// NEX Family Safety · wizard step 3 · client island for action
// buttons. Authored by CC-2 2026-10-10.
// ------------------------------------------------------------
// Keeps the server-side CreationReviewPanel presentational while
// isolating the action-dispatch client code.

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import {
  cancelRequestAction,
  transitionCreationStateAction,
} from "@/lib/nex-native/family-safety/child-account-creation/actions";

export interface CreationReviewActionsProps {
  readonly requestId: string;
}

export function CreationReviewActions({
  requestId,
}: CreationReviewActionsProps): React.JSX.Element {
  const router = useRouter();
  const [busy, setBusy] = React.useState<"submit" | "cancel" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    setBusy("submit");
    setError(null);
    try {
      await transitionCreationStateAction({
        requestId,
        nextState: "id_pending_verification",
      });
      router.push(`/nex-native/family-safety/create-child/${requestId}/status`);
    } catch {
      setError("Could not submit. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    setBusy("cancel");
    setError(null);
    try {
      await cancelRequestAction({
        requestId,
        reason: "parent_cancelled_during_review",
      });
      router.push("/nex-native/family-safety");
    } catch {
      setError("Could not cancel. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        marginTop: 4,
      }}
    >
      <button
        type="button"
        onClick={submit}
        disabled={busy !== null}
        data-testid="nex-fs-review-submit"
        style={{
          padding: "10px 16px",
          background: FAMILY_SAFETY_PALETTE.familyGreen,
          color: "#02141F",
          fontWeight: 700,
          borderRadius: 10,
          border: "none",
          fontSize: 14,
          cursor: busy ? "wait" : "pointer",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy === "submit" ? "Submitting…" : "Submit for Review"}
      </button>
      <button
        type="button"
        onClick={cancel}
        disabled={busy !== null}
        data-testid="nex-fs-review-cancel"
        style={{
          padding: "10px 16px",
          background: FAMILY_SAFETY_PALETTE.surfaceHi,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
          fontWeight: 600,
          borderRadius: 10,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          fontSize: 14,
          cursor: busy ? "wait" : "pointer",
        }}
      >
        {busy === "cancel" ? "Cancelling…" : "Cancel"}
      </button>
      {error ? (
        <div
          role="alert"
          style={{
            flexBasis: "100%",
            color: FAMILY_SAFETY_PALETTE.emergency,
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
