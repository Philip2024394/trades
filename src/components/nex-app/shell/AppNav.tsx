"use client";

// AppNav — top nav for the canvas surface (per Design Language v1.1 §6.7).
// Shows the NEX brand logo + trade small-caps subtitle on the left,
// bell icon on the right.
//
// The chat surface has its own nav (see ChatSurfaceNav) — this one is
// specifically for the canvas surface (Discover, Compare, etc.).

import { Bell } from "lucide-react";
import { useConversationState } from "../state/ConversationStateProvider";

export function AppNav() {
  const { config } = useConversationState();
  const tradeLabel =
    config.trade_slug === "staircase"
      ? "Staircases"
      : config.trade_slug.charAt(0).toUpperCase() + config.trade_slug.slice(1);

  return (
    <header
      className="sticky top-0 z-40 flex items-center justify-between px-5 pt-3 pb-2"
      style={{
        background: "color-mix(in oklab, var(--nex-cream) 88%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)"
      }}
    >
      <div className="flex flex-col">
        {/* Logo cropped to the visible NEX mark (image PNG has
            centred whitespace padding — object-cover + centred position
            trims to the visible mark). Aspect ratio matches the logo
            proportions so it lands crisply without distortion. */}
        <div
          className="h-6 w-[74px] overflow-hidden"
          aria-label="NEX"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/staircase-images/nex-logo.png"
            alt="NEX"
            className="h-full w-full"
            style={{ objectFit: "cover", objectPosition: "center" }}
          />
        </div>
        <span
          className="mt-0.5 text-[11px] font-semibold uppercase"
          style={{ color: "var(--nex-neutral-700)", letterSpacing: "0.28em" }}
        >
          {tradeLabel}
        </span>
      </div>
      <button
        type="button"
        aria-label="Notifications"
        className="grid h-10 w-10 place-items-center rounded-full transition-colors"
        style={{ color: "var(--nex-neutral-700)" }}
      >
        <Bell size={22} strokeWidth={1.75} />
      </button>
    </header>
  );
}
