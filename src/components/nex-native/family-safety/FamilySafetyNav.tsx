// src/components/nex-native/family-safety/FamilySafetyNav.tsx
//
// NEX Family Safety · in-shell nav chips · authored 2026-10-10.
// -------------------------------------------------------------
// A single, honest nav strip rendered inside the Family Safety shell.
// Shows chips for Home / Setup / Dashboard / SafeChat / Subscription.
// Each chip is a Link · the active chip is visually marked without
// becoming unclickable (we want the user to be able to re-tap to
// refresh).
//
// Load-bearing anti-patterns:
//   · Do NOT invent additional nav chips here. The five chips are the
//     sealed Phase 1 navigation.
//   · Do NOT disable the chip for a feature the viewer "doesn't have"
//     · we still show it so the viewer can see the scope. The target
//     surface decides what empty/gated state to render.

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import type { FamilySafetyNavKey } from "./types";

interface NavEntry {
  readonly key: FamilySafetyNavKey;
  readonly href: string;
  readonly label: string;
  readonly glyph: string;
}

const NAV_ENTRIES: readonly NavEntry[] = [
  { key: "home", href: "/nex-native/family-safety", label: "Home", glyph: "🏠" },
  {
    key: "setup",
    href: "/nex-native/family-safety/setup",
    label: "Setup",
    glyph: "🪪",
  },
  {
    key: "dashboard",
    href: "/nex-native/family-safety/dashboard",
    label: "Dashboard",
    glyph: "📊",
  },
  {
    key: "safechat",
    href: "/nex-native/family-safety/safechat",
    label: "SafeChat",
    glyph: "💬",
  },
  {
    key: "subscription",
    href: "/nex-native/family-safety/subscription",
    label: "Subscription",
    glyph: "⚡",
  },
] as const;

export interface FamilySafetyNavProps {
  readonly active?: FamilySafetyNavKey;
}

export function FamilySafetyNav({
  active,
}: FamilySafetyNavProps): React.JSX.Element {
  return (
    <nav
      aria-label="Family Safety sections"
      data-nex-family-safety-nav="true"
      data-nex-family-safety-nav-active={active ?? "none"}
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        padding: "10px 2px",
        marginBottom: 12,
      }}
    >
      {NAV_ENTRIES.map((entry) => {
        const isActive = entry.key === active;
        return (
          <Link
            key={entry.key}
            href={entry.href}
            prefetch={false}
            aria-current={isActive ? "page" : undefined}
            data-nex-family-safety-nav-chip={entry.key}
            data-nex-family-safety-nav-active-chip={isActive ? "true" : "false"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              color: isActive
                ? FAMILY_SAFETY_PALETTE.textPrimary
                : FAMILY_SAFETY_PALETTE.textSecondary,
              background: isActive
                ? FAMILY_SAFETY_PALETTE.familyGreenMuted
                : FAMILY_SAFETY_PALETTE.surfaceMuted,
              border: `1px solid ${
                isActive
                  ? FAMILY_SAFETY_PALETTE.familyGreenBorder
                  : FAMILY_SAFETY_PALETTE.divider
              }`,
              borderRadius: 999,
              letterSpacing: "0.02em",
              whiteSpace: "nowrap",
            }}
          >
            <span aria-hidden>{entry.glyph}</span>
            {entry.label}
          </Link>
        );
      })}
    </nav>
  );
}
