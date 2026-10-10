"use client";

// src/app/nex-native/family-safety/_fs-shell-stub.tsx
//
// TODO · SWAP TO FS-1'S FamilySafetyShell + FamilySafetyNav + StatusChip
// + EmptyState modules once they ship under
// src/components/nex-native/family-safety/{FamilySafetyShell,
// FamilySafetyNav, StatusChip, EmptyState}.tsx. For now, FS-2 provides
// a minimal local stub so this scope can be delivered in parallel
// without blocking on FS-1. The stub reuses FS-1's shipped palette +
// SimulatedPilotBadge directly (no fork).

import * as React from "react";
import {
  FAMILY_SAFETY_PALETTE as P,
  FAMILY_SAFETY_FONT,
} from "@/components/nex-native/family-safety/_palette";
import { SimulatedPilotBadge } from "@/components/nex-native/family-safety/SimulatedPilotBadge";
import type {
  FamilySafetyNavKey,
  StatusChipTone,
} from "@/components/nex-native/family-safety/types";

export interface LocalFamilySafetyShellProps {
  readonly children: React.ReactNode;
  readonly activeNav?: FamilySafetyNavKey;
  readonly subtitle?: string;
  readonly title: string;
}

export function LocalFamilySafetyShell({
  children,
  activeNav,
  subtitle,
  title,
}: LocalFamilySafetyShellProps): React.JSX.Element {
  return (
    <div
      data-nex-family-safety-shell="fs2-local-stub"
      style={{
        minHeight: "100vh",
        background: P.bg,
        color: P.textPrimary,
        fontFamily: FAMILY_SAFETY_FONT,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          padding: "20px 20px 12px 20px",
          borderBottom: `1px solid ${P.divider}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 22,
              lineHeight: 1.2,
              fontWeight: 700,
              color: P.textPrimary,
            }}
          >
            {title}
          </h1>
          <SimulatedPilotBadge size="sm" />
        </div>
        {subtitle && (
          <p
            style={{
              margin: 0,
              color: P.textSecondary,
              fontSize: 14,
              lineHeight: 1.4,
            }}
          >
            {subtitle}
          </p>
        )}
        <LocalFamilySafetyNav active={activeNav} />
      </header>
      <main
        role="main"
        style={{
          flex: 1,
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 760,
          width: "100%",
          margin: "0 auto",
        }}
      >
        {children}
      </main>
    </div>
  );
}

export function LocalFamilySafetyNav({
  active,
}: {
  readonly active?: FamilySafetyNavKey;
}): React.JSX.Element {
  const items: { key: FamilySafetyNavKey; label: string; href: string }[] = [
    { key: "home", label: "Home", href: "/nex-native/family-safety" },
    { key: "setup", label: "Setup", href: "/nex-native/family-safety/setup" },
    {
      key: "dashboard",
      label: "Manage",
      href: "/nex-native/family-safety/manage",
    },
  ];
  return (
    <nav
      aria-label="Family Safety sections"
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 4,
      }}
    >
      {items.map((it) => {
        const isActive = active === it.key;
        return (
          <a
            key={it.key}
            href={it.href}
            data-nex-family-safety-nav-item={it.key}
            aria-current={isActive ? "page" : undefined}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "none",
              color: isActive ? P.textPrimary : P.textSecondary,
              background: isActive ? P.cyanMuted : "transparent",
              border: `1px solid ${isActive ? P.cyanBorder : P.divider}`,
            }}
          >
            {it.label}
          </a>
        );
      })}
    </nav>
  );
}

export interface LocalStatusChipProps {
  readonly tone: StatusChipTone;
  readonly label: string;
  readonly glyph?: string;
  readonly testId?: string;
}

export function LocalStatusChip({
  tone,
  label,
  glyph,
  testId,
}: LocalStatusChipProps): React.JSX.Element {
  const colours: Record<
    StatusChipTone,
    { bg: string; border: string; fg: string }
  > = {
    neutral: { bg: P.surfaceMuted, border: P.divider, fg: P.textSecondary },
    info: { bg: P.cyanMuted, border: P.cyanBorder, fg: P.cyan },
    pending: { bg: P.amberMuted, border: P.amberBorder, fg: P.amber },
    active: {
      bg: P.familyGreenMuted,
      border: P.familyGreenBorder,
      fg: P.familyGreen,
    },
    revoked: {
      bg: P.emergencyMuted,
      border: P.emergencyBorder,
      fg: P.emergency,
    },
    expired: { bg: P.surfaceMuted, border: P.divider, fg: P.textDim },
    suspended: { bg: P.orangeMuted, border: P.cyanBorder, fg: P.orange },
  };
  const c = colours[tone];
  return (
    <span
      role="status"
      data-testid={testId ?? "nex-family-safety-status-chip"}
      data-nex-fs-chip-tone={tone}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 10px",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        borderRadius: 999,
        background: c.bg,
        color: c.fg,
        border: `1px solid ${c.border}`,
      }}
    >
      {glyph && <span aria-hidden>{glyph}</span>}
      {label}
    </span>
  );
}

export function LocalEmptyState({
  title,
  body,
  actions,
}: {
  readonly title: string;
  readonly body: string;
  readonly actions?: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      role="region"
      aria-label={title}
      data-nex-fs-empty-state
      style={{
        padding: 20,
        background: P.surface,
        border: `1px solid ${P.divider}`,
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 16,
          lineHeight: 1.3,
          color: P.textPrimary,
        }}
      >
        {title}
      </h2>
      <p
        style={{
          margin: 0,
          color: P.textSecondary,
          fontSize: 14,
          lineHeight: 1.5,
        }}
      >
        {body}
      </p>
      {actions && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {actions}
        </div>
      )}
    </section>
  );
}
