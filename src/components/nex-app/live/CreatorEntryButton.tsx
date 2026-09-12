"use client";

// src/components/nex-app/live/CreatorEntryButton.tsx
//
// NEX LIVE · Phase B · Lower-right three-dot creator entry
// Philip 2026-09-06 · FOUNDER AUTHORIZATION · PHASE B
//
// A single, calm, mobile-first button that sits at the lower-right of
// the NEX Live surface. Tapping it opens the CreatorPanel.
//
// §2 · minimal · premium · calm · touch-friendly.  Not a floating
// action button, not a giant + · a discreet ⋮ that promises 'create'.
//
// The button is a11y-first (§9): 44×44 minimum touch target, aria-label,
// aria-expanded, aria-controls. Focus is visible.

import { useCallback } from "react";

export type CreatorEntryButtonProps = {
  isOpen: boolean;
  onToggle: () => void;
  /** aria-controls id · must match the panel's id. */
  panelId: string;
};

export function CreatorEntryButton({ isOpen, onToggle, panelId }: CreatorEntryButtonProps) {
  const handleClick = useCallback(() => {
    onToggle();
  }, [onToggle]);

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isOpen ? "Close create menu" : "Open create menu"}
      aria-expanded={isOpen}
      aria-controls={panelId}
      data-testid="nex-live-creator-entry"
      className={[
        // Positioning: lower-right, respects safe area on iOS.
        "absolute right-4 bottom-4",
        "pb-[env(safe-area-inset-bottom,0px)]",
        // Sizing: 44×44 min touch target (§9).
        "h-12 w-12 min-h-[44px] min-w-[44px]",
        // Visual: calm dark chip with subtle contrast, no gradients.
        "rounded-full bg-white/10 backdrop-blur",
        "border border-white/15",
        // Motion: gentle press feedback only.
        "transition-colors duration-150",
        "hover:bg-white/20",
        // A11y focus ring.
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
        // Layout of the glyph inside.
        "grid place-items-center",
        "text-white/90",
        // Elevate above the media surface.
        "z-30",
      ].join(" ")}
    >
      <svg
        aria-hidden="true"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <circle cx="12" cy="5"  r="1.9" />
        <circle cx="12" cy="12" r="1.9" />
        <circle cx="12" cy="19" r="1.9" />
      </svg>
    </button>
  );
}
