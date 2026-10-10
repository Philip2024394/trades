// src/app/nex-native/family-safety/dashboard/children/[childAccountId]/contacts/page.tsx
//
// NEX Family Safety · FS-3 · PER-CHILD · contacts visibility.
//
// Phase 1 behaviour: UNCONDITIONAL "not available". The sealed
// `contact-visibility-service` NEVER queries contact tables. This
// page simply renders the honest "unavailable" copy.
//
// Server-side guardianship gate runs FIRST so a non-guardian receives
// the same "Access denied" state as the overview page. We do NOT
// surface the Phase-1 ceiling reason to a non-guardian.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ParentDashboardShell } from "@/components/nex-native/family-safety/ParentDashboardShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { resolveChildDashboardAccess } from "@/lib/nex-native/family-safety/dashboard-service";
import { getContactVisibilityForChild } from "@/lib/nex-native/family-safety/contact-visibility-service";

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

export default async function PerChildContactsPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const gate = await resolveChildDashboardAccess({
    viewerAccountId: session.account.id,
    childAccountId,
    surface: "child_contacts",
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
          testId="nex-family-safety-child-contacts-denied"
        />
      </FamilySafetyShell>
    );
  }

  const displayLabel = await resolveDisplayLabel(gate.link.childAccountId);
  // Call the Phase-1 reader · the result is ALWAYS unavailable.
  // The call is made so the audit log records the denial attempt.
  await getContactVisibilityForChild({
    viewerAccountId: session.account.id,
    childAccountId: gate.link.childAccountId,
  });

  return (
    <FamilySafetyShell activeNav="dashboard">
      <ParentDashboardShell
        childAccountId={gate.link.childAccountId}
        displayLabel={displayLabel}
        linkState={gate.link.state}
        activeSubNav="contacts"
      >
        <div
          data-nex-family-safety-child-contacts="true"
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
          <PrivacyExplanationPanel variant="inline" />
          <EmptyState
            glyph="📇"
            title="Contact visibility is not available in this phase"
            description="A family link does not grant you access to your child's contact list. A dedicated permission flag plus both-party consent is required. Neither is available yet in this pilot."
            testId="nex-family-safety-child-contacts-unavailable"
          />
        </div>
      </ParentDashboardShell>
    </FamilySafetyShell>
  );
}
