// src/components/nex-native/family-safety/CustodyActionLog.tsx
//
// NEX Family Safety · audit entries list · authored 2026-10-10.
// -------------------------------------------------------------
// Renders a list of ChildCustodyAuditEntry rows. Each row shows:
//   · friendly action label
//   · timestamp
//   · an "Audit · opaque details redacted" chip (visual marker that
//     the body of each audit entry does NOT contain credentials)
//
// Load-bearing anti-patterns:
//   · Do NOT render the raw audit `summary` without the sealed chip
//     next to it. The chip is the user-visible promise that we don't
//     leak secrets through the audit stream.
//   · Do NOT fabricate audit action labels · if a server token is
//     unknown we show the token itself (honest degraded).

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";
import { EmptyState } from "./EmptyState";
import type { ChildCustodyAuditActionUi as ChildCustodyAuditAction } from "@/lib/nex-native/family-safety/child-account-creation/ui-tokens";
import type { ChildCustodyAuditEntry } from "@/lib/nex-native/family-safety/custody/service";

const ACTION_LABELS: Readonly<Record<ChildCustodyAuditAction, string>> = {
  custody_created: "Custody created",
  password_reset_issued: "Password reset issued",
  custody_revoked: "Custody revoked",
  safechat_default_updated: "SafeChat default updated",
  age_transfer_scheduled: "Age transfer scheduled",
  age_transfer_completed: "Age transfer completed",
};

function formatIso(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export interface CustodyActionLogProps {
  readonly entries: readonly ChildCustodyAuditEntry[];
}

export function CustodyActionLog({
  entries,
}: CustodyActionLogProps): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <EmptyState
        glyph="📜"
        title="No audit entries yet"
        description="When you take an action on this custody, it will be recorded here. Audit entries never contain passwords or secret tokens."
        testId="nex-family-safety-audit-empty"
      />
    );
  }
  return (
    <ol
      aria-label="Custody audit entries"
      data-nex-family-safety-audit-log="true"
      style={{
        listStyle: "none",
        padding: 0,
        margin: 0,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      {entries.map((e) => (
        <li
          key={e.auditEntryId}
          data-nex-family-safety-audit-entry={e.action}
          style={{
            padding: 12,
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            borderRadius: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
              }}
            >
              {ACTION_LABELS[e.action] ?? e.action}
            </span>
            <StatusChip
              tone="info"
              label="Audit · opaque details redacted"
              testId={`nex-family-safety-audit-opaque-${e.auditEntryId}`}
            />
          </div>
          <div
            style={{
              fontSize: 12,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
              lineHeight: 1.4,
            }}
          >
            {e.summary}
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: FAMILY_SAFETY_PALETTE.textDim,
            }}
          >
            {formatIso(e.occurredAt)}
          </div>
        </li>
      ))}
    </ol>
  );
}
