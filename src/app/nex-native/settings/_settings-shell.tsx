// src/app/nex-native/settings/_settings-shell.tsx
//
// NEX Settings · shared surface primitives · sealed 2026-10-06.
// --------------------------------------------------------------
// Settings is a FUNCTIONAL control surface, NOT a themed chat World.
// Per founder §13: "Settings itself should use the NEX settings
// visual system. It must remain readable. Do NOT make settings
// transparent just because the chat Worlds are atmospheric."
//
// Therefore this file centralises the solid NEX palette, the panel
// style, the group-header style, and the chevron-row style used by
// the landing page and every placeholder route under /settings/*.
//
// Load-bearing anti-patterns:
//   · Do NOT theme Settings per active World. Settings is universal
//     NEX chrome.
//   · Do NOT re-introduce transparent cards (Phase 2 Universal
//     Theme Controls Rule).

import * as React from "react";
import Link from "next/link";

/** Solid NEX settings palette · identical across every route under
 *  /nex-native/settings/. Any route needing additional colours must
 *  derive from this palette · never introduce new generic hex. */
export const NEX_SETTINGS = {
  bg: "#020914",
  panel: "#03101D",
  panelAccent: "rgba(0, 175, 255, 0.35)",
  panelFaint: "rgba(0, 175, 255, 0.12)",
  textPrimary: "#F2F5F8",
  textSecondary: "#7D9BC0",
  cyan: "#00AFFF",
  orange: "#FF7200",
  gold: "#FFD54A",
  divider: "rgba(125, 155, 192, 0.14)",
} as const;

/** Font family used across every settings route · matches the
 *  product-wide default. */
export const NEX_SETTINGS_FONT =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Section group header shown above a cluster of related rows.
 *  Mobile-first · small caps · comfortable with a thumb. */
export function SettingsGroupHeader({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        margin: "20px 2px 8px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        color: NEX_SETTINGS.textSecondary,
      }}
    >
      {children}
    </div>
  );
}

/** One row inside a settings group. Links to `href` unless marked
 *  as `comingSoon` (renders as a static card). */
export interface SettingsRowProps {
  href: string | null;
  emoji: string;
  title: string;
  subtitle: string;
  comingSoon?: boolean;
  rightLabel?: string | null;
  highlighted?: boolean;
}

export function SettingsRow({
  href,
  emoji,
  title,
  subtitle,
  comingSoon,
  rightLabel,
  highlighted,
}: SettingsRowProps): React.JSX.Element {
  const border = highlighted
    ? `1px solid ${NEX_SETTINGS.cyan}`
    : `1px solid ${
        comingSoon ? "rgba(0,175,255,0.18)" : NEX_SETTINGS.panelAccent
      }`;
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 14,
    padding: "14px 16px",
    background: NEX_SETTINGS.panel,
    border,
    borderRadius: 12,
    textDecoration: "none",
    color: NEX_SETTINGS.textPrimary,
    minHeight: 72,
    opacity: comingSoon ? 0.7 : 1,
    boxShadow: highlighted ? `0 0 0 2px ${NEX_SETTINGS.cyan}22` : undefined,
  };
  const body = (
    <>
      <div
        aria-hidden
        style={{
          flexShrink: 0,
          width: 44,
          height: 44,
          borderRadius: 12,
          background: NEX_SETTINGS.panelFaint,
          color: comingSoon ? NEX_SETTINGS.orange : NEX_SETTINGS.cyan,
          display: "grid",
          placeItems: "center",
          fontSize: 20,
        }}
      >
        {emoji}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 15, fontWeight: 500 }}>{title}</span>
          {comingSoon && (
            <span
              aria-label="coming soon"
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "1px 6px",
                fontSize: 9,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: NEX_SETTINGS.orange,
                border: `1px solid ${NEX_SETTINGS.orange}`,
                borderRadius: 4,
                lineHeight: 1.3,
              }}
            >
              Soon
            </span>
          )}
          {rightLabel && (
            <span
              style={{
                marginLeft: "auto",
                fontSize: 11,
                color: NEX_SETTINGS.textSecondary,
              }}
            >
              {rightLabel}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 2,
            fontSize: 12,
            color: NEX_SETTINGS.textSecondary,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          color: comingSoon
            ? NEX_SETTINGS.textSecondary
            : NEX_SETTINGS.cyan,
          fontSize: 18,
        }}
      >
        →
      </div>
    </>
  );
  if (!href) {
    return (
      <div
        data-nex-settings-row
        data-nex-settings-row-coming-soon="true"
        style={style}
      >
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href}
      data-nex-settings-row
      data-nex-settings-row-href={href}
      style={style}
    >
      {body}
    </Link>
  );
}

/** Back-to-settings link shown on every sub-page under /settings/*.
 *  Keeps the user oriented without needing a layout wrapper. */
export function SettingsBackLink(): React.JSX.Element {
  return (
    <Link
      href="/nex-native/settings"
      prefetch={false}
      data-nex-settings-back
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 10,
        fontSize: 11,
        color: NEX_SETTINGS.textSecondary,
        textDecoration: "none",
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        fontWeight: 700,
      }}
    >
      ← All settings
    </Link>
  );
}
