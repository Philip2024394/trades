// src/app/nex-native/family-safety/create-child/[requestId]/status/_poll-client.tsx

"use client";

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { VerificationStatusChip } from "@/components/nex-native/family-safety/VerificationStatusChip";
import { LegalClearancePendingBanner } from "@/components/nex-native/family-safety/LegalClearancePendingBanner";
import type { ChildCreationRequestRowUi as ChildCreationRequestRow } from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";
import { readRequestForParentAction } from "@/lib/nex-native/family-safety/child-account-creation/actions";

export interface StatusPollClientProps {
  readonly initialRequest: ChildCreationRequestRow;
  readonly liveModeAuthorised: boolean;
}

const POLL_MS = 15_000;

export function StatusPollClient({
  initialRequest,
  liveModeAuthorised,
}: StatusPollClientProps): React.JSX.Element {
  const [request, setRequest] = React.useState(initialRequest);

  React.useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const next = await readRequestForParentAction(request.requestId);
        if (!cancelled && next) setRequest(next);
      } catch {
        // Honest degraded: a transient failure keeps the last-known state.
      }
    };
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [request.requestId]);

  return (
    <section
      data-nex-fs-status="true"
      data-nex-fs-status-state={request.state}
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      {request.state === "awaiting_legal_clearance" ? (
        <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />
      ) : null}

      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "12px 14px",
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 12,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {request.childDisplayName}
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: FAMILY_SAFETY_PALETTE.textDim,
            }}
          >
            Submitted {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <VerificationStatusChip state={request.state} />
      </header>

      <div
        role="status"
        data-testid="nex-fs-status-explanation"
        style={{
          padding: 14,
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 12,
          fontSize: 13,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
          lineHeight: 1.55,
        }}
      >
        {explanationForState(request)}
      </div>

      {request.state === "account_created" && request.custodyId ? (
        <Link
          href={`/nex-native/family-safety/custody/${request.custodyId}`}
          data-testid="nex-fs-status-view-custody"
          style={{
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.familyGreen,
            color: "#02141F",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
            alignSelf: "flex-start",
          }}
        >
          View custody →
        </Link>
      ) : null}

      {request.state === "id_rejected" ? (
        <Link
          href="/nex-native/family-safety/create-child"
          data-testid="nex-fs-status-try-again"
          style={{
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.familyGreen,
            color: "#02141F",
            borderRadius: 10,
            textDecoration: "none",
            fontWeight: 700,
            fontSize: 14,
            alignSelf: "flex-start",
          }}
        >
          Try again
        </Link>
      ) : null}

      <Link
        href="/nex-native/family-safety"
        style={{
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textDim,
          textDecoration: "underline",
        }}
      >
        ← Back to Family Safety
      </Link>
    </section>
  );
}

function explanationForState(request: ChildCreationRequestRow): string {
  switch (request.state) {
    case "draft":
      return "Your submission is still a draft. Return to the wizard to complete it.";
    case "id_pending_verification":
      return "The ID is being verified. This usually takes 1-3 business days once a verifier is online. Your submission is held safely.";
    case "id_verified":
      return "ID verified. Awaiting final account creation.";
    case "awaiting_legal_clearance":
      return "Your submission is complete. We're holding it safely until Indonesian legal review authorises live child account creation. We'll notify you when ready.";
    case "account_created":
      return "Child account created · you can view the custody and manage reset, audit, and revoke from there.";
    case "id_rejected":
      return request.rejectionReason
        ? `The ID was rejected. Reason: ${request.rejectionReason}. You can start a new submission with a clearer document.`
        : "The ID was rejected. You can start a new submission with a clearer document.";
    case "cancelled":
      return "This request was cancelled. You can start a new submission any time.";
    default:
      return "Status unavailable right now. Please try again shortly.";
  }
}
