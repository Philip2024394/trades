"use client";

// DiscoverShell — Discover surface. Fullscreen dark canvas; the
// floating profile cards drift on top of it. Tiny title strip has a
// subtle top scrim so header text stays legible.
//
// Philip 2026-09-07 · phone-frame chassis retired — Social always
// renders full viewport (fixed inset:0) regardless of caller. The
// legacy `inShell` prop is preserved for API compatibility with
// NexAppShell.tsx but is now a no-op: there is no transparent phone
// frame interior to fit inside anymore.

import type { CSSProperties } from "react";
import { StatusBar } from "../shell/StatusBar";
import { FloatingProfileUniverse } from "./FloatingProfileUniverse";
// Phase Social · Philip 2026-09-07 · new top discovery selector · sits
// underneath the existing title strip · never removes anything.
import { DiscoverySelector } from "./DiscoverySelector";
// NEX Socials multi-intent · founder-sealed 2026-10-07 · pass through
// the lens so the universal filter in FloatingProfileUniverse narrows
// the pool to profiles whose social_intents overlaps the lens.
import type { SocialIntent } from "@/app/nex-native/nex-socials/_actions";

interface DiscoverShellProps {
  /** Legacy: previously portalled the surface into the phone-frame
   *  chassis. Retained for API compatibility; now ignored — Social
   *  always renders as a full-viewport fullscreen canvas. */
  inShell?: boolean;
  /** NEX Socials lens · when set, the floating universe filters to
   *  profiles whose `social_intents` overlaps the lens. */
  intent?: SocialIntent;
}

export function DiscoverShell({ intent }: DiscoverShellProps = {}) {
  // Master-pass follow-up 2026-10-07 · founder direction: NEX Socials
  // (floating profiles) is a night-life surface. The night-life hero
  // paints the full viewport behind the floating cards + the status
  // + title strip. A dark top-to-bottom gradient keeps the title
  // text legible against the artwork. Falls back to deep NEX navy
  // (background-color beneath) if the PNG fails to load.
  const containerStyle: CSSProperties = {
    // Full viewport, always. Pinned via fixed inset:0 so no parent
    // layout background (cream, founder image, scrollbar gutter,
    // safe-area insets) can leak around the edges.
    position: "fixed",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#020914",
    backgroundImage: [
      "linear-gradient(180deg, rgba(2,9,20,0.45) 0%, rgba(2,9,20,0.20) 40%, rgba(2,9,20,0.70) 100%)",
      "url(\"/nex-socials/night-life-background.png\")",
    ].join(", "),
    backgroundSize: "cover, cover",
    backgroundPosition: "center center, center center",
    backgroundRepeat: "no-repeat, no-repeat",
  };

  return (
    <div
      className="relative flex flex-col overflow-hidden"
      style={containerStyle}
    >
      {/* Top scrim — protects tiny header text from the artwork */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 100%)"
        }}
      />

      <div className="relative z-20" style={{ filter: "invert(1)" }}>
        <StatusBar />
      </div>

      {/* Minimal title strip · NEX logo on the left, title copy centered */}
      <div className="relative z-20 px-4 pt-1 pb-2 text-center">
        {/* Logo · Philip 2026-09-07 · absolute-left so the centered title
            copy stays visually balanced regardless of the mark width. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://ik.imagekit.io/ctlxgvqcm/ChatGPT%20Image%20Sep%207,%202026,%2009_16_25%20AM.png"
          alt="NEX"
          draggable={false}
          style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            height: 32,
            width: "auto",
            objectFit: "contain",
            filter: "drop-shadow(0 1px 4px rgba(0,0,0,0.55))",
            pointerEvents: "none",
            userSelect: "none",
          }}
        />
        <div
          className="text-[10px] font-black uppercase tracking-[0.32em]"
          style={{
            color: "var(--nex-accent-500)",
            textShadow: "0 1px 6px rgba(0,0,0,0.55)"
          }}
        >
          Discover
        </div>
        <div
          className="text-[10.5px] leading-tight"
          style={{
            color: "rgba(255,255,255,0.9)",
            textShadow: "0 1px 4px rgba(0,0,0,0.55)"
          }}
        >
          Tap a card · hold to remove
        </div>
      </div>

      {/* Phase Social · new top discovery selector · sits below the
          existing title strip · Female / Everyone / Male tiles. */}
      <div className="relative z-20">
        <DiscoverySelector />
      </div>

      <div className="relative z-20 flex flex-1 flex-col">
        <FloatingProfileUniverse intent={intent} />
      </div>
    </div>
  );
}
