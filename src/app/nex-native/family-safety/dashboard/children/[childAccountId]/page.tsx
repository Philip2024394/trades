// src/app/nex-native/family-safety/dashboard/children/[childAccountId]/page.tsx
//
// NEX Family Safety · FS-3 · PER-CHILD dashboard overview.
//
// Server-side gates:
//   · session · 302 → sign-in when absent (sealed layout already
//     covers this but we assert again defensively)
//   · guardianship · the sealed dashboard-service returns 403-equivalent
//     when the viewer is NOT an active guardian of the child in the
//     URL · we render a sealed "Access denied" surface (NOT a 404 ·
//     doing 404 would leak account existence).
//
// Load-bearing: THIS PAGE QUERIES NO CHILD CONTENT. It shows link
// status, role, and nav into the two Phase-1-ceiling sub-pages
// (contacts + safechat), both of which render honest "not available"
// shells.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ParentDashboardShell } from "@/components/nex-native/family-safety/ParentDashboardShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { resolveChildDashboardAccess } from "@/lib/nex-native/family-safety/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ childAccountId: string }>;
}

async function resolveDisplayLabel(accountId: string): Promise<string> {
  try {
    const row = await getAccountById(accountId);
    const name = row?.display_name;
    if (typeof name === "string" && name.trim().length > 0) {
      return name.trim();
    }
  } catch {
    /* fall through */
  }
  return "Linked child";
}

export default async function PerChildDashboardPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const gate = await resolveChildDashboardAccess({
    viewerAccountId: session.account.id,
    childAccountId,
    surface: "child_dashboard",
  });

  if (!gate.ok || !gate.link) {
    // Deliberate posture: do NOT redirect, do NOT 404. Render an
    // honest denial that doesn't echo the child account id back and
    // doesn't reveal whether the child exists.
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🛡️"
          title="Access denied"
          description="You can't open this dashboard. If you believe you should be able to see it, make sure you're signed in with the correct account and that the link is still active."
          ctaHref="/nex-native/family-safety/dashboard"
          ctaLabel="Back to Dashboard"
          testId="nex-family-safety-child-dashboard-denied"
        />
      </FamilySafetyShell>
    );
  }

  const displayLabel = await resolveDisplayLabel(gate.link.childAccountId);

  return (
    <FamilySafetyShell activeNav="dashboard">
      <ParentDashboardShell
        childAccountId={gate.link.childAccountId}
        displayLabel={displayLabel}
        linkState={gate.link.state}
        activeSubNav="overview"
      >
        <section
          data-nex-family-safety-child-dashboard-overview="true"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <PrivacyExplanationPanel variant="inline" />
          <div
            style={{
              padding: "16px 18px",
              background: FAMILY_SAFETY_PALETTE.surface,
              border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 12,
            }}
          >
            <h3
              style={{
                margin: 0,
                marginBottom: 10,
                fontSize: 14,
                fontWeight: 600,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              Link overview
            </h3>
            <dl
              style={{
                margin: 0,
                display: "grid",
                gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
                rowGap: 8,
                columnGap: 14,
                fontSize: 13,
              }}
            >
              <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Role</dt>
              <dd
                style={{
                  margin: 0,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                }}
              >
                {gate.link.role.replace(/_/g, " ")}
              </dd>
              <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>State</dt>
              <dd
                style={{
                  margin: 0,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                }}
              >
                {gate.link.state}
              </dd>
              <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>
                Confirmed
              </dt>
              <dd
                style={{
                  margin: 0,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                }}
              >
                {gate.link.confirmedAt
                  ? new Date(gate.link.confirmedAt).toISOString().slice(0, 10)
                  : "—"}
              </dd>
              <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Mode</dt>
              <dd
                style={{
                  margin: 0,
                  color: FAMILY_SAFETY_PALETTE.textPrimary,
                }}
              >
                {gate.link.simulated ? "Simulated · Pilot" : "Live"}
              </dd>
            </dl>
          </div>
          <div
            style={{
              padding: "14px 16px",
              background: FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px dashed ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 12,
              fontSize: 12,
              lineHeight: 1.6,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
            }}
          >
            <strong style={{ color: FAMILY_SAFETY_PALETTE.textPrimary }}>
              What you can see on the Contacts tab
            </strong>
            <br />
            Nothing yet. In the current pilot a family link does not grant
            visibility into your child's contact list. A dedicated
            permission flag plus both-party consent is required and is not
            available yet.
          </div>
          <div
            style={{
              padding: "14px 16px",
              background: FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px dashed ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 12,
              fontSize: 12,
              lineHeight: 1.6,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
            }}
          >
            <strong style={{ color: FAMILY_SAFETY_PALETTE.textPrimary }}>
              What you can see on the SafeChat tab
            </strong>
            <br />
            Nothing yet. SafeChat classification is simulated in Phase 1
            and no summaries are produced for guardians at this time.
          </div>
        </section>
      </ParentDashboardShell>
    </FamilySafetyShell>
  );
}
