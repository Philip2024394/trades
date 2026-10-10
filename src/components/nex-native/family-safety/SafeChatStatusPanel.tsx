// src/components/nex-native/family-safety/SafeChatStatusPanel.tsx
//
// NEX Family Safety · FS-3 · SafeChat feature-status panel.
//
// Displays the sealed feature-status payload returned by the sealed
// `safechat-status-reader`. NEVER displays an individual
// classification, a conversation signal, a rule match, or any child-
// content column.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";
import { SimulatedPilotBadge } from "./SimulatedPilotBadge";
import type { SafeChatFeatureStatus } from "@/lib/nex-native/family-safety/safechat-status-reader";

export interface SafeChatStatusPanelProps {
  readonly status: SafeChatFeatureStatus;
  readonly testId?: string;
}

export function SafeChatStatusPanel({
  status,
  testId,
}: SafeChatStatusPanelProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="nex-family-safety-safechat-status-title"
      data-nex-family-safety-safechat-status="true"
      data-testid={testId ?? "nex-family-safety-safechat-status-panel"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "18px 20px",
        background: FAMILY_SAFETY_PALETTE.surface,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h3
          id="nex-family-safety-safechat-status-title"
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 600,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          SafeChat · Feature status
        </h3>
        <SimulatedPilotBadge size="sm" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, auto)",
          rowGap: 10,
          columnGap: 12,
          fontSize: 13,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
        }}
      >
        <div>Classifier version</div>
        <code
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
            fontSize: 12,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          {status.classifierVersion}
        </code>

        <div>Classification mode</div>
        <StatusChip
          tone={status.simulated ? "pending" : "active"}
          label={status.simulated ? "Simulated" : "Live"}
        />

        <div>Phase 1 logging</div>
        <StatusChip
          tone={status.phase1LoggingEnabled ? "info" : "neutral"}
          label={status.phase1LoggingEnabled ? "Enabled" : "Disabled"}
        />

        <div>Visible to users</div>
        <StatusChip
          tone="neutral"
          label={status.userFacingEnabled ? "Yes" : "No (Phase 1)"}
        />

        <div>Visible to guardians</div>
        <StatusChip
          tone="neutral"
          label={
            status.guardianSummariesAvailable ? "Yes" : "No (Phase 1)"
          }
        />

        <div>Retention window</div>
        <div style={{ color: FAMILY_SAFETY_PALETTE.textPrimary }}>
          {status.retentionWindowDays} days
        </div>
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 12,
          lineHeight: 1.5,
          color: FAMILY_SAFETY_PALETTE.textDim,
        }}
      >
        {status.honestReason}
      </p>
    </section>
  );
}
