"use client";

// DiscoverShell — Discover surface. Full-bleed ImageKit background
// image covers the whole viewport; the floating profile cards drift
// on top of it. Tiny title strip has a subtle top scrim so it stays
// legible against any artwork.

import { StatusBar } from "../shell/StatusBar";
import { FloatingProfileUniverse } from "./FloatingProfileUniverse";

const BG_URL =
  "https://ik.imagekit.io/5vv5pw26q/ChatGPT%20Image%20Jul%2024,%202026,%2011_09_06%20PM.png";

export function DiscoverShell() {
  return (
    <div
      className="relative mx-auto flex max-w-md flex-col overflow-hidden"
      style={{
        // Dynamic-viewport height so the surface actually fills the
        // visible area on mobile Safari (100vh includes the URL bar
        // even when it's on-screen, which makes the page look short).
        minHeight: "100dvh",
        height: "100dvh",
        backgroundImage: `url("${BG_URL}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundColor: "var(--nex-cream)"
      }}
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

      {/* Minimal title strip */}
      <div className="relative z-20 px-4 pt-1 pb-2 text-center">
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

      <div className="relative z-20 flex flex-1 flex-col">
        <FloatingProfileUniverse />
      </div>
    </div>
  );
}
