"use client";
// NEX Capability Header · Philip 2026-08-30 · Slice 1
//
// Native NEX capability navigation header. Every Capability Surface view
// renders this at the top. NOT a generic webpage back button. The back
// label names the DESTINATION so the user always knows where they'll land.
//
// Locked pattern (Philip 2026-08-30):
//   ← TOOLS
//   What are you calculating?     ← at Tools entry (no back · eyebrow only)
//
//   ← TOOLS
//   Masonry                        ← at category (back returns to Tools entry)
//
//   ← MASONRY
//   Bricks Calculator              ← at calculator (back returns to Masonry)
//
// Global NEX header (Search · Notifications · Create) is untouched. This
// component is the LOCAL back affordance only.

import React from "react";

export interface CapabilityHeaderProps {
  /** When set, renders back chevron with this label as destination. */
  backLabel?: string;
  /** Called when back is tapped. Required when backLabel is set. */
  onBack?: () => void;
  /** Small eyebrow text · shown when no back button (e.g. at capability entry). */
  eyebrow?: string;
  /** Large title / prompt line. */
  title: string;
}

export function CapabilityHeader({
  backLabel,
  onBack,
  eyebrow,
  title,
}: CapabilityHeaderProps) {
  const hasBack = !!backLabel && !!onBack;
  return (
    <header
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        padding: "22px 20px 14px",
      }}
    >
      {hasBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={`Back to ${backLabel}`}
          style={{
            appearance: "none",
            background: "transparent",
            border: "none",
            padding: "6px 4px 6px 0",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "rgba(74,201,255,0.92)",
            fontSize: 11,
            letterSpacing: 2,
            fontWeight: 600,
            fontFamily: "inherit",
            alignSelf: "flex-start",
            minHeight: 32,
          }}
        >
          <span
            aria-hidden
            style={{
              fontSize: 16,
              lineHeight: 1,
              transform: "translateY(-1px)",
            }}
          >
            ←
          </span>
          {backLabel!.toUpperCase()}
        </button>
      ) : eyebrow ? (
        <div
          style={{
            fontSize: 11,
            letterSpacing: 2,
            color: "rgba(74,201,255,0.85)",
            fontWeight: 600,
          }}
        >
          {eyebrow.toUpperCase()}
        </div>
      ) : null}
      <h1
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 600,
          lineHeight: 1.3,
          color: "rgba(245,245,245,0.95)",
          letterSpacing: -0.2,
        }}
      >
        {title}
      </h1>
    </header>
  );
}
