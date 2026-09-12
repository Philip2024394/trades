// NEX Kebab Quick Panel · Philip 2026-09-01.
//
// Opens when the 3-dots kebab (lower-right of the frame) is tapped.
// Two entry buttons: NEX Live · Chat. Selecting Chat expands the panel
// to show landscape friend cards; tapping a card opens that friend's
// chat thread directly (via NexWorkspaceFriends' new initialFriendId
// prop). Same container style as the + recent-pages panel and the
// restaurant business cards (CategoryBusinessCard.cardStyle).
//
// Auto-close (mirrors NexRecentPagesPanel):
//   · 6 s idle
//   · tile / friend select (closes on navigate)
//   · ESC key
//   · shell may force-close on typing (parent-driven via `open` prop)

"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Radio, MessageSquare, Heart } from "lucide-react";
import { NEX_MOCK_FRIENDS } from "./NexPendingChats";
import { TouchButton } from "./primitives/TouchButton";

export type KebabPanelSelection =
  | { kind: "live" }
  | { kind: "chat" }
  | { kind: "social" }
  | { kind: "friend"; friendId: string };

interface Props {
  open: boolean;
  onSelect: (sel: KebabPanelSelection) => void;
  onClose: () => void;
  /** Portal target selector · Philip 2026-09-07 (NEX Frameless Recovery
   *  Slice 1). Defaults to ".nex-console-viewport" (legacy phone-frame
   *  chassis at /nexapp). Frameless callers pass their own container
   *  selector (e.g., ".nex-home-viewport") so the panel portals into
   *  the new home page's positioned root instead of the chassis. When
   *  set to any non-default selector, the panel switches its own
   *  positioning to safe-area-aware absolute values instead of the
   *  frame-bezel-calibrated percentages. */
  mountSelector?: string;
}

const DEFAULT_MOUNT_SELECTOR = ".nex-console-viewport";

const AUTO_CLOSE_MS = 6000;
const ACCENT      = "#4AC9FF";
const ACCENT_RING = "rgba(74,201,255,0.35)";

type View = "root" | "friends";

