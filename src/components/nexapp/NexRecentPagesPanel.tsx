// NEX Recent Pages Panel · Philip 2026-09-01.
//
// Opens when the user HOLDS the + button for 2 seconds (see NexComposer's
// long-press detection). Shows the last places the user visited as square
// tiles so they can jump back with one tap.
//
// Position (Philip's spec):
//   Landscape container at the bottom of the screen · 2.5% padding up
//   from the transparent bottom edge of the master frame.
//   Master v2 interior bottom sits 10.90% above frame bottom, so the panel's
//   bottom edge = 10.90% + 2.5% = 13.40% from frame bottom.
//
// Container style (Philip's spec · "same as the restaurant menu cards"):
//   Matches CategoryBusinessCard's cardStyle exactly —
//     background       rgba(21, 21, 21, 0.85)
//     border           1px solid rgba(255,255,255,0.06)
//     borderRadius     14
//     padding          10
//     backdropFilter   blur(6px)
//     boxShadow        0 4px 12px rgba(0,0,0,0.35)
//
// Auto-close (Philip's spec):
//   Closes after 6s of no interaction · OR when the user taps a tile ·
//   OR when the user starts typing (shell drives this via `open` prop).

"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { TouchButton } from "./primitives/TouchButton";

export interface RecentPage {
  /** Prefixed id · `art:<workspace>` for artifacts or `cap:<capability>` for capabilities. */
  id: string;
  label: string;
  glyph: string; // Emoji or short symbol · matches Room.glyph style.
  kind: "artifact" | "capability";
}

interface Props {
  open: boolean;
  pages: readonly RecentPage[];
  onSelect: (page: RecentPage) => void;
  onClose: () => void;
}

// 6-second idle auto-close (mid-point of Philip's "5-7 seconds" range).
const AUTO_CLOSE_MS = 6000;

const ACCENT      = "#4AC9FF";
const ACCENT_RING = "rgba(74,201,255,0.35)";

export function NexRecentPagesPanel({ open, pages, onSelect, onClose }: Props) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(".nex-console-viewport"));
  }, [open]);

  // Idle auto-close · Philip 2026-09-01 · "5-7 seconds".
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, onClose]);

  // ESC also closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !mountEl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label="Recent pages"
      style={{
        position: "absolute",
        // 2.5% padding above the transparent bottom edge (master interior
        // bottom = 10.90% from frame bottom · so panel bottom = 13.40%).
        bottom: "13.40%",
        // Horizontal insets match the content zone (10.82% on master v3).
        left:   "10.82%",
        right:  "10.82%",
        zIndex: 25,
        // Restaurant-card container style (CategoryBusinessCard.cardStyle · verbatim).
        background: "rgba(21, 21, 21, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 14,
        padding: 10,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
        display: "flex",
        gap: 8,
        overflowX: "auto",
        overflowY: "hidden",
        pointerEvents: "auto",
        animation: "nex-recent-fade-in 200ms ease forwards",
      }}
      className="nex-no-scrollbar"
    >
      {pages.length === 0 && (
        <div style={{ padding: "6px 8px", fontSize: 11, color: "rgba(245,245,245,0.55)", whiteSpace: "nowrap" }}>
          No recent pages yet. Visit some worlds via the +.
        </div>
      )}
      {pages.map((p) => (
        <TouchButton
          key={p.id}
          aria-label={p.label}
          onTap={() => onSelect(p)}
          pressScale={0.94}
          style={{
            appearance: "none",
            flexShrink: 0,
            width: 58,
            height: 58,
            borderRadius: 10, // square with slight round · matches Studio tile family
            background: "rgba(255,255,255,0.05)",
            border: `1px solid ${ACCENT_RING}`,
            color: ACCENT,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            padding: 4,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <div style={{ fontSize: 20, lineHeight: 1 }}>{p.glyph}</div>
          <div
            style={{
              fontSize: 9,
              lineHeight: 1.1,
              color: "rgba(245,245,245,0.9)",
              textAlign: "center",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
              whiteSpace: "nowrap",
            }}
          >
            {p.label}
          </div>
        </TouchButton>
      ))}
      <style>{`
        @keyframes nex-recent-fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>,
    mountEl,
  );
}
