// src/app/nex-native/family-safety/safechat/page.tsx
//
// NEX Family Safety · FS-3 · SafeChat feature-status page.
//
// Shows the FEATURE-LEVEL SafeChat posture (classifier version, flag
// states, retention schedule). NEVER shows an individual
// classification, conversation signal, or child-content column.

import * as React from "react";
import { redirect } from "next/navigation";
import { resolveNexAppSessionFromContext } from "@/lib/nex-native/app/session";
import { FamilySafetyShell } from "@/components/nex-native/family-safety/FamilySafetyShell";
import { SafeChatStatusPanel } from "@/components/nex-native/family-safety/SafeChatStatusPanel";
import { PrivacyExplanationPanel } from "@/components/nex-native/family-safety/PrivacyExplanationPanel";
import { FAMILY_SAFETY_PALETTE } from "@/components/nex-native/family-safety/_palette";
import {
  logDashboardAccess,
} from "@/lib/nex-native/family-safety/dashboard-service";
import { readSafeChatFeatureStatus } from "@/lib/nex-native/family-safety/safechat-status-reader";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function SafeChatStatusPage() {
  const session = await resolveNexAppSessionFromContext();
  if (!session) redirect("/nex-native/sign-in");

  const status = readSafeChatFeatureStatus();
  // Granted because viewing the feature-level status is a legitimate
  // product read for any signed-in viewer · it leaks nothing beyond
  // the sealed feature flags.
  await logDashboardAccess({
    viewerAccountId: session.account.id,
    viewedChildAccountId: null,
    surface: "safechat_status",
    outcome: "granted",
  });

  return (
    <FamilySafetyShell
      activeNav="safechat"
      subtitle="SafeChat is a safety-signal pilot. This page shows the state of the feature · it never shows individual conversations."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <PrivacyExplanationPanel variant="inline" />
        <SafeChatStatusPanel status={status} />
        <section
          style={{
            padding: "16px 18px",
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 12,
            fontSize: 12,
            lineHeight: 1.6,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
          }}
        >
          <strong style={{ color: FAMILY_SAFETY_PALETTE.textPrimary }}>
            What SafeChat does today
          </strong>
          <br />
          SafeChat is a classification layer that, when enabled, logs
          category labels (e.g. "coercion-pattern") on peer messages for
          later audit. It does <strong>not</strong> block messages, does{" "}
          <strong>not</strong> notify guardians, and does <strong>not</strong>{" "}
          surface summaries to anyone in Phase 1.
          <br />
          <br />
          Classification rows are retained for{" "}
          {status.retentionWindowDays} days and then permanently deleted
          by the sealed retention sweep.
        </section>
      </div>
    </FamilySafetyShell>
  );
}