export function NexKebabQuickPanel({
  open,
  onSelect,
  onClose,
  mountSelector = DEFAULT_MOUNT_SELECTOR,
}: Props) {
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  const [view, setView] = useState<View>("root");
  const isFrameless = mountSelector !== DEFAULT_MOUNT_SELECTOR;

  // Reset to root each time the panel opens fresh.
  useEffect(() => { if (open) setView("root"); }, [open]);

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    setMountEl(document.querySelector<HTMLElement>(mountSelector));
  }, [open, mountSelector]);

  // Idle auto-close · resets when the user drills into friends view.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(t);
  }, [open, view, onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (view === "friends") setView("root");
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, view, onClose]);

  if (!open || !mountEl) return null;

  return createPortal(
    <div
      role="dialog"
      aria-label={view === "root" ? "Live or chat" : "Pick a friend"}
      style={{
        position: "absolute",
        // Positioning · Philip 2026-09-07 (NEX Frameless Recovery Slice 1)
        //   · legacy phone-frame chassis: keep the bezel-calibrated
        //     percentages that clear the frame's rightKebab affordance
        //     (geometry.ts BEZEL_AFFORDANCES.rightKebab).
        //   · frameless (mountSelector !== default): use safe-area-aware
        //     absolute pixels that sit above a 96px-tall bottom console
        //     with 16px side gutters + safe-area bottom.
        bottom: isFrameless
          ? "calc(96px + env(safe-area-inset-bottom, 0px))"
          : "13.40%",
        left:   isFrameless ? 16 : "14%",
        right:  isFrameless ? 16 : "14%",
        zIndex: 25,
        // Restaurant-card container style (verbatim from CategoryBusinessCard).
        background: "rgba(21, 21, 21, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderRadius: 14,
        padding: 10,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.35)",
        display: "flex",
        alignItems: "center",
        // Root view (Live · Chat · Social) uses flex:1 tiles that share the
        // container width evenly · trio fits in the centre of the transparent
        // area without scroll. Friends view stays flex-start with horizontal
        // scroll so the friend list can overflow when there are many cards.
        justifyContent: view === "root" ? "center" : "flex-start",
        gap: 10,
        overflowX: view === "root" ? "hidden" : "auto",
        overflowY: "hidden",
        pointerEvents: "auto",
        animation: "nex-kebab-panel-in 200ms ease forwards",
      }}
      className="nex-no-scrollbar"
    >
      {view === "root" && (
        <>
          {/* Live · left */}
          <TouchButton
            aria-label="Open Live"
            onTap={() => { onSelect({ kind: "live" }); }}
            style={rootButtonStyle}
          >
            <Radio size={22} strokeWidth={1.8} color={ACCENT} />
            <span style={rootButtonLabelStyle}>Live</span>
          </TouchButton>
          {/* Chat · navigates directly to the landscape friend-cards screen. */}
          <TouchButton
            aria-label="Open friends chat screen"
            onTap={() => { onSelect({ kind: "chat" }); }}
            style={rootButtonStyle}
          >
            <MessageSquare size={22} strokeWidth={1.8} color={ACCENT} />
            <span style={rootButtonLabelStyle}>Chat</span>
          </TouchButton>
          {/* Social · dating / floating profiles surface (DiscoverShell). */}
          <TouchButton
            aria-label="Open social discover screen"
            onTap={() => { onSelect({ kind: "social" }); }}
            style={rootButtonStyle}
          >
            <Heart size={22} strokeWidth={1.8} color={ACCENT} />
            <span style={rootButtonLabelStyle}>Social</span>
          </TouchButton>
        </>
      )}

      {view === "friends" && (
        <>
          {/* Back tile · returns to root (Live / Chat) */}
          <TouchButton
            aria-label="Back"
            onTap={() => setView("root")}
            style={{
              ...friendTileStyle,
              width: 34,
              borderColor: "rgba(255,255,255,0.14)",
              color: "rgba(245,245,245,0.7)",
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>‹</span>
          </TouchButton>
          {NEX_MOCK_FRIENDS.map((f) => (
            <TouchButton
              key={f.id}
              aria-label={`Chat with ${f.name}`}
              onTap={() => onSelect({ kind: "friend", friendId: f.id })}
              style={friendTileStyle}
              pressScale={0.94}
            >
              <div
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  background: f.color,
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  position: "relative",
                }}
              >
                {f.initial}
                {f.unread > 0 && (
                  <span
                    aria-label={`${f.unread} unread`}
                    style={{
                      position: "absolute",
                      top: -3, right: -3,
                      minWidth: 14, height: 14,
                      padding: "0 4px",
                      borderRadius: 7,
                      background: "#ef4444",
                      color: "#fff",
                      fontSize: 9,
                      lineHeight: "14px",
                      textAlign: "center",
                      fontWeight: 700,
                    }}
                  >
                    {f.unread}
                  </span>
                )}
              </div>
              <div
                style={{
                  fontSize: 10,
                  lineHeight: 1.1,
                  color: "rgba(245,245,245,0.9)",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {f.name}
              </div>
            </TouchButton>
          ))}
        </>
      )}
      <style>{`
        @keyframes nex-kebab-panel-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>
    </div>,
    mountEl,
  );
}

const rootButtonStyle: React.CSSProperties = {
  appearance: "none",
  // Root tiles share the container width equally · Philip 2026-09-01
  // ("must fit center area of the screen"). flex:1 with a sensible
  // max so on wider desktops the trio doesn't stretch to ugly widths.
  flex: 1,
  minWidth: 0,
  maxWidth: 140,
  height: 58,
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${ACCENT_RING}`,
  color: "#fff",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  padding: "6px 10px",
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "transform 140ms ease, border-color 140ms ease",
};

const rootButtonLabelStyle: React.CSSProperties = {
  fontSize: 10.5,
  letterSpacing: 0.3,
  color: "rgba(245,245,245,0.92)",
  fontWeight: 500,
};

const friendTileStyle: React.CSSProperties = {
  appearance: "none",
  flexShrink: 0,
  width: 58,
  height: 58,
  borderRadius: 10,
  background: "rgba(255,255,255,0.05)",
  border: `1px solid ${ACCENT_RING}`,
  color: ACCENT,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 3,
  padding: 4,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "transform 140ms ease, border-color 140ms ease",
};
