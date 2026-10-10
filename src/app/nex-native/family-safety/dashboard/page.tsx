// src/app/nex-native/family-safety/dashboard/page.tsx
//
// NEX Family Safety · CC-3 · Parent dashboard ROOT · ALWAYS ACTIVE.
//
// Founder decision F (2026-10-10):
//   "dashboard must be active always · we must show user the pages"
//
// Behaviour:
//   · Lists the viewer's ACTIVE custodies (parent_custody_link rows
//     with no transferred_at / revoked_at) using the sealed
//     `listActiveCustodiesForParent` reader.
//   · Also lists legacy family_link rows via
//     `listDashboardEntriesForGuardian` so prior-wave users still
//     see their guardian relationships.
//   · Honest EMPTY STATE when the viewer has zero of either: a
//     "no children in your custody yet" prompt with a CTA into the
//     child-creation flow.
//   · NO fake / demo rows · everything is backed by the server.
//
// Preserved invariants:
//   · Server-side audit row written by the sealed service (both
//     paths log a `dashboard_root` row).
//   · No child content read.
//   · Session identity required · 302 → sign-in without session.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ChildAccountChip } from "@/components/nex-native/family-safety/ChildAccountChip";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { AgeTransitionCountdownChip } from "@/components/nex-native/family-safety/AgeTransitionCountdownChip";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import {
  listActiveCustodiesForParent,
  listDashboardEntriesForGuardian,
  type DashboardChildEntry,
  type DashboardCustodyEntry,
} from "@/lib/nex-native/family-safety/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function resolveDisplayLabel(accountId: string): Promise<string> {
  try {
    const row = await getAccountById(accountId);
    const name = row?.display_name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  } catch {
    /* fall through to safe-mode copy */
  }
  return "Linked child";
}

export default async function ParentDashboardRootPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nowIso = new Date().toISOString();

  // Both reads log their own audit rows via the sealed service.
  const [custodyResult, familyLinksResult] = await Promise.all([
    listActiveCustodiesForParent(session.account.id),
    listDashboardEntriesForGuardian(session.account.id),
  ]);

  const hasAnything =
    custodyResult.entries.length > 0 ||
    familyLinksResult.entries.length > 0;

  if (!hasAnything) {
    return (
      <FamilySafetyShell
        activeNav="dashboard"
        subtitle="The guardian dashboard lists the children you're linked to and the children you've created inside NEX. It never shows private chat contents."
      >
        <PrivacyExplanationPanel variant="inline" />
        <div style={{ marginTop: 12 }}>
          <EmptyState
            glyph="👨‍👩‍👧"
            title="No children in your custody yet"
            description="You don't have any children on your dashboard. You can create a child account for a minor you care for, or wait for a family link invitation to arrive."
            ctaHref="/nex-native/family-safety/create-child"
            ctaLabel="Create a child account"
            testId="nex-family-safety-dashboard-empty"
          />
        </div>
      </FamilySafetyShell>
    );
  }

  const custodyWithLabels: Array<
    DashboardCustodyEntry & { displayLabel: string }
  > = await Promise.all(
    custodyResult.entries.map(async (e) => ({
      ...e,
      displayLabel: await resolveDisplayLabel(e.childAccountId),
    })),
  );

  const linkWithLabels: Array<DashboardChildEntry & { displayLabel: string }> =
    await Promise.all(
      familyLinksResult.entries.map(async (e) => ({
        ...e,
        displayLabel: await resolveDisplayLabel(e.childAccountId),
      })),
    );

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="Linked children appear below. Tap an active child to open the per-child dashboard. This surface never shows the content of private conversations."
    >
      <PrivacyExplanationPanel variant="inline" />

      {custodyWithLabels.length > 0 ? (
        <section
          data-nex-family-safety-dashboard-custody-list="true"
          style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <header
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 600,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                letterSpacing: "0.02em",
              }}
            >
              Children in your custody
            </h2>
            <StatusChip
              tone="active"
              label={`${custodyWithLabels.length} active`}
              glyph="👨‍👧"
              testId="nex-family-safety-dashboard-custody-count"
            />
          </header>
          <ul
            role="list"
            aria-label="Children in your custody"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {custodyWithLabels.map((e) => (
              <li
                key={e.custodyId}
                data-nex-family-safety-dashboard-custody-row="true"
                data-nex-family-safety-dashboard-custody-id={e.custodyId}
              >
                <a
                  href={`/nex-native/family-safety/dashboard/children/${e.childAccountId}`}
                  data-testid="nex-family-safety-dashboard-custody-link"
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    padding: "14px 16px",
                    background: FAMILY_SAFETY_PALETTE.surface,
                    border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                    borderRadius: 12,
                    textDecoration: "none",
                    color: FAMILY_SAFETY_PALETTE.textPrimary,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <strong style={{ fontSize: 15 }}>{e.displayLabel}</strong>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {e.simulated ? (
                        <StatusChip tone="info" label="Simulated" glyph="•" />
                      ) : null}
                      {e.autoTransferAt ? (
                        <AgeTransitionCountdownChip
                          autoTransferAt={e.autoTransferAt}
                          nowIso={nowIso}
                          transferredAt={e.transferredAt}
                        />
                      ) : null}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: 12,
                      color: FAMILY_SAFETY_PALETTE.textSecondary,
                    }}
                  >
                    Open per-child dashboard
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {linkWithLabels.length > 0 ? (
        <section
          data-nex-family-safety-dashboard-list="true"
          style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
              letterSpacing: "0.02em",
            }}
          >
            Family links
          </h2>
          <div
            role="list"
            aria-label="Linked children"
            style={{ display: "flex", flexDirection: "column", gap: 10 }}
          >
            {linkWithLabels.map((e) => (
              <ChildAccountChip
                key={e.linkId}
                childAccountId={e.childAccountId}
                displayLabel={e.displayLabel}
                linkId={e.linkId}
                state={e.state}
                role={e.role}
              />
            ))}
          </div>
        </section>
      ) : null}

      <p
        style={{
          marginTop: 16,
          fontSize: 11,
          color: FAMILY_SAFETY_PALETTE.textDim,
          textAlign: "center",
        }}
      >
        Each query above is recorded in a server-side audit log · you can
        request a copy of your own log via Settings.
      </p>
    </FamilySafetyShell>
  );
}
