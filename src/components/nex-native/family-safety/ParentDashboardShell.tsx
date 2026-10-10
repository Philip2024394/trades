// src/components/nex-native/family-safety/ParentDashboardShell.tsx
//
// NEX Family Safety · FS-3 · per-child dashboard shell.
//
// Wraps the per-child dashboard surfaces (overview / contacts /
// safechat) with:
//   · A back-to-dashboard link
//   · A display-safe header (opaque label + sealed role / state chip)
//   · A sub-nav strip for the three per-child pages
//   · The children render area
//
// This shell MUST NOT be used on the dashboard ROOT page · the root
// uses the top-level FamilySafetyShell nav directly.

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { StatusChip } from "./StatusChip";

export type ParentDashboardSubNav = "overview" | "contacts" | "safechat";

export interface ParentDashboardShellProps {
  readonly children: React.ReactNode;
  readonly displayLabel: string;
  readonly childAccountId: string;
  readonly linkState: "pending" | "active" | "revoked" | "expired";
  readonly activeSubNav: ParentDashboardSubNav;
}

const SUB_NAV_LABELS: Readonly<Record<ParentDashboardSubNav, string>> = {
  overview: "Overview",
  contacts: "Contacts",
  safechat: "SafeChat",
};

const SUB_NAV_HREF_BY_KEY = (
  childAccountId: string,
): Readonly<Record<ParentDashboardSubNav, string>> => ({
  overview: `/nex-native/family-safety/dashboard/children/${encodeURIComponent(childAccountId)}`,
  contacts: `/nex-native/family-safety/dashboard/children/${encodeURIComponent(childAccountId)}/contacts`,
  safechat: `/nex-native/family-safety/dashboard/children/${encodeURIComponent(childAccountId)}/safechat`,
});

const STATE_TONE = {
  pending: "pending",
  active: "active",
  revoked: "revoked",
  expired: "expired",
} as const;

export function ParentDashboardShell({
  children,
  displayLabel,
  childAccountId,
  linkState,
  activeSubNav,
}: ParentDashboardShellProps): React.JSX.Element {
  const hrefs = SUB_NAV_HREF_BY_KEY(childAccountId);
  const keys: readonly ParentDashboardSubNav[] = ["overview", "contacts", "safechat"];
  return (
    <div
      data-nex-family-safety-parent-dashboard-shell="true"
      data-nex-family-safety-parent-dashboard-active={activeSubNav}
    >
      <div style={{ marginTop: 6, marginBottom: 12 }}>
        <Link
          href="/nex-native/family-safety/dashboard"
          prefetch={false}
          data-nex-family-safety-parent-dashboard-back="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: FAMILY_SAFETY_PALETTE.textDim,
            textDecoration: "none",
            fontWeight: 700,
          }}
        >
          ← Dashboard
        </Link>
      </div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          padding: "4px 0 10px",
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
          {displayLabel}
        </h2>
        <StatusChip
          tone={STATE_TONE[linkState]}
          label={linkState.charAt(0).toUpperCase() + linkState.slice(1)}
        />
      </header>
      <nav
        aria-label="Per-child dashboard sections"
        style={{
          display: "flex",
          gap: 8,
          padding: "6px 0 14px",
          borderBottom: `1px solid ${FAMILY_SAFETY_PALETTE.divider}`,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {keys.map((key) => {
          const active = key === activeSubNav;
          return (
            <Link
              key={key}
              href={hrefs[key]}
              prefetch={false}
              data-nex-family-safety-parent-sub-nav-key={key}
              data-nex-family-safety-parent-sub-nav-active={active ? "true" : "false"}
              style={{
                padding: "6px 12px",
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: active
                  ? FAMILY_SAFETY_PALETTE.textPrimary
                  : FAMILY_SAFETY_PALETTE.textDim,
                background: active
                  ? FAMILY_SAFETY_PALETTE.cyanMuted
                  : "transparent",
                border: `1px solid ${
                  active
                    ? FAMILY_SAFETY_PALETTE.cyanBorder
                    : FAMILY_SAFETY_PALETTE.divider
                }`,
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              {SUB_NAV_LABELS[key]}
            </Link>
          );
        })}
      </nav>
      <div data-nex-family-safety-parent-dashboard-content="true">
        {children}
      </div>
    </div>
  );
}
