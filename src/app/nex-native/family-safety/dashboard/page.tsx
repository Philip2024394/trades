// src/app/nex-native/family-safety/dashboard/page.tsx
//
// NEX Family Safety · FS-3 · parent dashboard ROOT.
//
// Lists the viewer's active + pending + revoked family links. Each
// row is a `ChildAccountChip` · active rows link into the per-child
// dashboard; non-active rows are read-only status rows.
//
// Deliberate scope:
//   · Only "RELATIONSHIP STRUCTURE" is shown. No message content.
//   · Display labels resolve via sealed `account-service.getAccountById`
//     · when the counterparty is unresolvable (deleted / tombstoned)
//     we show the sealed "Linked child" fallback copy per the UI
//     spec's "safe-mode" doctrine (§3e).
//   · The server-side audit log is written by the sealed service · we
//     don't log a second row here.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { ChildAccountChip } from "@/components/nex-native/family-safety/ChildAccountChip";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import {
  listDashboardEntriesForGuardian,
  type DashboardChildEntry,
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

  const result = await listDashboardEntriesForGuardian(session.account.id);

  if (result.entries.length === 0) {
    return (
      <FamilySafetyShell
        activeNav="dashboard"
        subtitle="The guardian dashboard lists the children you're linked to and their link status. It never shows private chat contents."
      >
        <PrivacyExplanationPanel variant="inline" />
        <div style={{ marginTop: 12 }}>
          <EmptyState
            glyph="👨‍👩‍👧"
            title="No linked children"
            description="You don't have any family links yet. Start a setup from the Family Safety home to invite a child or guardian."
            ctaHref="/nex-native/family-safety/setup"
            ctaLabel="Start setup"
            testId="nex-family-safety-dashboard-empty"
          />
        </div>
      </FamilySafetyShell>
    );
  }

  // Resolve display labels server-side · the chip never queries.
  const withLabels: Array<DashboardChildEntry & { displayLabel: string }> =
    await Promise.all(
      result.entries.map(async (e) => ({
        ...e,
        displayLabel: await resolveDisplayLabel(e.childAccountId),
      })),
    );

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="Linked children appear below. Tap an active link to open the per-child dashboard. This surface never shows the content of private conversations."
    >
      <PrivacyExplanationPanel variant="inline" />
      <div
        role="list"
        aria-label="Linked children"
        data-nex-family-safety-dashboard-list="true"
        style={{
          marginTop: 12,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {withLabels.map((e) => (
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
