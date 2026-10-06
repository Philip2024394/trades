// src/app/nex-native/settings/security/_security-page-shell.tsx
//
// NEX Phase 1.0 Security · universal page shell.
// Sealed 2026-10-06 · universal rule enforcement discipline (5 artefacts).
//
// Load-bearing architectural rules:
//
//   · Every Security surface mounts this shell. Zero per-route chrome
//     drift. The parity test enforces this via source grep.
//   · The shell is NEX chrome · not themed. Per the Universal Theme
//     Colour Rule + Phase 1.0 Security brief Part Y: Security is a
//     control surface, NOT a themed World room.
//   · Shell children land in a solid-background card so controls stay
//     readable regardless of any atmosphere behind them.
//   · The Dashboard snippet (SecurityDashboardSnippet) is embedded at
//     the TOP of every security surface so navigating around keeps the
//     health view in sight.

import * as React from "react";
import Link from "next/link";
import type { SecurityHealthSnapshot } from "@/lib/nex-native/security-service";

const NEX = {
  bg: "#020914",
  surface: "#0A1424",
  panel: "rgba(16,30,52,0.72)",
  panelAccent: "rgba(0,175,255,0.26)",
  cyan: "#00AFFF",
  orange: "#FF7800",
  green: "#16D66B",
  rose: "#FF6B8A",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export interface SecurityPageShellProps {
  activeRouteKey: "landing" | "devices" | "activity" | "password";
  title: string;
  subtitle?: string;
  snapshot: SecurityHealthSnapshot;
  faceEnrolled: boolean;
  children: React.ReactNode;
}

export function SecurityPageShell({
  activeRouteKey,
  title,
  subtitle,
  snapshot,
  faceEnrolled,
  children,
}: SecurityPageShellProps): React.JSX.Element {
  return (
    <main
      data-nex-security-shell=""
      data-nex-security-route={activeRouteKey}
      style={{
        minHeight: "100dvh",
        background: NEX.bg,
        color: NEX.text,
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        padding: "20px 16px 60px",
      }}
    >
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <SecurityHeader
          title={title}
          subtitle={subtitle}
          activeRouteKey={activeRouteKey}
        />
        <SecurityDashboardSnippet
          snapshot={snapshot}
          faceEnrolled={faceEnrolled}
          activeRouteKey={activeRouteKey}
        />
        <section
          data-nex-security-content=""
          style={{ marginTop: 20 }}
        >
          {children}
        </section>
        <footer
          style={{
            marginTop: 32,
            paddingTop: 16,
            borderTop: "1px solid rgba(139,169,209,0.14)",
            fontSize: 11,
            color: NEX.textMute,
            lineHeight: 1.5,
          }}
        >
          Location data derived from GeoLite2 by MaxMind ·{" "}
          <a
            href="https://www.maxmind.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: NEX.textMute, textDecoration: "underline" }}
          >
            maxmind.com
          </a>
          . IP addresses stay on NEX servers.
        </footer>
      </div>
    </main>
  );
}

function SecurityHeader({
  title,
  subtitle,
  activeRouteKey,
}: {
  title: string;
  subtitle?: string;
  activeRouteKey: string;
}): React.JSX.Element {
  // Landing has no back-arrow to Security (it IS Security). Deeper
  // pages back to the Security landing.
  const backHref =
    activeRouteKey === "landing"
      ? "/nex-native/settings"
      : "/nex-native/settings/security";
  const backLabel =
    activeRouteKey === "landing" ? "Settings" : "Security";
  return (
    <div>
      <Link
        href={backHref}
        prefetch={false}
        data-nex-security-back
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: NEX.textDim,
          textDecoration: "none",
          marginBottom: 14,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontWeight: 700,
        }}
      >
        ← {backLabel}
      </Link>
      <h1
        style={{
          margin: "4px 0 4px",
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: "-0.01em",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          style={{
            margin: "0 0 16px",
            fontSize: 13,
            color: NEX.textDim,
            lineHeight: 1.55,
          }}
        >
          {subtitle}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard snippet · also used standalone as the Privacy Audit view
// on the landing page.
// ---------------------------------------------------------------------------

export interface SecurityDashboardSnippetProps {
  snapshot: SecurityHealthSnapshot;
  faceEnrolled: boolean;
  activeRouteKey: string;
}

export function SecurityDashboardSnippet({
  snapshot,
  faceEnrolled,
  activeRouteKey,
}: SecurityDashboardSnippetProps): React.JSX.Element {
  const items = buildChecklist(snapshot, faceEnrolled);
  // Compact rendering on non-landing routes · one row of pills.
  const compact = activeRouteKey !== "landing";
  return (
    <section
      data-nex-security-dashboard=""
      data-nex-security-dashboard-compact={compact ? "true" : "false"}
      style={{
        padding: compact ? "10px 14px" : "16px 18px",
        borderRadius: 14,
        background: NEX.panel,
        border: `1px solid ${NEX.panelAccent}`,
        display: compact ? "flex" : "flex",
        flexDirection: compact ? "row" : "column",
        gap: compact ? 10 : 12,
        flexWrap: "wrap",
        alignItems: compact ? "center" : "stretch",
      }}
    >
      {!compact && (
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: NEX.cyan,
            fontWeight: 800,
          }}
        >
          Security health
        </div>
      )}
      {items.map((item) => (
        <DashboardRow key={item.key} item={item} compact={compact} />
      ))}
    </section>
  );
}

interface ChecklistItem {
  key: string;
  label: string;
  status: string;
  tone: "ok" | "warn" | "neutral" | "pending";
  href?: string;
}

function buildChecklist(
  snapshot: SecurityHealthSnapshot,
  faceEnrolled: boolean,
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  items.push({
    key: "face",
    label: "Face sign-in",
    status: faceEnrolled ? "Enrolled" : "Not enrolled",
    tone: faceEnrolled ? "ok" : "neutral",
    href: "/nex-native/settings/security/devices",
  });
  items.push({
    key: "2fa",
    label: "2FA",
    // DELIBERATELY shows "Not enabled" · 2FA is a Phase 1.1 scope.
    // We do not imply it is set up today.
    status: "Not enabled · Coming in Phase 1.1",
    tone: "pending",
  });
  items.push({
    key: "devices",
    label: "Active devices",
    status:
      snapshot.active_session_count === 0
        ? "No active sessions"
        : `${snapshot.active_session_count} ${snapshot.active_session_count === 1 ? "device" : "devices"}`,
    tone: snapshot.active_session_count > 5 ? "warn" : "ok",
    href: "/nex-native/settings/security/devices",
  });
  items.push({
    key: "activity",
    label: "Recent sign-ins",
    status:
      snapshot.recent_event_count === 0
        ? "No recent events"
        : `${snapshot.recent_event_count} in last 30 days`,
    tone: "neutral",
    href: "/nex-native/settings/security/activity",
  });
  items.push({
    key: "password",
    label: "Password",
    status: snapshot.password_last_changed_iso
      ? `Last changed ${formatRelative(snapshot.password_last_changed_iso)}`
      : "Not changed via NEX yet",
    tone: "neutral",
    href: "/nex-native/settings/security/password",
  });
  return items;
}

function DashboardRow({
  item,
  compact,
}: {
  item: ChecklistItem;
  compact: boolean;
}): React.JSX.Element {
  const toneColour =
    item.tone === "ok"
      ? NEX.green
      : item.tone === "warn"
        ? NEX.orange
        : item.tone === "pending"
          ? NEX.textMute
          : NEX.cyan;
  const icon =
    item.tone === "ok" ? "✓" : item.tone === "warn" ? "!" : item.tone === "pending" ? "•" : "•";
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: compact ? 6 : 10,
        padding: compact ? "4px 8px" : "8px 10px",
        borderRadius: 10,
        background: compact ? "rgba(0,175,255,0.08)" : "transparent",
        minHeight: compact ? 28 : 36,
        fontSize: compact ? 11 : 13,
      }}
    >
      <span
        aria-hidden
        style={{
          fontSize: compact ? 12 : 14,
          color: toneColour,
          fontWeight: 800,
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <span style={{ fontWeight: 700, color: NEX.text }}>{item.label}</span>
      <span
        style={{
          color: item.tone === "ok" ? NEX.text : NEX.textDim,
          fontWeight: 500,
          marginLeft: compact ? 4 : 8,
          fontSize: compact ? 11 : 12,
        }}
      >
        · {item.status}
      </span>
    </div>
  );
  return item.href ? (
    <Link
      href={item.href}
      prefetch={false}
      data-nex-security-dashboard-row={item.key}
      style={{ textDecoration: "none" }}
    >
      {content}
    </Link>
  ) : (
    <div data-nex-security-dashboard-row={item.key}>{content}</div>
  );
}

function formatRelative(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "recently";
  const diffMs = Date.now() - then;
  const days = Math.round(diffMs / (24 * 60 * 60 * 1000));
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.round(days / 365);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}
