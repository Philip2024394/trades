// src/app/nex-native/family-safety/age-transition/[childAccountId]/page.tsx
//
// NEX Family Safety · CC-3 · Per-child age-transition page (parent side).
//
// Shows the countdown + a "notify child" summary. The actual
// `requestChildConfirmation` write happens via a server action in a
// future wave · this page surfaces the state and renders a deep link
// into the child-side `confirm-handover` route so the child can
// confirm from their own session.
//
// Server-side gates:
//   · session · 302 → sign-in when absent.
//   · parent must be an active custodian via
//     `listActiveCustodiesForParent` filtered to this child.
//   · otherwise · "Access denied" state.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getAccountById } from "@/lib/nex-native/account-service";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { AgeTransitionCountdownChip } from "@/components/nex-native/family-safety/AgeTransitionCountdownChip";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { listActiveCustodiesForParent } from "@/lib/nex-native/family-safety/dashboard-service";
import { daysUntil } from "@/lib/nex-native/family-safety/age-transition-service";

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

export default async function PerChildAgeTransitionPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const custodyResult = await listActiveCustodiesForParent(session.account.id);
  const custody =
    custodyResult.entries.find((e) => e.childAccountId === childAccountId) ??
    null;

  if (!custody) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🛡️"
          title="Access denied"
          description="You can't open this age-transition page. If you believe you should be able to see it, make sure you're signed in with the correct account."
          ctaHref="/nex-native/family-safety/age-transition"
          ctaLabel="Back to Age Transitions"
          testId="nex-family-safety-age-transition-denied"
        />
      </FamilySafetyShell>
    );
  }

  const nowIso = new Date().toISOString();
  const displayLabel = await resolveDisplayLabel(custody.childAccountId);

  if (!custody.autoTransferAt) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🗓️"
          title="No age transition scheduled"
          description="This custody record doesn't have an auto-transfer timestamp set. If this is unexpected, contact support · age transitions are set at the time the child account is created."
          ctaHref="/nex-native/family-safety/age-transition"
          ctaLabel="Back to Age Transitions"
          testId="nex-family-safety-age-transition-no-schedule"
        />
      </FamilySafetyShell>
    );
  }

  const daysLeft = daysUntil(custody.autoTransferAt, nowIso);
  const confirmHref = `/nex-native/family-safety/age-transition/${custody.childAccountId}/confirm-handover`;

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="Review the upcoming handover and share the confirmation link with the child when they're ready."
    >
      <PrivacyExplanationPanel variant="inline" />
      <section
        data-nex-family-safety-age-transition-child="true"
        data-nex-family-safety-age-transition-child-id={custody.childAccountId}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          marginTop: 12,
          padding: "18px 20px",
          background: FAMILY_SAFETY_PALETTE.surface,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          borderRadius: 12,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {displayLabel}
          </h2>
          <AgeTransitionCountdownChip
            autoTransferAt={custody.autoTransferAt}
            nowIso={nowIso}
            transferredAt={custody.transferredAt}
          />
        </header>
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
          <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Scheduled</dt>
          <dd
            style={{
              margin: 0,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {new Date(custody.autoTransferAt).toISOString().slice(0, 10)}
          </dd>
          <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>
            Days remaining
          </dt>
          <dd
            style={{
              margin: 0,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {daysLeft}
          </dd>
          <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Mode</dt>
          <dd
            style={{
              margin: 0,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {custody.simulated ? "Simulated · Pilot" : "Live"}
          </dd>
        </dl>
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
            How this works
          </strong>
          <br />
          On the scheduled date (or earlier · if the child confirms the
          handover themselves), the child account is converted from a
          minor profile to a standard adult profile. The account id does
          NOT change · only the minor profile flag flips. If the
          deadline passes without confirmation, a server-side sweep job
          performs the transition atomically.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusChip
            tone={daysLeft <= 30 ? "info" : "neutral"}
            label={
              daysLeft <= 30
                ? "In the 30-day notification window"
                : "Outside the notification window"
            }
            glyph="⏳"
            testId="nex-family-safety-age-transition-window-chip"
          />
          {custody.simulated ? (
            <StatusChip tone="info" label="Simulated" glyph="•" />
          ) : null}
        </div>
        <a
          href={confirmHref}
          data-testid="nex-family-safety-age-transition-share-confirm-link"
          style={{
            alignSelf: "flex-start",
            padding: "10px 14px",
            borderRadius: 10,
            background: FAMILY_SAFETY_PALETTE.cyanMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.cyanBorder}`,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Share child confirmation link
        </a>
      </section>
    </FamilySafetyShell>
  );
}
