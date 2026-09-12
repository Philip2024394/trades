// src/components/nex-app/shell/ActionAuditPill.tsx
//
// Stage 3.41 · Small badge under NEX's reply showing the terminal
// state of a mutation action (Philip 2026-08-31).
// Stage 3.41.c · Polish · icons per state + unmistakable distinction.
//
// The badge is a SECONDARY signal · the primary honest phrasing is
// already in the voice_reply text above. This is the at-a-glance
// state indicator (matches the way a messenger shows "delivered" /
// "not delivered" beneath a message).
//
// CONSTITUTIONAL: color + label + icon follow the audit's finalState
// exactly. UNKNOWN is NEVER shown in a "success" color. VERIFIED
// alone gets the green check · everything else visually distinct.
//
// The four states must be UNMISTAKABLE at a glance:
//   VERIFIED  · green · CheckCircle2  · "Verified"
//   UNKNOWN   · amber · HelpCircle    · "Unknown · not confirmed"
//   FAILED    · red   · XCircle       · "Failed"
//   BLOCKED   · gray  · Lock          · "Blocked"

"use client";

import { CheckCircle2, HelpCircle, XCircle, Lock } from "lucide-react";
import type { ComponentType } from "react";
import type { ChatArtifactAudit } from "./chat-artifacts";

type PillStyle = {
  label: string;
  bg:    string;
  fg:    string;
  border: string;
  Icon:  ComponentType<{ size?: number; strokeWidth?: number; className?: string; "aria-hidden"?: boolean }>;
};

const PILL_STYLE: Record<ChatArtifactAudit["finalState"], PillStyle> = {
  VERIFIED: {
    label:  "Verified",
    bg:     "#dcfce7",   // green-100
    fg:     "#166534",   // green-800
    border: "#86efac",   // green-300
    Icon:   CheckCircle2,
  },
  UNKNOWN: {
    label:  "Unknown · not confirmed",
    bg:     "#fef9c3",   // yellow-100
    fg:     "#854d0e",   // yellow-800
    border: "#fde047",   // yellow-300
    Icon:   HelpCircle,
  },
  FAILED: {
    label:  "Failed",
    bg:     "#fee2e2",   // red-100
    fg:     "#991b1b",   // red-800
    border: "#fca5a5",   // red-300
    Icon:   XCircle,
  },
  BLOCKED: {
    label:  "Blocked",
    bg:     "#e5e7eb",   // gray-200
    fg:     "#374151",   // gray-700
    border: "#d1d5db",   // gray-300
    Icon:   Lock,
  },
};

export function ActionAuditPill({ audit }: { audit: ChatArtifactAudit }) {
  const s = PILL_STYLE[audit.finalState];
  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium"
      style={{ background: s.bg, color: s.fg, borderColor: s.border }}
      data-testid="action-audit-pill"
      data-final-state={audit.finalState}
      title={audit.reason ?? ""}
    >
      <s.Icon size={12} strokeWidth={2.4} aria-hidden />
      <span>{s.label}</span>
      {audit.targetCanonical && (
        <span style={{ opacity: 0.75 }}>· {audit.targetCanonical}</span>
      )}
    </div>
  );
}
