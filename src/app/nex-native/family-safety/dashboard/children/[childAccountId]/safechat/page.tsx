// src/app/nex-native/family-safety/dashboard/children/[childAccountId]/safechat/page.tsx
//
// NEX Family Safety · FS-3 · PER-CHILD · SafeChat summary.
//
// Phase 1 behaviour: UNCONDITIONAL "not available". The sealed
// `safechat-status-reader.readSafeChatGuardianSummaryForChild()`
// returns `{available: false}` ALWAYS. This page honours that by
// rendering an honest "no summaries available" state.
//
// Server-side guardianship gate runs FIRST so a non-guardian receives
// the same "Access denied" state as the overview page.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ParentDashboardShell } from "@/components/nex-native/family-safety/ParentDashboardShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import {
  resolveChildDashboardAccess,
  logDashboardAccess,
} from "@/lib/nex-native/family-safety/dashboard-service";
import { readSafeChatGuardianSummaryForChild } from "@/lib/nex-native/family-safety/safechat-status-reader";

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

  const gate = await resolveChildDashboardAccess({
    viewerAccountId: session.account.id,
    childAccountId,
    surface: "child_safechat",
  });

  if (!gate.ok || !gate.link) {
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

  const displayLabel = await resolveDisplayLabel(gate.link.childAccountId);
  // Record the flag-off attempt in the audit log · the summary reader
  // itself is a pure function and does not log.
  const summary = readSafeChatGuardianSummaryForChild();
  if (!summary.available) {
    await logDashboardAccess({
      viewerAccountId: session.account.id,
      viewedChildAccountId: gate.link.childAccountId,
      surface: "child_safechat",
      outcome: "denied_flag_off",
    });
  }

  return (
    <FamilySafetyShell activeNav="dashboard">
      <ParentDashboardShell
        childAccountId={gate.link.childAccountId}
        displayLabel={displayLabel}
        linkState={gate.link.state}
        activeSubNav="safechat"
      >
        <div
          data-nex-family-safety-child-safechat="true"
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
