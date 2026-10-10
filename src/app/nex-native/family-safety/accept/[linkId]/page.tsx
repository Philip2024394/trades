// src/app/nex-native/family-safety/accept/[linkId]/page.tsx
//
// Family Safety · accept invitation · the recipient reviews the link,
// then accepts, declines, or files a pressure signal.

import * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { getLinkById } from "@/lib/nex-native/family-links/family-link-service";
import { LocalFamilySafetyShell } from "../../_fs-shell-stub";
import { AcceptClient } from "./_accept-client";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";

export const dynamic = "force-dynamic";

interface AcceptPageParams {
  readonly params: Promise<{ readonly linkId: string }>;
}

export default async function FamilyAcceptPage({
  params,
}: AcceptPageParams): Promise<React.JSX.Element> {
  const { linkId } = await params;
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Review invitation"
        subtitle="You need a NEX account to review this invitation."
      >
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
        title="Family Safety · Review invitation"
        subtitle="Invitation not found."
      >
        <div
          role="alert"
          data-testid="nex-fs-accept-not-found"
          style={{
            padding: 16,
            background: P.surface,
            border: `1px solid ${P.emergencyBorder}`,
            borderRadius: 14,
            color: P.textSecondary,
          }}
        >
          This invitation doesn't exist · or you don't have permission to see
          it.
        </div>
      </LocalFamilySafetyShell>
    );
  }

  // The recipient depends on who initiated.
  const requiredConfirmer =
    link.initiatedBy === "guardian_invite"
      ? link.childAccountId
      : link.guardianAccountId;
  const actorIsRequired = session.account.id === requiredConfirmer;

  if (!actorIsRequired) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Review invitation"
        subtitle="This invitation is not for you."
      >
        <div
          role="alert"
          data-testid="nex-fs-accept-wrong-party"
          style={{
            padding: 16,
            background: P.surface,
            border: `1px solid ${P.emergencyBorder}`,
            borderRadius: 14,
            color: P.textSecondary,
          }}
        >
          Only the invited party can accept this link.
        </div>
      </LocalFamilySafetyShell>
    );
  }

  return (
    <LocalFamilySafetyShell
      title="Review a guardian invitation"
      subtitle="This is a guardian-to-guardian invitation. To create an account for a child under 16, use Create a child account instead. Review carefully: you can accept, decline, or report pressure."
    >
      <div
        role="status"
        data-nex-family-safety-accept-disambiguation="true"
        data-testid="nex-fs-accept-disambiguation"
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
        <strong>Guardian-to-guardian invitation only.</strong> If you expected
        a child-account invitation, that flow lives under{" "}
        <a
          href="/nex-native/family-safety/create-child"
          style={{ color: P.cyan }}
        >
          Create a child account
        </a>
        .
      </div>
      <AcceptClient
        link={{
          linkId: link.linkId,
          role: link.role,
          state: link.state,
          initiatedBy: link.initiatedBy,
          guardianAccountId: link.guardianAccountId,
          childAccountId: link.childAccountId,
        }}
        viewerAccountId={session.account.id}
      />
    </LocalFamilySafetyShell>
  );
}
