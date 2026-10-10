// src/components/nex-native/family-safety/FamilySafeChatEntryCard.tsx
//
// NEX Family SafeChat · Settings entry card · authored 2026-10-10.
// ----------------------------------------------------------------
// Uses the sealed reserved tile at
// `/nex-family-safety/family-safe-chat-entry-icon.png`. The tile has
// the "FAMILY SAFE / CHAT" wordmark baked in · we must NOT add a
// redundant text title alongside it. Accessible name is attached via
// `aria-label` on the Link.
//
// Routes to `/nex-native/family-safety` (the Family Safety home · the
// hub for Setup / Dashboard / SafeChat / Subscription).
//
// Load-bearing anti-patterns:
//   · Do NOT resize the hero below 72×72 · the baked-in text becomes
//     illegible (sealed reserved-assets doctrine).
//   · Do NOT recolour the tile.
//   · Do NOT add a text title alongside the tile · use `aria-label`.
//   · Do NOT nest inside the sealed SETTINGS_GROUPS array (would
//     break `_settings-ia.test.ts`'s 7-group seal).

import * as React from "react";
import Link from "next/link";
import { FAMILY_SAFETY_PALETTE } from "./_palette";
import { SimulatedPilotBadge } from "./SimulatedPilotBadge";

export interface FamilySafeChatEntryCardProps {
  /** Route the card links to. Defaults to the Family Safety home. */
  readonly href?: string;
  /** Optional one-line subtitle · defaults to the sealed copy. */
  readonly subtitle?: string;
}

const DEFAULT_SUBTITLE =
  "Set up safety for your family · guardian · SafeChat · dashboard";

export function FamilySafeChatEntryCard({
  href = "/nex-native/family-safety",
  subtitle = DEFAULT_SUBTITLE,
}: FamilySafeChatEntryCardProps): React.JSX.Element {
  return (
    <Link
      href={href}
      prefetch={false}
      aria-label="NEX Family SafeChat"
      data-nex-family-safe-chat-entry="true"
      data-testid="nex-family-safe-chat-entry"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 14,
        padding: "16px",
        background: `linear-gradient(135deg, ${FAMILY_SAFETY_PALETTE.familyGreenMuted} 0%, ${FAMILY_SAFETY_PALETTE.surfaceMuted} 100%)`,
        border: `1px solid ${FAMILY_SAFETY_PALETTE.familyGreenBorder}`,
        borderRadius: 14,
        textDecoration: "none",
        color: FAMILY_SAFETY_PALETTE.textPrimary,
        minHeight: 108,
        boxShadow: `0 0 0 1px ${FAMILY_SAFETY_PALETTE.familyGreenMuted}, 0 4px 14px rgba(0,0,0,0.25)`,
        outlineOffset: 2,
      }}
    >
      <div
        aria-hidden
        data-testid="nex-family-safe-chat-entry-hero"
        style={{
          flexShrink: 0,
          width: 96,
          height: 96,
          borderRadius: 14,
          overflow: "hidden",
          display: "grid",
          placeItems: "center",
          background: FAMILY_SAFETY_PALETTE.bg,
        }}
      >
        <img
          src="/nex-family-safety/family-safe-chat-entry-icon.png"
          alt=""
          width={96}
          height={96}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "inline-flex",
            marginBottom: 4,
          }}
        >
          <SimulatedPilotBadge size="sm" />
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: FAMILY_SAFETY_PALETTE.textSecondary,
            lineHeight: 1.45,
          }}
        >
          {subtitle}
        </div>
      </div>
      <div
        aria-hidden
        style={{
          color: FAMILY_SAFETY_PALETTE.familyGreen,
          fontSize: 20,
          fontWeight: 700,
        }}
      >
        →
      </div>
    </Link>
  );
}
