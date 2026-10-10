// src/components/nex-native/family-safety/MinorSafeChatStatusPanel.tsx
//
// NEX Family Safety · CC-3 · Minor SafeChat status panel.
//
// Honest surface for the per-minor SafeChat tab. Communicates:
//   · SafeChat is always ON for this child · parent cannot disable
//   · Simulated status (Phase 1 ceiling)
//   · Sealed classifier version
//
// Load-bearing:
//   · This panel NEVER renders a disable control.
//   · It NEVER renders child message content or classification data.
//   · It NEVER echoes an account id.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";

export interface MinorSafeChatStatusPanelProps {
  readonly classifierVersion: string;
  readonly enforcedForMinor: boolean;
  readonly simulated: boolean;
  readonly testId?: string;
}

export function MinorSafeChatStatusPanel(
  props: MinorSafeChatStatusPanelProps,
): React.JSX.Element {
  return (
    <section
      data-nex-family-safety-minor-safechat-panel="true"
      data-nex-family-safety-minor-safechat-enforced={
        props.enforcedForMinor ? "true" : "false"
      }
      data-testid={props.testId ?? "nex-family-safety-minor-safechat-panel"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "18px 20px",
        background: FAMILY_SAFETY_PALETTE.surface,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 12,
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <StatusChip
          tone="active"
          label="SafeChat · always on"
          glyph="🛡️"
          testId="nex-family-safety-minor-safechat-chip"
        />
        {props.simulated ? (
          <StatusChip
            tone="info"
            label="Simulated"
            glyph="•"
            testId="nex-family-safety-minor-safechat-sim-chip"
          />
        ) : null}
      </header>
      <h3
        style={{
          margin: 0,
          fontSize: 15,
          fontWeight: 600,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        SafeChat is always on for this child
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.6,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
        }}
      >
        SafeChat classification runs for every minor account in NEX. As a
        parent custodian, you cannot disable it. This protects the child
        and is a founder-sealed decision.
      </p>
      <dl
        style={{
          margin: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, auto) minmax(0, 1fr)",
          rowGap: 8,
          columnGap: 14,
          fontSize: 12,
        }}
      >
        <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Classifier</dt>
        <dd
          style={{
            margin: 0,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
          data-testid="nex-family-safety-minor-safechat-classifier-version"
        >
          {props.classifierVersion}
        </dd>
        <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>Status</dt>
        <dd
          style={{
            margin: 0,
            color: FAMILY_SAFETY_PALETTE.textPrimary,
          }}
        >
          {props.simulated
            ? "Simulated · Phase 1 pilot"
            : "Live classification"}
        </dd>
        <dt style={{ color: FAMILY_SAFETY_PALETTE.textDim }}>
          Guardian view
        </dt>
        <dd
          style={{
            margin: 0,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
          }}
        >
          No per-message classification details are shown to guardians in
          this phase.
        </dd>
      </dl>
    </section>
  );
}
