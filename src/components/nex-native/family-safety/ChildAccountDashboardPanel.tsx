// src/components/nex-native/family-safety/ChildAccountDashboardPanel.tsx
//
// NEX Family Safety · CC-3 · Per-child dashboard content panel.
//
// Composition contract:
//   · The panel ALWAYS renders the sealed `AgeTransitionCountdownChip`
//     for the custody row (CC-3 scope · this file).
//   · The panel accepts a `customAuditLog` slot (CC-2 ships
//     `CustodyActionLog` in a parallel wave · we accept it as a
//     React.ReactNode so the two scopes don't collide).
//   · The panel accepts a `verificationStatus` slot (CC-2 ships
//     `VerificationStatusChip`) · same slot pattern.
//
// This file ONLY depends on sealed Family Safety primitives (palette,
// StatusChip, AgeTransitionCountdownChip). CC-2's components attach
// via props when ready.
//
// Load-bearing anti-patterns:
//   · Do NOT render child display name OR account id larger than a
//     subdued caption. Account identity is NOT the point of this
//     surface · relationship structure is.
//   · Do NOT embed any raw-content preview.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";
import { AgeTransitionCountdownChip } from "./AgeTransitionCountdownChip";

export interface ChildAccountDashboardPanelProps {
  readonly childDisplayLabel: string;
  readonly linkType: "created_minor" | "transferred_at_16" | "manual_grant";
  readonly autoTransferAt: string | null;
  readonly transferredAt: string | null;
  readonly nowIso: string;
  readonly simulated: boolean;
  /** TRUE when SafeChat is enforced for this child (minor + always-on). */
  readonly safechatEnforced: boolean;
  /** CC-2's VerificationStatusChip · optional until CC-2 ships. */
  readonly verificationStatus?: React.ReactNode;
  /** CC-2's CustodyActionLog · optional until CC-2 ships. */
  readonly customAuditLog?: React.ReactNode;
  /** Href to the age-transition sub-page. */
  readonly ageTransitionHref: string;
  /** Href to the SafeChat sub-page. */
  readonly safeChatHref: string;
  readonly testId?: string;
}

function linkTypeLabel(
  v: ChildAccountDashboardPanelProps["linkType"],
): string {
  switch (v) {
    case "created_minor":
      return "Created in NEX";
    case "transferred_at_16":
      return "Transferred at 16";
    case "manual_grant":
      return "Manual grant";
  }
}

export function ChildAccountDashboardPanel(
  props: ChildAccountDashboardPanelProps,
): React.JSX.Element {
  return (
    <section
      data-nex-family-safety-child-dashboard-panel="true"
      data-nex-family-safety-child-dashboard-link-type={props.linkType}
      data-nex-family-safety-child-dashboard-transferred={
        props.transferredAt ? "true" : "false"
      }
      data-testid={
        props.testId ?? "nex-family-safety-child-dashboard-panel"
      }
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
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
          {props.childDisplayLabel}
        </h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <StatusChip
            tone="neutral"
            label={linkTypeLabel(props.linkType)}
            glyph="👨‍👧"
            testId="nex-family-safety-child-link-type-chip"
          />
          {props.simulated ? (
            <StatusChip
              tone="info"
              label="Simulated"
              glyph="•"
              testId="nex-family-safety-child-simulated-chip"
            />
          ) : null}
          {props.autoTransferAt ? (
            <AgeTransitionCountdownChip
              autoTransferAt={props.autoTransferAt}
              nowIso={props.nowIso}
              transferredAt={props.transferredAt}
            />
          ) : null}
          {props.safechatEnforced ? (
            <StatusChip
              tone="active"
              label="SafeChat on"
              glyph="🛡️"
              testId="nex-family-safety-child-safechat-chip"
            />
          ) : null}
          {props.verificationStatus ?? null}
        </div>
      </header>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 10,
        }}
      >
        {props.autoTransferAt && !props.transferredAt ? (
          <a
            data-testid="nex-family-safety-child-age-transition-link"
            href={props.ageTransitionHref}
            style={{
              display: "block",
              padding: "14px 16px",
              borderRadius: 12,
              background: FAMILY_SAFETY_PALETTE.surface,
              border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Age transition
            </div>
            <div
              style={{
                fontSize: 12,
                color: FAMILY_SAFETY_PALETTE.textSecondary,
              }}
            >
              Review the handover schedule for when this child turns 16.
            </div>
          </a>
        ) : null}
        <a
          data-testid="nex-family-safety-child-safechat-link"
          href={props.safeChatHref}
          style={{
            display: "block",
            padding: "14px 16px",
            borderRadius: 12,
            background: FAMILY_SAFETY_PALETTE.surface,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
            textDecoration: "none",
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              marginBottom: 4,
            }}
          >
            SafeChat
          </div>
          <div
            style={{
              fontSize: 12,
              color: FAMILY_SAFETY_PALETTE.textSecondary,
            }}
          >
            {props.safechatEnforced
              ? "SafeChat is always on for this minor. Open to view status."
              : "SafeChat summaries are not available in this phase."}
          </div>
        </a>
      </div>
      {props.customAuditLog ? (
        <div
          data-testid="nex-family-safety-child-audit-log-slot"
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          }}
        >
          {props.customAuditLog}
        </div>
      ) : (
        <div
          data-testid="nex-family-safety-child-audit-log-pending"
          style={{
            padding: "14px 16px",
            borderRadius: 12,
            background: FAMILY_SAFETY_PALETTE.surfaceMuted,
            border: `1px dashed ${FAMILY_SAFETY_PALETTE.divider}`,
            fontSize: 12,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
          }}
        >
          Audit log view is being prepared in a parallel wave. Each
          custody action is already recorded server-side.
        </div>
      )}
    </section>
  );
}
