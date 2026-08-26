// NEX Context Card · renders one contextual result inside the below-workspace zone.
//
// Doctrine anchor:
//   project_nex_contextual_workspace_zone_doctrine_2026_08_25
//
// A context card surfaces the RESULT of something NEX just did so the user
// doesn't have to scroll conversation history to find it. Examples:
//   "NEX found 12 restaurants nearby · [View]"
//   "✓ Booking confirmed · Tomorrow · 7:00 PM"
//   "Your quote is ready · $340 · [Open]"
//   "Here's your document · [Open PDF]"
//   "NEX is discovering businesses near you…"
//
// NEVER a dashboard tile. NEVER a permanent panel. NEVER a settings shortcut.
// The card is TIME-BOUND: it appears when NEX produces a result, fades or
// swaps when superseded.

"use client";

import React from "react";

export type ContextCardTone =
  | "found"        // discovery result · neutral · with count
  | "confirmed"    // positive outcome · green tone · with ✓
  | "ready"        // artifact ready · warm tone · usually with CTA
  | "in-progress"  // NEX is working · subtle pulse · often no CTA
  | "attention";   // needs user action · warm/red tone

export interface NexContextCardProps {
  tone?:      ContextCardTone;
  icon?:      React.ReactNode;
  primary:    string;             // "NEX found 12 restaurants nearby"
  secondary?: string;             // "Sleman · updated 2 min ago"
  cta?:       { label: string; onClick: () => void };
  onDismiss?: () => void;
}

const TONE_TOKENS: Record<ContextCardTone, { border: string; glow: string; iconTint: string }> = {
  "found":       { border: "rgba(249,115,22,0.35)", glow: "rgba(249,115,22,0.15)", iconTint: "#f97316" },
  "confirmed":   { border: "rgba(16,185,129,0.4)",  glow: "rgba(16,185,129,0.15)", iconTint: "#10b981" },
  "ready":       { border: "rgba(212,165,68,0.4)",  glow: "rgba(212,165,68,0.15)", iconTint: "#d4a544" },
  "in-progress": { border: "rgba(34,211,238,0.35)", glow: "rgba(34,211,238,0.15)", iconTint: "#22d3ee" },
  "attention":   { border: "rgba(244,63,94,0.45)",  glow: "rgba(244,63,94,0.18)",  iconTint: "#f43f5e" },
};

export function NexContextCard({
  tone = "found",
  icon,
  primary,
  secondary,
  cta,
  onDismiss,
}: NexContextCardProps) {
  const t = TONE_TOKENS[tone];
  return (
    <div
      role="status"
      style={{
        margin: "8px 4px",
        padding: "10px 12px",
        borderRadius: 12,
        background: "rgba(10,10,10,0.72)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: `1px solid ${t.border}`,
        boxShadow: `0 4px 20px ${t.glow}, inset 0 0 0 1px rgba(255,255,255,0.03)`,
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "rgba(245,245,245,0.95)",
        fontSize: 12,
        animation: tone === "in-progress" ? "nex-ctx-breathe 2.4s ease-in-out infinite" : undefined,
      }}
    >
      {icon && (
        <span
          aria-hidden
          style={{
            width: 28, height: 28, minWidth: 28,
            borderRadius: 8,
            background: "rgba(0,0,0,0.35)",
            border: `1px solid ${t.border}`,
            color: t.iconTint,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {icon}
        </span>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {primary}
        </div>
        {secondary && (
          <div style={{ marginTop: 2, opacity: 0.65, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {secondary}
          </div>
        )}
      </div>
      {cta && (
        <button
          type="button"
          onClick={cta.onClick}
          style={{
            appearance: "none",
            border: `1px solid ${t.border}`,
            background: "rgba(255,255,255,0.04)",
            color: t.iconTint,
            padding: "6px 10px",
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.3,
            textTransform: "uppercase",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {cta.label}
        </button>
      )}
      {onDismiss && (
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDismiss}
          style={{
            appearance: "none",
            border: "none",
            background: "transparent",
            color: "rgba(245,245,245,0.5)",
            cursor: "pointer",
            padding: 4,
            marginLeft: -4,
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ×
        </button>
      )}
      <style>{`
        @keyframes nex-ctx-breathe {
          0%, 100% { box-shadow: 0 4px 20px ${t.glow}, inset 0 0 0 1px rgba(255,255,255,0.03); }
          50%      { box-shadow: 0 4px 28px ${t.glow}, inset 0 0 0 1px rgba(255,255,255,0.06); }
        }
      `}</style>
    </div>
  );
}
