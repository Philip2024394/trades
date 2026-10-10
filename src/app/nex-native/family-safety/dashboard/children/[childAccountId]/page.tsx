// src/app/nex-native/family-safety/dashboard/children/[childAccountId]/page.tsx
//
// NEX Family Safety · CC-3 · PER-CHILD dashboard overview · ALWAYS ACTIVE.
//
// This page is the "live" dashboard view for a child the viewer is in
// custody of (via `nex.parent_custody_link`) OR a guardian of (via
// the sealed family_link primitive). It composes:
//   · ChildAccountDashboardPanel (sealed · CC-3)
//   · AgeTransitionCountdownChip  (sealed · CC-3)
//   · (future) CustodyActionLog slot from CC-2
//   · (future) VerificationStatusChip slot from CC-2
//
// Server-side gates:
//   · session · 302 → sign-in when absent
//   · custody OR family link · the viewer must be either the parent
//     custodian of this child OR an active guardian · we try both
//     paths before denying.
//   · On any failure render the sealed "Access denied" surface.
//
// Preserved invariants:
//   · Audit row written per outcome.
//   · No child content read.
//   · No account id echoed in error copy.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ParentDashboardShell } from "@/components/nex-native/family-safety/ParentDashboardShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { ChildAccountDashboardPanel } from "@/components/nex-native/family-safety/ChildAccountDashboardPanel";
import {
  listActiveCustodiesForParent,
  logDashboardAccess,
  resolveChildDashboardAccess,
  type DashboardCustodyEntry,
} from "@/lib/nex-native/family-safety/dashboard-service";
import { isSafeChatEnforcedForAccount } from "@/lib/nex-native/family-safety/minor-safechat-enforcer";

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

async function findActiveCustodyForChild(
  parentAccountId: string,
  childAccountId: string,
): Promise<DashboardCustodyEntry | null> {
  const result = await listActiveCustodiesForParent(parentAccountId);
  return (
    result.entries.find((e) => e.childAccountId === childAccountId) ?? null
  );
}

export default async function PerChildDashboardPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nowIso = new Date().toISOString();

  // First try the custody path (always-active · new wave).
  const custody = await findActiveCustodyForChild(
    session.account.id,
    childAccountId,
  );

  // Also run the sealed family-link gate · surfaces an audit row + a
  // link row when the viewer is a guardian via the prior wave.
  const familyLinkGate = await resolveChildDashboardAccess({
    viewerAccountId: session.account.id,
    childAccountId,
    surface: "child_dashboard",
  });

  const hasAccess = custody !== null || familyLinkGate.ok;

  if (!hasAccess) {
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

  const displayLabel = await resolveDisplayLabel(childAccountId);
  const safechatEnforced = await isSafeChatEnforcedForAccount(childAccountId);

  // Record the live-view audit event so a future audit can distinguish
  // the always-active dashboard surface from the Phase 1 feature-flagged
  // paths. Non-blocking · fire-and-safe-swallow.
  await logDashboardAccess({
    viewerAccountId: session.account.id,
    viewedChildAccountId: childAccountId,
    surface: "child_dashboard",
    outcome: "granted",
  });

  // Branch 1 · custody-based (preferred · new wave).
  if (custody) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <ParentDashboardShell
          childAccountId={custody.childAccountId}
          displayLabel={displayLabel}
          linkState={"active"}
          activeSubNav="overview"
        >
          <section
            data-nex-family-safety-child-dashboard-overview="true"
            data-nex-family-safety-child-dashboard-source="custody"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <PrivacyExplanationPanel variant="inline" />
            <ChildAccountDashboardPanel
              childDisplayLabel={displayLabel}
              linkType={custody.linkType}
              autoTransferAt={custody.autoTransferAt}
              transferredAt={custody.transferredAt}
              nowIso={nowIso}
              simulated={custody.simulated}
              safechatEnforced={safechatEnforced}
              ageTransitionHref={`/nex-native/family-safety/age-transition/${custody.childAccountId}`}
              safeChatHref={`/nex-native/family-safety/dashboard/children/${custody.childAccountId}/safechat`}
            />
          </section>
        </ParentDashboardShell>
      </FamilySafetyShell>
    );
  }

  // Branch 2 · family-link fallback (prior wave guardian relationships).
  const link = familyLinkGate.link!;
  return (
    <FamilySafetyShell activeNav="dashboard">
      <ParentDashboardShell
        childAccountId={link.childAccountId}
        displayLabel={displayLabel}
        linkState={link.state}
        activeSubNav="overview"
      >
        <section
          data-nex-family-safety-child-dashboard-overview="true"
          data-nex-family-safety-child-dashboard-source="family_link"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <PrivacyExplanationPanel variant="inline" />
          <ChildAccountDashboardPanel
            childDisplayLabel={displayLabel}
            linkType={"manual_grant"}
            autoTransferAt={null}
            transferredAt={null}
            nowIso={nowIso}
            simulated={link.simulated}
            safechatEnforced={safechatEnforced}
            ageTransitionHref={`/nex-native/family-safety/age-transition/${link.childAccountId}`}
            safeChatHref={`/nex-native/family-safety/dashboard/children/${link.childAccountId}/safechat`}
          />
        </section>
      </ParentDashboardShell>
    </FamilySafetyShell>
  );
}
