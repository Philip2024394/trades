// src/app/nex-native/settings/security/password/page.tsx
//
// NEX Phase 1.0 Security · Change password.
// Sealed 2026-10-06 · thin bridge to Supabase Auth.
//
// Universal Rule Enforcement discipline (5 artefacts):
//   · Doctrine comment in-source.
//   · Mounts SecurityPageShell.
//   · Registered in _security-routes.ts (key = "password").
//   · Parity test asserts shell mount + Dashboard snippet.
//   · Playwright screenshots at 320/375/390/430/1280.

import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { loadSecurityHealthSnapshot } from "@/lib/nex-native/security-service";
import { listCredentialsForAccount } from "@/lib/nex-native/webauthn-service";
import { SecurityPageShell } from "../_security-page-shell";
import { PasswordChangeForm } from "./_password-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEX = {
  textDim: "#8BA9D1",
  text: "#F4F7FC",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
};

export default async function SecurityPasswordPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const [snapshot, credentials] = await Promise.all([
    loadSecurityHealthSnapshot(session.account.id),
    listCredentialsForAccount(session.account.id),
  ]);
  const faceEnrolled = credentials.length > 0;

  return (
    <SecurityPageShell
      activeRouteKey="password"
      title="Password"
      subtitle="Change the password used for email + password sign-in"
      snapshot={snapshot}
      faceEnrolled={faceEnrolled}
    >
      <div
        data-nex-password-explain
        style={{
          padding: "12px 14px",
          marginBottom: 14,
          borderRadius: 10,
          background: NEX.panel,
          border: `1px solid ${NEX.panelAccent}`,
          fontSize: 12,
          color: NEX.textDim,
          lineHeight: 1.55,
        }}
      >
        After you change your password, every existing session stays
        signed in. To force all other sessions off, use
        <strong style={{ color: NEX.text }}>
          {" Devices → Sign out all other sessions"}
        </strong>
        .
      </div>
      <PasswordChangeForm />
    </SecurityPageShell>
  );
}
