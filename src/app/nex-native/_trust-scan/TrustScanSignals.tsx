"use client";

// src/app/nex-native/_trust-scan/TrustScanSignals.tsx
//
// Signals section · 🟢🟡🔴 evidence items · each one is title + explanation.
// Doctrine: every signal MUST include a `detail` line explaining why
// it is the colour it is. No mystery scores.

import * as React from "react";
import type { TrustScanSignal, TrustScanSkin } from "./trust-scan-types";

export function TrustScanSignals({
  signals,
  skin,
}: {
  signals: TrustScanSignal[];
  skin: TrustScanSkin;
}): React.JSX.Element {
  if (signals.length === 0) {
    return (
      <TrustScanBlock skin={skin} eyebrow="Signals">
        <div
          style={{
            color: skin.colors.textMuted,
            fontSize: 11,
            letterSpacing: "0.02em",
          }}
        >
          No notable signals detected.
        </div>
      </TrustScanBlock>
    );
  }
  return (
    <TrustScanBlock skin={skin} eyebrow="Signals">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {signals.map((s, i) => (
          <SignalItem key={`${s.title}-${i}`} signal={s} skin={skin} />
        ))}
      </div>
    </TrustScanBlock>
  );
}

function SignalItem({
  signal,
  skin,
}: {
  signal: TrustScanSignal;
  skin: TrustScanSkin;
}): React.JSX.Element {
  const color =
    signal.level === "ok"
      ? skin.colors.success
      : signal.level === "warning"
        ? skin.colors.danger
        : signal.level === "caution"
          ? skin.colors.warn
          : skin.colors.textMuted; // unknown · neutral grey
  // ⚪ for unknown is the sealed Phase 2 fourth state · missing data is
  // honestly flagged as "unavailable" rather than forced into yellow/red.
  const dotLabel =
    signal.level === "ok"
      ? "🟢"
      : signal.level === "warning"
        ? "🔴"
        : signal.level === "caution"
          ? "🟡"
          : "⚪";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 12px",
        borderRadius: 10,
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${color}33`,
      }}
    >
      <div
        aria-hidden
        style={{ fontSize: 14, lineHeight: 1, marginTop: 1 }}
      >
        {dotLabel}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            color,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.015em",
          }}
        >
          {signal.title}
        </div>
        <div
          style={{
            marginTop: 2,
            color: skin.colors.textMuted,
            fontSize: 11,
            lineHeight: 1.4,
            fontFamily: skin.fontMono,
          }}
        >
          {signal.detail}
        </div>
      </div>
    </div>
  );
}

// Shared block shell used by every block component so the layout stays
// consistent regardless of what the body renders.
export function TrustScanBlock({
  eyebrow,
  children,
  skin,
}: {
  eyebrow: string;
  children: React.ReactNode;
  skin: TrustScanSkin;
}): React.JSX.Element {
  return (
    <section
      style={{
        padding: "14px 14px 12px",
        borderRadius: 14,
        background: "rgba(0,0,0,0.3)",
        border: `1px solid ${skin.colors.rim}`,
      }}
    >
      <div
        style={{
          color: skin.colors.accent,
          fontSize: 9,
          letterSpacing: "0.26em",
          textTransform: "uppercase",
          fontWeight: 700,
          marginBottom: 10,
        }}
      >
        {eyebrow}
      </div>
      {children}
    </section>
  );
}

// A labelled data row · used across every block. Right-aligned value
// column so the eye can scan the numbers down the right edge.
export function TrustScanRow({
  label,
  value,
  skin,
  valueColor,
}: {
  label: string;
  value: React.ReactNode;
  skin: TrustScanSkin;
  valueColor?: string;
}): React.JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 10,
        padding: "6px 2px",
        borderBottom: "1px dashed rgba(255,255,255,0.05)",
        fontSize: 12,
      }}
    >
      <div
        style={{
          color: skin.colors.textMuted,
          fontFamily: skin.fontMono,
          letterSpacing: "0.015em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          color: valueColor ?? skin.colors.textPrimary,
          fontWeight: 600,
          fontFamily: skin.fontMono,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}
