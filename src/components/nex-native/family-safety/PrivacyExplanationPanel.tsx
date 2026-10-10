// src/components/nex-native/family-safety/PrivacyExplanationPanel.tsx
//
// NEX Family Safety · FS-3 · plain-language privacy explanation.
//
// Rendered on `/family-safety/privacy` AND re-used inline on
// per-child dashboard pages as an "about this dashboard" collapsible
// block. The copy is DELIBERATELY plain: no legal terms, no
// architecture jargon, no reassurance that isn't honestly true.

import * as React from "react";
import { FAMILY_SAFETY_PALETTE } from "./_palette";

export interface PrivacyExplanationPanelProps {
  /** When true, render the full "5 promises + capability ceiling"
   *  block. When false, render only the "capability ceiling" sentence
   *  as a short inline reminder. */
  readonly variant?: "full" | "inline";
  readonly testId?: string;
}

const PROMISES: readonly { title: string; body: string }[] = [
  {
    title: "No reading of private messages",
    body: "This dashboard will never show you what your child wrote to a friend. Message bodies are not loaded by this page.",
  },
  {
    title: "No silent tracking",
    body: "Location sharing is off by default and requires both parties to opt in. In the current pilot it cannot be turned on at all.",
  },
  {
    title: "No contact list by default",
    body: "A family link does NOT give you access to your child's contact list. A dedicated permission flag is required · it does not exist yet in this pilot.",
  },
  {
    title: "No hidden safety summaries",
    body: "SafeChat classification is simulated during Phase 1. No safety summaries are produced for guardians at this time.",
  },
  {
    title: "Server-enforced access",
    body: "Every piece of information on this dashboard passes a server-side check. If you are not an active guardian of the child whose dashboard you tried to open, the server refuses to answer · even if a URL says otherwise.",
  },
];

const CAPABILITY_CEILING =
  "The parent dashboard is not a back door into a child's account. You see relationship structure (links, roles, states) · not content.";

export function PrivacyExplanationPanel({
  variant = "full",
  testId,
}: PrivacyExplanationPanelProps): React.JSX.Element {
  if (variant === "inline") {
    return (
      <aside
        role="note"
        data-nex-family-safety-privacy-panel="true"
        data-nex-family-safety-privacy-panel-variant="inline"
        data-testid={testId ?? "nex-family-safety-privacy-panel-inline"}
        style={{
          padding: "10px 14px",
          background: FAMILY_SAFETY_PALETTE.cyanMuted,
          border: `1px solid ${FAMILY_SAFETY_PALETTE.cyanBorder}`,
          borderRadius: 10,
          fontSize: 12,
          lineHeight: 1.5,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
        }}
      >
        {CAPABILITY_CEILING}
      </aside>
    );
  }
  return (
    <section
      aria-labelledby="nex-family-safety-privacy-title"
      data-nex-family-safety-privacy-panel="true"
      data-nex-family-safety-privacy-panel-variant="full"
      data-testid={testId ?? "nex-family-safety-privacy-panel"}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "20px 22px",
        background: FAMILY_SAFETY_PALETTE.surface,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
      }}
    >
      <h3
        id="nex-family-safety-privacy-title"
        style={{
          margin: 0,
          fontSize: 16,
          fontWeight: 600,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        What this dashboard is · and what it isn't
      </h3>
      <p
        style={{
          margin: 0,
          fontSize: 13,
          lineHeight: 1.5,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
        }}
      >
        {CAPABILITY_CEILING}
      </p>
      <ul
        style={{
          margin: 0,
          padding: 0,
          listStyle: "none",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {PROMISES.map((p) => (
          <li
            key={p.title}
            data-nex-family-safety-privacy-promise="true"
            style={{
              padding: "10px 12px",
              background: FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
              borderRadius: 10,
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: FAMILY_SAFETY_PALETTE.textPrimary,
                marginBottom: 2,
              }}
            >
              {p.title}
            </div>
            <div
              style={{
                fontSize: 12,
                lineHeight: 1.5,
                color: FAMILY_SAFETY_PALETTE.textSecondary,
              }}
            >
              {p.body}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
