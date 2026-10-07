"use client";

// src/app/nex-native/nex-socials/discover/[intent]/_lens-client.tsx
//
// NEX Socials · lens shell · founder-sealed 2026-10-07.
//
// Thin client wrapper that mounts the sealed DiscoverShell with the
// current intent + overlays the lens banner and the top-row chip
// switcher. The underlying floating-profile canvas is untouched; the
// filter is applied inside FloatingProfileUniverse via the universal
// `social_intents` overlap predicate (same shape production will use).
//
// Chips route to sibling intents without going back to the chooser so
// the user can hop between worlds without losing visual flow.

import Link from "next/link";
import { useRouter } from "next/navigation";
import { DiscoverShell } from "@/components/nex-app/discover/DiscoverShell";
import {
  INTENT_CATALOG,
  INTENT_BY_TOKEN,
} from "../../_intent-catalog";
import type { SocialIntent } from "../../_actions";

const NEX = {
  textPrimary: "#F2F5F8",
  textDim: "rgba(242, 245, 248, 0.72)",
  orange: "#FF7200",
  cyan: "#00AFFF",
  cyanSoft: "rgba(0, 175, 255, 0.35)",
  cyanFaint: "rgba(0, 175, 255, 0.14)",
};

export interface NexSocialsLensShellProps {
  intent: SocialIntent;
}

export function NexSocialsLensShell({ intent }: NexSocialsLensShellProps) {
  const router = useRouter();
  const current = INTENT_BY_TOKEN[intent];

  return (
    <>
      {/* The sealed DiscoverShell paints the night-life background +
          the floating-profile universe. We pass the lens so the universe
          filters its mock pool via the universal social_intents overlap. */}
      <DiscoverShell intent={intent} />

      {/* Lens overlay · rides above DiscoverShell at z-index 40 so it
          sits above the status bar + title strip but below modals. */}
      <div
        data-nex-socials-lens
        data-nex-socials-lens-intent={intent}
        style={{
          position: "fixed",
          top: "max(10px, env(safe-area-inset-top))",
          left: 10,
          right: 10,
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <nav
          data-nex-socials-lens-chips
          aria-label="NEX Socials worlds"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            justifyContent: "center",
            pointerEvents: "auto",
          }}
        >
          <Link
            href="/nex-native/nex-socials"
            data-nex-socials-lens-back
            aria-label="Back to NEX Socials chooser"
            style={chipStyle({ active: false, isBack: true })}
          >
            <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>
              &larr;
            </span>
          </Link>
          {INTENT_CATALOG.map((entry) => {
            const active = entry.intent === intent;
            return (
              <button
                key={entry.intent}
                type="button"
                data-nex-socials-lens-chip={entry.intent}
                data-nex-socials-lens-chip-active={active ? "true" : "false"}
                onClick={() =>
                  router.push(
                    `/nex-native/nex-socials/discover/${entry.intent}`,
                  )
                }
                style={chipStyle({ active, isBack: false })}
                aria-pressed={active}
                aria-label={`Switch to ${entry.displayLabel}`}
              >
                <span aria-hidden style={{ fontSize: 13 }}>
                  {entry.emoji}
                </span>
                <span>{entry.shortLabel}</span>
              </button>
            );
          })}
        </nav>
        <div
          data-nex-socials-lens-banner
          style={{
            margin: "0 auto",
            padding: "6px 12px",
            background: "rgba(2, 9, 20, 0.65)",
            border: `1px solid ${NEX.cyanSoft}`,
            borderRadius: 999,
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            fontSize: 11.5,
            color: NEX.textPrimary,
            pointerEvents: "auto",
            backdropFilter: "blur(6px)",
            WebkitBackdropFilter: "blur(6px)",
            maxWidth: "min(92vw, 420px)",
          }}
        >
          <span aria-hidden style={{ fontSize: 13 }}>
            {current.emoji}
          </span>
          <span
            style={{
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: NEX.cyan,
            }}
          >
            {current.displayLabel} lens
          </span>
          <span style={{ color: NEX.textDim }}>&middot;</span>
          <span style={{ color: NEX.textDim }}>{current.lensSubtitle}</span>
        </div>
      </div>
    </>
  );
}

function chipStyle({
  active,
  isBack,
}: {
  active: boolean;
  isBack: boolean;
}): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: isBack ? "7px 10px" : "7px 12px",
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: "0.02em",
    color: active ? "#001522" : NEX.textPrimary,
    background: active ? NEX.cyan : "rgba(2, 9, 20, 0.6)",
    border: `1px solid ${active ? NEX.cyan : NEX.cyanSoft}`,
    borderRadius: 999,
    cursor: "pointer",
    textDecoration: "none",
    pointerEvents: "auto",
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    fontFamily: "inherit",
    whiteSpace: "nowrap",
  };
}
