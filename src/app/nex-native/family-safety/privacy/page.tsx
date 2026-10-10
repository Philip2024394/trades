// src/app/nex-native/family-safety/privacy/page.tsx
//
// NEX Family Safety · FS-3 · plain-language privacy page.
//
// Renders the sealed 5-promise + capability-ceiling block for any
// signed-in viewer. No per-child data. No contact data. No message
// data.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import { logDashboardAccess } from "@/lib/nex-native/family-safety/dashboard-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function PrivacyExplainerPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  await logDashboardAccess({
    viewerAccountId: session.account.id,
    viewedChildAccountId: null,
    surface: "privacy_page",
    outcome: "granted",
  });

  return (
    <FamilySafetyShell
      subtitle="Plain-language promises about what the parent dashboard is · and what it isn't."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <PrivacyExplanationPanel variant="full" />
        <section
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
            Server-side enforcement
          </strong>
          <br />
          Every page under /family-safety/dashboard runs a server-side
          check before any data is loaded. If you are not an active
          guardian of the child whose dashboard you tried to open, the
          server refuses to answer and records an audit log entry. There
          is no client-side &quot;show / hide&quot; trick anywhere in the
          dashboard · the server is the enforcement point.
          <br />
          <br />
          Every query is append-only in the audit log · you can request
          a copy of your own log via Settings.
        </section>
      </div>
    </FamilySafetyShell>
  );
}
