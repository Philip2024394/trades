// src/app/nex-native/family-safety/age-transition/page.tsx
//
// NEX Family Safety · CC-3 · Age transition landing page.
//
// Lists the parent's upcoming age transitions within the sealed
// 30-day notification window. Each row is a deep link into the
// per-child countdown + notification UI.
//
// Server-side gates:
//   · session · 302 → sign-in when absent.
//   · reads only the parent's own custody rows via
//     `listUpcomingTransitions`.
//
// Preserved invariants:
//   · No child content read.
//   · No account id echoed in copy.
//   · Honest empty state when the window is clear.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { AgeTransitionCountdownChip } from "@/components/nex-native/family-safety/AgeTransitionCountdownChip";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { listUpcomingTransitions } from "@/lib/nex-native/family-safety/age-transition-service";
import { logDashboardAccess } from "@/lib/nex-native/family-safety/dashboard-service";

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
    /* fall through */
  }
  return "Linked child";
}

export default async function AgeTransitionLandingPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const nowIso = new Date().toISOString();
  const transitions = await listUpcomingTransitions(
    session.account.id,
    30,
    nowIso,
  );

  // Live audit anchor so admins can trace age-transition-countdown
  // views distinct from standard dashboard reads.
  await logDashboardAccess({
    viewerAccountId: session.account.id,
    viewedChildAccountId: null,
    surface: "child_dashboard",
    outcome: "granted",
  });

  if (transitions.length === 0) {
    return (
      <FamilySafetyShell
        activeNav="dashboard"
        subtitle="When a child in your custody is within 30 days of their 16th birthday, their upcoming transition appears here."
      >
        <PrivacyExplanationPanel variant="inline" />
        <EmptyState
          glyph="🗓️"
          title="No upcoming transitions"
          description="No children in your custody are within 30 days of their 16th birthday. We'll show them here when they are."
          ctaHref="/nex-native/family-safety/dashboard"
          ctaLabel="Back to Dashboard"
          testId="nex-family-safety-age-transition-empty"
        />
      </FamilySafetyShell>
    );
  }

  const withLabels = await Promise.all(
    transitions.map(async (t) => ({
      ...t,
      displayLabel: await resolveDisplayLabel(t.childAccountId),
    })),
  );

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="These children in your custody are approaching their 16th birthday. Review each transition and prompt confirmation."
    >
      <PrivacyExplanationPanel variant="inline" />
      <ul
        role="list"
        aria-label="Upcoming age transitions"
        data-nex-family-safety-age-transition-list="true"
        style={{
          listStyle: "none",
          margin: "12px 0 0",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {withLabels.map((t) => (
          <li key={t.custodyId}>
            <a
              href={`/nex-native/family-safety/age-transition/${t.childAccountId}`}
              data-testid="nex-family-safety-age-transition-link"
              data-nex-family-safety-age-transition-child-id={t.childAccountId}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: "14px 16px",
                borderRadius: 12,
                background: FAMILY_SAFETY_PALETTE.surface,
                border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
                textDecoration: "none",
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 10,
                  flexWrap: "wrap",
                }}
              >
                <strong style={{ fontSize: 15 }}>{t.displayLabel}</strong>
                <AgeTransitionCountdownChip
                  autoTransferAt={t.autoTransferAt}
                  nowIso={nowIso}
                  transferredAt={null}
                />
              </div>
              <span
                style={{
                  fontSize: 12,
                  color: FAMILY_SAFETY_PALETTE.textSecondary,
                }}
              >
                Open to prompt the child to confirm the handover.
              </span>
            </a>
          </li>
        ))}
      </ul>
    </FamilySafetyShell>
  );
}
