// src/app/nex-native/family-safety/custody/page.tsx
//
// NEX Family Safety · parent custody list.
// Authored by CC-2 2026-10-10.

import * as React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { isFamilySafetyProductionAuthorised } from "@/lib/nex-native/family-safety/feature-flag";
import { listCustodiesForParent } from "@/lib/nex-native/family-safety/custody/service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { LegalClearancePendingBanner } from "@/components/nex-native/family-safety/LegalClearancePendingBanner";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function CustodyListPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const liveModeAuthorised = isFamilySafetyProductionAuthorised();
  const custodies = await listCustodiesForParent(session.account.id);

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="Children in your custody. You hold the login details until they turn 16."
    >
      <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />

      {custodies.length === 0 ? (
        <EmptyState
          glyph="🧷"
          title="No children in your custody yet"
          description="Once a child account has been created, it will appear here. You can reset the password, view the audit log, or revoke custody from each row."
          ctaHref="/nex-native/family-safety/create-child"
          ctaLabel="Create a child account"
          testId="nex-family-safety-custody-empty"
        />
      ) : (
        <ul
          data-nex-family-safety-custody-list="true"
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {custodies.map((c) => (
            <li key={c.custodyId}>
              <Link
                href={`/nex-native/family-safety/custody/${c.custodyId}`}
                data-nex-family-safety-custody-row={c.custodyId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  padding: "12px 14px",
                  background: FAMILY_SAFETY_PALETTE.surfaceMuted,
                  border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                  borderRadius: 12,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                  textDecoration: "none",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: FAMILY_SAFETY_PALETTE.textPrimary,
                    }}
                  >
                    {c.childDisplayName}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: FAMILY_SAFETY_PALETTE.textDim,
                      marginTop: 2,
                    }}
                  >
                    DOB {c.childDateOfBirth} · created {new Date(c.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <StatusChip
                    tone={c.isActive ? "active" : "revoked"}
                    label={c.isActive ? "Active" : "Revoked"}
                  />
                  <span aria-hidden style={{ color: FAMILY_SAFETY_PALETTE.cyan }}>
                    →
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </FamilySafetyShell>
  );
}
