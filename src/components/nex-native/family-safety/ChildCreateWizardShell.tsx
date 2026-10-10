// src/components/nex-native/family-safety/ChildCreateWizardShell.tsx
//
// NEX Family Safety · wizard chrome for /create-child/* · authored 2026-10-10.
// ----------------------------------------------------------------------------
// Mounts inside FamilySafetyShell · provides:
//
//   · Three-step progress indicator (Identity / Document / Review)
//   · Load-bearing LegalClearancePendingBanner at the top
//   · A section header with step title + optional subtitle
//   · Children slot for the step's form or review card
//
// The shell is a server-safe React component so step pages can mount
// it without any client boundary.
//
// Load-bearing anti-patterns:
//   · Do NOT re-order the three steps · the server state machine
//     assumes identity → document → review.
//   · Do NOT allow the parent to jump to Review without first
//     completing identity + document on the server · the step
//     "future" markers are visual only · navigation is URL-level.

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { LegalClearancePendingBanner } from "./LegalClearancePendingBanner";

export type ChildCreateWizardStep = 1 | 2 | 3;

export interface ChildCreateWizardShellProps {
  readonly children: React.ReactNode;
  readonly step: ChildCreateWizardStep;
  readonly title: string;
  readonly subtitle?: string;
  readonly liveModeAuthorised: boolean;
  /** When truthy, renders a "Cancel wizard" link in the top-right. */
  readonly cancelHref?: string;
}

const STEP_LABELS: readonly { readonly key: ChildCreateWizardStep; readonly label: string }[] = [
  { key: 1, label: "Identity" },
  { key: 2, label: "Document" },
  { key: 3, label: "Review" },
] as const;

export function ChildCreateWizardShell({
  children,
  step,
  title,
  subtitle,
  liveModeAuthorised,
  cancelHref,
}: ChildCreateWizardShellProps): React.JSX.Element {
  return (
    <section
      aria-labelledby="nex-family-safety-wizard-h"
      data-nex-family-safety-wizard="true"
      data-nex-family-safety-wizard-step={step}
      style={{ display: "flex", flexDirection: "column", gap: 14 }}
    >
      <LegalClearancePendingBanner liveModeAuthorised={liveModeAuthorised} />

      {/* Progress strip */}
      <ol
        aria-label="Create child account progress"
        data-nex-family-safety-wizard-progress="true"
        style={{
          listStyle: "none",
          display: "flex",
          gap: 8,
          padding: 0,
          margin: 0,
        }}
      >
        {STEP_LABELS.map((s) => {
          const state: "done" | "current" | "future" =
            s.key < step ? "done" : s.key === step ? "current" : "future";
          const bg =
            state === "current"
              ? FAMILY_SAFETY_PALETTE.familyGreenMuted
              : state === "done"
              ? FAMILY_SAFETY_PALETTE.cyanMuted
              : FAMILY_SAFETY_PALETTE.surfaceMuted;
          const border =
            state === "current"
              ? FAMILY_SAFETY_PALETTE.familyGreenBorder
              : state === "done"
              ? FAMILY_SAFETY_PALETTE.cyanBorder
              : FAMILY_SAFETY_PALETTE.divider;
          const color =
            state === "future"
              ? FAMILY_SAFETY_PALETTE.textDim
              : FAMILY_SAFETY_PALETTE.textPrimary;
          return (
            <li
              key={s.key}
              aria-current={state === "current" ? "step" : undefined}
              data-nex-family-safety-wizard-step-marker={s.key}
              data-nex-family-safety-wizard-step-marker-state={state}
              style={{
                flex: 1,
                padding: "8px 10px",
                background: bg,
                border: `1px solid ${border}`,
                borderRadius: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                color,
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.03em",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background:
                    state === "done"
                      ? FAMILY_SAFETY_PALETTE.cyan
                      : state === "current"
                      ? FAMILY_SAFETY_PALETTE.familyGreen
                      : FAMILY_SAFETY_PALETTE.divider,
                  color:
                    state === "future"
                      ? FAMILY_SAFETY_PALETTE.textDim
                      : "#02141F",
                  display: "grid",
                  placeItems: "center",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {state === "done" ? "✓" : s.key}
              </span>
              <span>{s.label}</span>
            </li>
          );
        })}
      </ol>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            id="nex-family-safety-wizard-h"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textPrimary,
            }}
          >
            {title}
          </h2>
          {subtitle ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: FAMILY_SAFETY_PALETTE.textSecondary,
                lineHeight: 1.5,
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {cancelHref ? (
          <Link
            href={cancelHref}
            data-testid="nex-family-safety-wizard-cancel"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: FAMILY_SAFETY_PALETTE.textDim,
              textDecoration: "underline",
              padding: "4px 6px",
              whiteSpace: "nowrap",
            }}
          >
            Cancel wizard
          </Link>
        ) : null}
      </header>

      <div data-nex-family-safety-wizard-content="true">{children}</div>
    </section>
  );
}
