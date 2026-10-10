// src/app/nex-native/family-safety/link/[linkId]/page.tsx
//
// Family Safety · link detail · status / role / revoke · 72h cooldown
// countdown chip surfaces when a pending revocation is in flight.

import * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getLinkById } from "@/lib/nex-native/family-links/family-link-service";
import { readPendingCooldownForLink } from "@/lib/nex-native/family-links/cooldown-service";
import { LocalFamilySafetyShell } from "../../_fs-shell-stub";
import { LinkDetailClient } from "./_link-client";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";

export const dynamic = "force-dynamic";

interface LinkPageParams {
  readonly params: Promise<{ readonly linkId: string }>;
}

export default async function FamilyLinkDetailPage({
  params,
}: LinkPageParams): Promise<React.JSX.Element> {
  const { linkId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return (
      <LocalFamilySafetyShell title="Family Safety · Link">
        <div
          style={{
            padding: 16,
            background: P.surface,
            border: `1px solid ${P.divider}`,
            borderRadius: 14,
            color: P.textSecondary,
          }}
        >
          Sign in to continue.
        </div>
      </LocalFamilySafetyShell>
    );
  }

  const link = await getLinkById(linkId);
  if (!link) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Link"
        subtitle="Link not found."
      >
        <div
          role="alert"
          data-testid="nex-fs-link-not-found"
          style={{
            padding: 16,
            background: P.surface,
            border: `1px solid ${P.emergencyBorder}`,
            borderRadius: 14,
            color: P.textSecondary,
          }}
        >
          This link doesn't exist · or you don't have permission to see it.
        </div>
      </LocalFamilySafetyShell>
    );
  }

  const isParty =
    session.account.id === link.guardianAccountId ||
    session.account.id === link.childAccountId;
  if (!isParty) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Link"
        subtitle="Not permitted."
      >
        <div
          role="alert"
          data-testid="nex-fs-link-forbidden"
          style={{
            padding: 16,
            background: P.surface,
            border: `1px solid ${P.emergencyBorder}`,
            borderRadius: 14,
            color: P.textSecondary,
          }}
        >
          You are not a party to this link.
        </div>
      </LocalFamilySafetyShell>
    );
  }

  const cooldown = await readPendingCooldownForLink(linkId);

  const viewerIsGuardianSide = session.account.id === link.guardianAccountId;

  return (
    <LocalFamilySafetyShell
      title="Guardian partner link"
      subtitle="This is a guardian-to-guardian link. Child-under-16 accounts are managed under Custody."
      activeNav="dashboard"
    >
      <div
        role="status"
        data-nex-family-safety-link-disambiguation="true"
        data-testid="nex-fs-link-disambiguation"
        style={{
          padding: "10px 12px",
          background: P.cyanMuted,
          border: `1px solid ${P.cyanBorder}`,
          borderRadius: 10,
          color: P.textPrimary,
          fontSize: 13,
          lineHeight: 1.5,
          marginBottom: 12,
        }}
      >
        <strong>Guardian-to-guardian link.</strong> To manage a child account
        under 16 you created, open{" "}
        <a
          href="/nex-native/family-safety/custody"
          style={{ color: P.cyan }}
        >
          Custody
        </a>
        .
      </div>
      <LinkDetailClient
        link={{
          linkId: link.linkId,
          role: link.role,
          state: link.state,
          initiatedBy: link.initiatedBy,
          initiatedAt: link.initiatedAt,
          confirmedAt: link.confirmedAt,
          revokedAt: link.revokedAt,
          revokedReason: link.revokedReason,
          canSeeEmergencyAlerts: link.canSeeEmergencyAlerts,
          canSeeSafetySummaries: link.canSeeSafetySummaries,
          canSeeLocationWhenShared: link.canSeeLocationWhenShared,
          guardianAccountId: link.guardianAccountId,
          childAccountId: link.childAccountId,
        }}
        cooldown={cooldown}
        viewerAccountId={session.account.id}
        viewerIsGuardianSide={viewerIsGuardianSide}
      />
    </LocalFamilySafetyShell>
  );
}
