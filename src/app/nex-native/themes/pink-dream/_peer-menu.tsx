"use client";

// src/app/nex-native/themes/pink-dream/_peer-menu.tsx
//
// Bridge 24ab · Peer-scoped header controls for Pink Dream.
// ---------------------------------------------------------
// Renders the right cluster of the chat header per messenger
// convention: Call · Video · ⋮
//
// The ⋮ overflow opens a compact centred menu with PEER-specific
// actions (mute, block, report, change wallpaper). App-level things
// (cart, settings, shop) live in the bottom tab bar or Profile.

import { useEffect, useState } from "react";
import Link from "next/link";

const PINK = "#FF3F9F";
const PINK_SOFT = "rgba(255, 79, 163, 0.55)";
const SOFT_WHITE = "#FFF5FA";
const SANS =
  "'Manrope', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function PinkDreamPeerHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <IconButton ariaLabel="Voice call">
        <PhoneIcon />
      </IconButton>
      <IconButton ariaLabel="Video call">
        <VideoIcon />
      </IconButton>
      <IconButton
        ariaLabel="More"
        onClick={() => setMenuOpen(true)}
      >
        <DotsIcon />
      </IconButton>
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Chat with Bunny · options"
          onClick={() => setMenuOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 25,
            display: "grid",
            placeItems: "center",
            background: "rgba(12, 7, 18, 0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            fontFamily: SANS,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(320px, calc(100vw - 32px))",
              padding: "16px 16px 12px",
              borderRadius: 20,
              background:
                "linear-gradient(160deg, rgba(50,27,61,0.94), rgba(23,18,31,0.96))",
              border: `1px solid ${PINK_SOFT}`,
              color: SOFT_WHITE,
              boxShadow:
                "0 30px 80px rgba(0,0,0,0.55), 0 0 30px rgba(255,79,163,0.18)",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.22em",
                textTransform: "uppercase",
                color: PINK,
                fontWeight: 700,
                marginBottom: 8,
              }}
            >
              Bunny 💗 · options
            </div>
            <MenuRow icon={<BellIcon />} label="Mute chat" />
            <MenuRow icon={<PaletteIcon />} label="Change wallpaper" href="/nex-native/settings/theme" onNavigate={() => setMenuOpen(false)} />
            <MenuRow icon={<InfoIcon />} label="Chat info" />
            <div style={{ height: 1, background: "rgba(255,139,197,0.20)", margin: "6px 0" }} />
            <MenuRow icon={<BlockIcon />} label="Block" danger />
            <MenuRow icon={<FlagIcon />} label="Report" danger />
          </div>
        </div>
      )}
    </>
  );
}

function IconButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: "transparent",
        border: "none",
        color: "#FFD4E8",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        padding: 0,
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  );
}

function MenuRow({
  icon,
  label,
  danger,
  href,
  onNavigate,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  href?: string;
  onNavigate?: () => void;
}) {
  const color = danger ? "#FF6B8A" : SOFT_WHITE;
  const inner = (
    <>
      <span
        aria-hidden
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          background: danger
            ? "rgba(255,107,138,0.14)"
            : "rgba(255,139,197,0.14)",
          display: "grid",
          placeItems: "center",
          color,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 14,
          fontWeight: 600,
          color,
        }}
      >
        {label}
      </span>
    </>
  );
  const style: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 8px",
    borderRadius: 12,
    background: "transparent",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    color,
    textDecoration: "none",
  };
  if (href) {
    return (
      <Link href={href} onClick={onNavigate} style={style}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" style={style} onClick={onNavigate}>
      {inner}
    </button>
  );
}

/* Icons */
function PhoneIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h3l2 5-2.5 1.5a12 12 0 006 6L15 14l5 2v3a2 2 0 01-2 2A15 15 0 013 6a2 2 0 012-2z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 10l5-3v10l-5-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="6" r="1.7" fill="currentColor" />
      <circle cx="12" cy="12" r="1.7" fill="currentColor" />
      <circle cx="12" cy="18" r="1.7" fill="currentColor" />
    </svg>
  );
}
function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 8a6 6 0 0112 0c0 5 2 6 2 8H4c0-2 2-3 2-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M10 20a2 2 0 004 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PaletteIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3a9 9 0 100 18c1.4 0 2-.9 2-2 0-.6-.2-1.1-.6-1.5-.5-.5-.6-1.1-.3-1.7.3-.7 1-1.1 1.8-1.1H17a4 4 0 004-4c0-4.4-4-8-9-8z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="10.5" r="1.2" fill="currentColor" />
      <circle cx="11" cy="7" r="1.2" fill="currentColor" />
      <circle cx="15" cy="8.5" r="1.2" fill="currentColor" />
    </svg>
  );
}
function InfoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <line x1="12" y1="11" x2="12" y2="17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="8" r="1.2" fill="currentColor" />
    </svg>
  );
}
function BlockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function FlagIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 21V4h11l-1.5 4L16 12H5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
