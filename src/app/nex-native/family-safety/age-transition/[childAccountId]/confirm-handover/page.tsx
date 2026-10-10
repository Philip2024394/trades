// src/app/nex-native/family-safety/age-transition/[childAccountId]/confirm-handover/page.tsx
//
// NEX Family Safety · CC-3 · Age-transition CHILD-SIDE confirmation page.
//
// Loaded by the child from their own session · the current viewer
// MUST match the `childAccountId` in the URL. Any other viewer gets
// an honest "Access denied" state.
//
// This page is READ-ONLY in Phase 1. A server-action-based "confirm"
// button is a future wave. The honest copy says "come back here when
// you're ready to confirm the handover" and describes what happens.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { EmptyState } from "@/components/nex-native/family-safety/EmptyState";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { StatusChip } from "@/components/nex-native/family-safety/StatusChip";
import { AgeTransitionCountdownChip } from "@/components/nex-native/family-safety/AgeTransitionCountdownChip";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { withClient } from "@/lib/nex/db";
import { daysUntil } from "@/lib/nex-native/family-safety/age-transition-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  readonly params: Promise<{ childAccountId: string }>;
}

interface CustodyLite {
  readonly custodyId: string;
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly simulated: boolean;
}

async function findChildCustody(
  childAccountId: string,
): Promise<CustodyLite | null> {
  try {
    const row = await withClient(async (client) => {
      const r = await client.query(
        `SELECT custody_id, auto_transfer_at, transferred_at, simulated
           FROM nex.parent_custody_link
          WHERE child_account_id = $1
            AND revoked_at IS NULL
          ORDER BY created_at DESC
          LIMIT 1`,
        [childAccountId],
      );
      if ((r.rowCount ?? 0) === 0) return null;
      const raw = r.rows[0]!;
      return {
        custodyId: String(raw.custody_id),
        autoTransferAt:
          raw.auto_transfer_at == null ? null : String(raw.auto_transfer_at),
        transferredAt:
          raw.transferred_at == null ? null : String(raw.transferred_at),
        simulated: raw.simulated === true,
      } satisfies CustodyLite;
    });
    return row ?? null;
  } catch {
    return null;
  }
}

export default async function ConfirmHandoverPage({ params }: PageProps) {
  const { childAccountId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  if (session.account.id !== childAccountId) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🛡️"
          title="Access denied"
          description="This handover-confirmation page can only be opened by the child who is transitioning out of minor custody. If this is you, make sure you're signed in with the correct account."
          ctaHref="/nex-native/family-safety/age-transition"
          ctaLabel="Back"
          testId="nex-family-safety-confirm-handover-denied"
        />
      </FamilySafetyShell>
    );
  }

  const custody = await findChildCustody(childAccountId);

  if (!custody) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🎓"
          title="No handover to confirm"
          description="Your account has no scheduled age transition. If you expected to see one, contact your parent custodian or NEX support."
          ctaHref="/nex-native/family-safety/dashboard"
          ctaLabel="Back to Dashboard"
          testId="nex-family-safety-confirm-handover-none"
        />
      </FamilySafetyShell>
    );
  }

  const nowIso = new Date().toISOString();

  if (custody.transferredAt) {
    return (
      <FamilySafetyShell activeNav="dashboard">
        <EmptyState
          glyph="🎓"
          title="Handover complete"
          description="Your account has already transitioned out of minor custody. Welcome · you're all set."
          ctaHref="/nex-native/family-safety/dashboard"
          ctaLabel="Back to Dashboard"
          testId="nex-family-safety-confirm-handover-done"
        />
      </FamilySafetyShell>
    );
  }

  const daysLeft = custody.autoTransferAt
    ? daysUntil(custody.autoTransferAt, nowIso)
    : null;

  return (
    <FamilySafetyShell
      activeNav="dashboard"
      subtitle="This is where you'll confirm the handover when you're ready. Come back here close to the scheduled date."
    >
      <PrivacyExplanationPanel variant="inline" />
      <section
        data-nex-family-safety-confirm-handover="true"
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
            flexWrap: "wrap",
            gap: 10,
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
            Confirm the handover
          </h2>
          {custody.autoTransferAt ? (
            <AgeTransitionCountdownChip
              autoTransferAt={custody.autoTransferAt}
              nowIso={nowIso}
              transferredAt={null}
            />
          ) : null}
        </header>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            lineHeight: 1.6,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
          }}
        >
          Your account was created under a parent custodian when you were
          a minor. When you turn 16, you take over full control. You can
          wait for the scheduled date or come back here to confirm as
          soon as you're ready.
        </p>
        {daysLeft !== null ? (
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
            <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>
              Scheduled handover
            </dt>
            <dd
              style={{
                margin: 0,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              {new Date(custody.autoTransferAt!).toISOString().slice(0, 10)}
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
          </dl>
        ) : null}
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
            What happens on confirmation
          </strong>
          <br />
          Your account id stays the same. The minor profile flag flips
          off, your parent custody link records the completion, and NEX
          switches you to an adult profile with full control.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <StatusChip
            tone="info"
            label="Confirmation button arrives in a parallel wave"
            glyph="•"
            testId="nex-family-safety-confirm-handover-pending-chip"
          />
          {custody.simulated ? (
            <StatusChip tone="info" label="Simulated" glyph="•" />
          ) : null}
        </div>
      </section>
    </FamilySafetyShell>
  );
}
