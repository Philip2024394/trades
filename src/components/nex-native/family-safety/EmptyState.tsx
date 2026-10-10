// src/components/nex-native/family-safety/EmptyState.tsx
//
// NEX Family Safety · reusable empty-state primitive · authored
// 2026-10-10.
// ----------------------------------------------------------------
// Used when a Family Safety surface has nothing to show (no family
// yet, no pending invitation, no activity). Honest copy · no fake
// shimmer rows · no CTA that leads to a dead end.
//
// Load-bearing anti-patterns:
//   · Do NOT render a skeleton loader here · empty is not loading.
//     If a surface is still fetching, mount a dedicated loading
//     component (not provided by FS-1).
//   · Do NOT fabricate a "learn more" link if no doc exists · pass
//     the explicit `helpHref` only when a doc is landed.

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";

export interface EmptyStateProps {
  readonly title: string;
  readonly description: string;
  /** Optional glyph · a single emoji or short string. */
  readonly glyph?: string;
  /** Optional primary CTA · if present, both href + label required. */
  readonly ctaHref?: string;
  readonly ctaLabel?: string;
  /** Optional secondary help link · same contract. */
  readonly helpHref?: string;
  readonly helpLabel?: string;
  /** Optional data-testid. */
  readonly testId?: string;
}

export function EmptyState({
  title,
  description,
  glyph,
  ctaHref,
  ctaLabel,
  helpHref,
  helpLabel,
  testId,
}: EmptyStateProps): React.JSX.Element {
  return (
    <div
      role="region"
      aria-label={title}
      data-nex-family-safety-empty-state="true"
      data-testid={testId ?? "nex-family-safety-empty-state"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 12,
        padding: "28px 20px",
        background: FAMILY_SAFETY_PALETTE.surfaceMuted,
        border: `1px dashed ${FAMILY_SAFETY_PALETTE.divider}`,
        borderRadius: 14,
        textAlign: "center",
      }}
    >
      {glyph ? (
        <div
          aria-hidden
          style={{
            fontSize: 32,
            lineHeight: 1,
            opacity: 0.9,
          }}
        >
          {glyph}
        </div>
      ) : null}
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          color: FAMILY_SAFETY_PALETTE.textPrimary,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontSize: 13,
          color: FAMILY_SAFETY_PALETTE.textSecondary,
          lineHeight: 1.5,
          maxWidth: 420,
        }}
      >
        {description}
      </div>
      {ctaHref && ctaLabel ? (
        <Link
          href={ctaHref}
          data-nex-family-safety-empty-state-cta="true"
          style={{
            marginTop: 4,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            background: FAMILY_SAFETY_PALETTE.cyanMuted,
            color: FAMILY_SAFETY_PALETTE.cyan,
            border: `1px solid ${FAMILY_SAFETY_PALETTE.cyanBorder}`,
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
            letterSpacing: "0.01em",
          }}
        >
          {ctaLabel}
          <span aria-hidden>→</span>
        </Link>
      ) : null}
      {helpHref && helpLabel ? (
        <Link
          href={helpHref}
          data-nex-family-safety-empty-state-help="true"
          style={{
            fontSize: 11,
            color: FAMILY_SAFETY_PALETTE.textDim,
            textDecoration: "underline",
          }}
        >
          {helpLabel}
        </Link>
      ) : null}
    </div>
  );
}
