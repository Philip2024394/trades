// src/app/nex-native/family-safety/custody/[custodyId]/page.tsx
//
// NEX Family Safety · per-custody detail. Authored by CC-2 2026-10-10.

import * as React from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import {
  daysUntil,
  getCustodyById,
} from "@/lib/nex-native/family-safety/custody/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { LegalClearancePendingBanner } from "@/components/nex-native/family-safety/LegalClearancePendingBanner";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { computeAgeYears } from "@/lib/nex-native/family-safety/child-account-creation/service";
import { RevokeCustodyButton } from "./_revoke-button";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface CustodyDetailParams {
  readonly params: Promise<{ readonly custodyId: string }>;
}

export default async function CustodyDetailPage({ params }: CustodyDetailParams) {
  const { custodyId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const custody = await getCustodyById(session.account.id, custodyId);
  if (!custody) notFound();

  const age = computeAgeYears(custody.childDateOfBirth);
  const daysToTransfer = daysUntil(custody.autoTransferAt);
  const transferDateFormatted = new Date(custody.autoTransferAt).toLocaleDateString();

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle={`Custody detail for ${custody.childDisplayName}.`}
    >
      <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />

      <section
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 16,
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
            data-testid="nex-fs-custody-child-name"
          >
            {custody.childDisplayName}
          </h2>
          <StatusChip
            tone={custody.isActive ? "active" : "revoked"}
            label={custody.isActive ? "Active custody" : "Revoked"}
          />
        </div>
        <div
          style={{
            fontSize: 13,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          <div>Date of birth · {custody.childDateOfBirth}</div>
          <div>Current age · {age} years</div>
          <div data-testid="nex-fs-custody-created-date">
            Created · {new Date(custody.createdAt).toLocaleString()}
          </div>
        </div>
        <div
          data-testid="nex-fs-custody-transfer-countdown"
          style={{
            padding: 12,
            background: FAMILY_SAFETY_PALETTE.surface,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 10,
            fontSize: 13,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.5,
          }}
        >
          Transfers to child on <strong>{transferDateFormatted}</strong> ·{" "}
          {daysToTransfer} day{daysToTransfer === 1 ? "" : "s"} away.
          <br />
          Custody automatically transfers to your child at age 16.
        </div>
      </section>

      <section
        aria-labelledby="nex-fs-custody-actions-h"
        style={{
          marginTop: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 16,
          background: FAMILY_SAFETY_PALETTE.surfaceMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 14,
        }}
      >
        <h3
          id="nex-fs-custody-actions-h"
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          Actions
        </h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          {custody.isActive ? (
            <Link
              href={`/nex-native/family-safety/custody/${custody.custodyId}/reset-password`}
              data-testid="nex-fs-custody-action-reset-password"
              style={{
                padding: "10px 14px",
                background: FAMILY_SAFETY_PALETTE.cyanMuted,
                color: FAMILY_SAFETY_PALETTE.cyan,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.cyanBorder}`,
                borderRadius: 10,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: 13,
              }}
            >
              Reset password
            </Link>
          ) : null}
          <Link
            href={`/nex-native/family-safety/custody/${custody.custodyId}/audit`}
            data-testid="nex-fs-custody-action-audit"
            style={{
              padding: "10px 14px",
              background: FAMILY_SAFETY_PALETTE.surfaceHi,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
              border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 10,
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            View audit log
          </Link>
          {custody.isActive ? (
            <RevokeCustodyButton custodyId={custody.custodyId} />
          ) : null}
        </div>
      </section>

      <Link
        href="/nex-native/family-safety/custody"
        style={{
          marginTop: 14,
          fontSize: 12,
          color: FAMILY_SAFETY_PALETTE.textDim,
          textDecoration: "underline",
        }}
      >
        ← Back to Custody
      </Link>
    </FamilySafetyShell>
  );
}
