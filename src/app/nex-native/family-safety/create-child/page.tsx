// src/app/nex-native/family-safety/create-child/page.tsx
//
// NEX Family Safety · "Create a NEX account for your child under 16"
// wizard entry. Authored by CC-2 2026-10-10.
// ------------------------------------------------------------------
// Lands the parent on an overview + a start button. No form on this
// page itself · it immediately routes to step 1 when the parent taps
// "Start".

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { listRequestsForParent } from "@/lib/nex-native/family-safety/child-account-creation/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { ChildCreateWizardShell } from "@/components/nex-native/family-safety/ChildCreateWizardShell";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CreateChildEntryPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const existing = await listRequestsForParent(session.account.id);
  const inProgress = existing.filter(
    (r) =>
      r.state !== "cancelled" &&
      r.state !== "account_created" &&
      r.state !== "id_rejected",
  );

  return (
    <FamilySafetyShell
      activeNav="setup"
      subtitle="Create a safe NEX account for your family member under 16."
    >
      <ChildCreateWizardShell
        step={1}
        liveModeAuthorised={liveModeAuthorised}
        title="Create a NEX account for your child under 16"
        subtitle="Three short steps. We ask for your child's name, their date of birth, and a government ID to confirm the account is for a minor. You stay in custody of the account until they turn 16."
      >
        <section
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
            borderRadius: 14,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              color: FAMILY_SAFETY_PALETTE.familyGreen,
            }}
          >
            What happens
          </h3>
          <ol
            style={{
              margin: 0,
              padding: "0 0 0 18px",
              fontSize: 13,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
              lineHeight: 1.55,
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <li>You enter your child's display name and date of birth.</li>
            <li>You upload a government ID so NEX can confirm they are under 16.</li>
            <li>
              You review and submit. A NEX reviewer verifies the ID (usually
              1-3 business days).
            </li>
            <li>
              NEX creates the account for your child. You hold the login
              details · your child uses the account under your custody.
            </li>
            <li>At age 16, custody automatically transfers to your child.</li>
          </ol>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href="/nex-native/family-safety/create-child/step-1-identity"
              data-testid="nex-fs-create-child-start"
              style={{
                padding: "10px 16px",
                background: FAMILY_SAFETY_PALETTE.familyGreen,
                color: "#02141F",
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              Start →
            </Link>
            <Link
              href="/nex-native/family-safety"
              style={{
                padding: "10px 16px",
                background: FAMILY_SAFETY_PALETTE.surfaceHi,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 14,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              }}
            >
              Back
            </Link>
          </div>
        </section>

        {inProgress.length > 0 ? (
          <section
            aria-labelledby="nex-fs-in-progress-h"
            data-testid="nex-fs-in-progress-requests"
            style={{
              marginTop: 16,
              padding: 14,
              background: FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 12,
            }}
          >
            <h3
              id="nex-fs-in-progress-h"
              style={{
                margin: "0 0 8px",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              In progress
            </h3>
            <ul
              style={{
                listStyle: "none",
                padding: 0,
                margin: 0,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {inProgress.map((r) => (
                <li key={r.requestId}>
                  <Link
                    href={`/nex-native/family-safety/create-child/${r.requestId}/status`}
                    data-nex-fs-in-progress-request={r.requestId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      padding: "10px 12px",
                      background: FAMILY_SAFETY_PALETTE.surface,
                      border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                      borderRadius: 10,
                      color: FAMILY_SAFETY_PALETTE.textPrimary,
                      textDecoration: "none",
                    }}
                  >
                    <span>{r.childDisplayName}</span>
                    <StatusChip
                      tone={
                        r.state === "id_pending_verification"
                          ? "pending"
                          : r.state === "id_verified"
                          ? "info"
                          : r.state === "awaiting_legal_clearance"
                          ? "pending"
                          : "neutral"
                      }
                      label={r.state.replace(/_/g, " ")}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </ChildCreateWizardShell>
    </FamilySafetyShell>
  );
}
