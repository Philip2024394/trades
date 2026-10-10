// src/app/nex-native/family-safety/invite/page.tsx
//
// Family Safety · guardian/child invitation flow · 3-step client state
// machine. Server shell resolves the session + WebAuthn gate state and
// passes down to the client.

import * as React from "react";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { inviterHasWebAuthnCredential } from "@/lib/nex-native/family-links/invite-service";
import { LocalFamilySafetyShell } from "../_fs-shell-stub";
import { InviteClient } from "./_invite-client";
import { FAMILY_SAFETY_PALETTE as P } from "@/components/nex-native/family-safety/_palette";

export const dynamic = "force-dynamic";

export default async function FamilyInvitePage(): Promise<React.JSX.Element> {
  const session = await resolveNexAppSessionFromContext();
  if (!session) {
    return (
      <LocalFamilySafetyShell
        title="Family Safety · Invite"
        activeNav="setup"
        subtitle="You need a NEX account to send an invitation."
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
          Sign in first.{" "}
          <a href="/nex-native/create-account" style={{ color: P.cyan }}>
            Create or sign in to your NEX account
          </a>
          .
        </div>
      </LocalFamilySafetyShell>
    );
  }

  const hasWebAuthn = await inviterHasWebAuthnCredential(session.account.id);

  return (
    <LocalFamilySafetyShell
      title="Invite a secondary guardian"
      activeNav="setup"
      subtitle="This flow is for inviting a secondary guardian. To add a child under 16, use Create a child account instead."
    >
      <div
        role="status"
        data-nex-family-safety-invite-disambiguation="true"
        data-testid="nex-fs-invite-disambiguation"
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
        <strong>Guardian-to-guardian invitation only.</strong> If you want to
        create a NEX account for a family member under 16, go to{" "}
        <a
          href="/nex-native/family-safety/create-child"
          style={{ color: P.cyan }}
        >
          Create a child account
        </a>
        .
      </div>
      <InviteClient
        actorAccountId={session.account.id}
        hasWebAuthn={hasWebAuthn}
      />
    </LocalFamilySafetyShell>
  );
}
