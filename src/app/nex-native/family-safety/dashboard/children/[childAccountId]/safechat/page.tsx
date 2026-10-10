// src/app/nex-native/family-safety/dashboard/children/[childAccountId]/safechat/page.tsx
//
// NEX Family Safety · CC-3 · PER-CHILD SafeChat panel · ALWAYS ACTIVE.
//
// Behaviour:
//   · If the child is a minor (SafeChat is enforced-on), render the
//     sealed `MinorSafeChatStatusPanel` with the classifier version
//     and the simulated/live chip.
//   · If the child is NOT a minor (post-transition OR profile absent),
//     keep the Phase 1 "not available" honest state.
//
// Preserved invariants:
//   · Server-side gate · must be a custodian OR an active guardian.
//   · Audit row written per outcome.
//   · NO per-message classification data is read or displayed.
//   · The classifier source files are NEVER imported here.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ParentDashboardShell } from "@/components/nex-native/family-safety/ParentDashboardShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { MinorSafeChatStatusPanel } from "@/components/nex-native/family-safety/MinorSafeChatStatusPanel";
import {
  listActiveCustodiesForParent,
  logDashboardAccess,
  resolveChildDashboardAccess,
} from "@/lib/nex-native/family-safety/dashboard-service";
import {
  readSafeChatFeatureStatus,
  readSafeChatGuardianSummaryForChild,
} from "@/lib/nex-native/family-safety/safechat-status-reader";
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

export default async function PerChildSafeChatPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const custodyResult = await listActiveCustodiesForParent(session.account.id);
  const custody =
    custodyResult.entries.find((e) => e.childAccountId === childAccountId) ??
    null;

  const familyLinkGate = await resolveChildDashboardAccess({
    viewerAccountId: session.account.id,
    childAccountId,
    surface: "child_safechat",
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
          testId="nex-family-safety-child-safechat-denied"
        />
      </FamilySafetyShell>
    );
  }

  const displayLabel = await resolveDisplayLabel(childAccountId);
  const resolvedLinkState = custody ? "active" : (familyLinkGate.link?.state ?? "active");

  const safechatEnforced = await isSafeChatEnforcedForAccount(childAccountId);
  const featureStatus = readSafeChatFeatureStatus();

  if (safechatEnforced) {
    await logDashboardAccess({
      viewerAccountId: session.account.id,
      viewedChildAccountId: childAccountId,
      surface: "child_safechat",
      outcome: "granted",
    });
    return (
      <FamilySafetyShell activeNav="dashboard">
        <ParentDashboardShell
          childAccountId={childAccountId}
          displayLabel={displayLabel}
          linkState={resolvedLinkState}
          activeSubNav="safechat"
        >
          <div
            data-nex-family-safety-child-safechat="true"
            data-nex-family-safety-child-safechat-mode="minor-enforced"
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <PrivacyExplanationPanel variant="inline" />
            <MinorSafeChatStatusPanel
              classifierVersion={featureStatus.classifierVersion}
              enforcedForMinor
              simulated={featureStatus.simulated}
            />
          </div>
        </ParentDashboardShell>
      </FamilySafetyShell>
    );
  }

  // Non-minor path · keep the Phase 1 "not available" honest state.
  const summary = readSafeChatGuardianSummaryForChild();
  if (!summary.available) {
    await logDashboardAccess({
      viewerAccountId: session.account.id,
      viewedChildAccountId: childAccountId,
      surface: "child_safechat",
      outcome: "denied_flag_off",
    });
  }

  return (
    <FamilySafetyShell activeNav="dashboard">
      <ParentDashboardShell
        childAccountId={childAccountId}
        displayLabel={displayLabel}
        linkState={resolvedLinkState}
        activeSubNav="safechat"
      >
        <div
          data-nex-family-safety-child-safechat="true"
          data-nex-family-safety-child-safechat-mode="phase-1-ceiling"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <PrivacyExplanationPanel variant="inline" />
          <EmptyState
            glyph="💬"
            title="SafeChat summaries are not available in this phase"
            description="SafeChat classification is simulated during Phase 1. No safety summaries are produced for guardians at this time. When a future phase adds this capability it will require explicit consent from both guardian and child."
            testId="nex-family-safety-child-safechat-unavailable"
          />
        </div>
      </ParentDashboardShell>
    </FamilySafetyShell>
  );
}
