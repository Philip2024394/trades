"use client";

// src/app/nex-native/chat-standard/_universal-chrome-overlay.tsx
//
// UNIVERSAL THEME CHROME OVERLAY · sealed 2026-10-05.
//
// Mounts the two universal chrome affordances on any theme route
// without touching that theme's shell / composer / viewer:
//
//   - Floating + button (lower-left) → opens the centered + menu
//     with the four sealed actions: Contacts · Product · Animation ·
//     Settings.
//   - Floating 3-dots (lower-right · raised when a theme already
//     has its own 3-dots at the normal position) → reveals Call /
//     Video Call / Mic icons sliding in from the right.
//
// Why this exists · the Standard Experience shell carries these
// chrome rules natively (R7 and R9). Legacy theme shells
// (PortraitBloomShell, hand-coded theme-1/pink-dream/cyber-grid
// pages, the Haunted Hotel prototype) don't. Rather than modify
// each sealed shell, this overlay is dropped on top of them.
//
// Theme-neutral defaults · NEX cyan (`#00AFFF`). Callers may pass
// an `accent` prop to tint the overlay to the theme's identity
// colour.
//
// Props:
//   accent · optional CSS colour · defaults to NEX cyan
//   deep   · optional dark base for buttons/menu · defaults to NEX
//            deep blue
//
// Sealed 2026-10-05 refinement · "one + button, one 3-dots button":
//   - Floating + button + its menu REMOVED · now owned by the
//     UniversalComposerFooter mounted alongside this overlay.
//   - The 3-dots sits at its standard lower-right position on every
//     theme. zIndex 60 visually covers any native theme-specific
//     3-dots behind it, so every live theme shows exactly one.

import * as React from "react";

const NEX_CYAN = "#00AFFF";
const NEX_DEEP = "#020914";
const NEX_HIGHLIGHT = "#F4F7FC";

export interface UniversalChromeOverlayProps {
  accent?: string;
  deep?: string;
}

export function UniversalChromeOverlay({
  accent = NEX_CYAN,
  deep = NEX_DEEP,
}: UniversalChromeOverlayProps): React.JSX.Element {
  const [callActionsOpen, setCallActionsOpen] = React.useState(false);

  // Sealed 2026-10-05 refinement · "one + button, one 3-dots button" ·
  //   - The floating + button and its menu were removed because the
  //     UniversalComposerFooter already owns the + button + menu.
  //   - The 3-dots sits at its standard lower-right position on every
  //     theme (no `avoidLowerRight` raise). zIndex 60 means it visually
  //     covers any native theme-specific 3-dots sitting behind it, so
  //     every live theme shows exactly one 3-dots button.
  return (
    <FloatingCallActions
      accent={accent}
      deep={deep}
      open={callActionsOpen}
      onToggle={() => setCallActionsOpen((v) => !v)}
    />
  );
}

// ─── Floating + button (lower-left) ─────────────────────────────────

function FloatingPlusButton({
  accent,
  deep,
  open,
  onToggle,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const activeStyle: React.CSSProperties = open
    ? {
        background: `linear-gradient(180deg, ${accent}cc, ${accent}f0)`,
        border: `1px solid ${accent}`,
      }
    : {
        background: `linear-gradient(180deg, ${deep}d9, ${deep}f2)`,
        border: `1px solid ${accent}99`,
      };
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Add to this chat"}
      aria-pressed={open}
      onClick={onToggle}
      data-nex-universal-plus-toggle={open ? "open" : "closed"}
      style={{
        position: "fixed",
        left: 14,
        bottom: "calc(env(safe-area-inset-bottom, 0) + 76px)",
        zIndex: 60,
        width: 44,
        height: 44,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: NEX_HIGHLIGHT,
        cursor: "pointer",
        padding: 0,
        boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px ${accent}33`,
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        transition: "background 180ms ease-out, border 180ms ease-out",
        ...activeStyle,
      }}
    >
      <PlusIcon />
    </button>
  );
}

// ─── Floating 3-dots call actions (lower-right) ─────────────────────

function FloatingCallActions({
  accent,
  deep,
  open,
  onToggle,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  const circle: React.CSSProperties = {
    width: 40,
    height: 40,
    borderRadius: 999,
    border: `1px solid ${accent}99`,
    background: `linear-gradient(180deg, ${deep}d9, ${deep}f2)`,
    color: NEX_HIGHLIGHT,
    display: "grid",
    placeItems: "center",
    cursor: "pointer",
    padding: 0,
    boxShadow: `0 6px 16px rgba(0,0,0,0.5), 0 0 0 1px ${accent}33`,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
  };
  const toggleActive: React.CSSProperties = open
    ? {
        background: `linear-gradient(180deg, ${accent}cc, ${accent}f0)`,
        border: `1px solid ${accent}`,
      }
    : {
        background: circle.background,
        border: `1px solid ${accent}99`,
      };
  const actionWrap: React.CSSProperties = {
    display: "flex",
    gap: 8,
    alignItems: "center",
    opacity: open ? 1 : 0,
    transform: `translateX(${open ? 0 : 20}px)`,
    transition:
      "opacity 220ms ease-out, transform 300ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
    pointerEvents: open ? "auto" : "none",
  };
  const bottomOffset = 76;
  return (
    <div
      data-nex-universal-call-actions={open ? "open" : "closed"}
      style={{
        position: "fixed",
        right: 14,
        bottom: `calc(env(safe-area-inset-bottom, 0) + ${bottomOffset}px)`,
        zIndex: 60,
        display: "flex",
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={actionWrap}>
        <button
          type="button"
          aria-label="Mic"
          data-nex-universal-call-action="mic"
          style={circle}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="Video call"
          data-nex-universal-call-action="video"
          style={circle}
        >
          <VideoCallIcon />
        </button>
        <button
          type="button"
          aria-label="Call"
          data-nex-universal-call-action="call"
          style={circle}
        >
          <CallIcon />
        </button>
      </div>
      <button
        type="button"
        aria-label={open ? "Close actions" : "Open actions"}
        aria-pressed={open}
        onClick={onToggle}
        data-nex-universal-call-actions-toggle={open ? "open" : "closed"}
        style={{
          ...circle,
          ...toggleActive,
          transition: "background 180ms ease-out, border 180ms ease-out",
        }}
      >
        <DotsVerticalIcon />
      </button>
    </div>
  );
}

// ─── + menu (centered dialog) ───────────────────────────────────────

function FloatingPlusMenu({
  accent,
  deep,
  open,
  onClose,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const option: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "12px 8px",
    width: "100%",
    minWidth: 0,
    borderRadius: 16,
    border: `1px solid ${accent}66`,
    background: `${accent}1a`,
    color: NEX_HIGHLIGHT,
    cursor: "pointer",
    textAlign: "center",
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 600,
    transition: "background 160ms ease-out, transform 160ms ease-out",
  };
  const iconCircle: React.CSSProperties = {
    width: 44,
    height: 44,
    borderRadius: 999,
    display: "grid",
    placeItems: "center",
    background: `linear-gradient(135deg, ${accent}, ${accent}aa)`,
    color: NEX_HIGHLIGHT,
    boxShadow: `0 4px 12px ${accent}55`,
  };
  return (
    <div
      aria-hidden={!open}
      data-nex-universal-plus-menu={open ? "open" : "closed"}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 70,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: open ? "auto" : "none",
        opacity: open ? 1 : 0,
        transition: "opacity 200ms ease-out",
      }}
    >
      <div
        aria-hidden
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          backdropFilter: "blur(4px)",
          WebkitBackdropFilter: "blur(4px)",
        }}
      />
      <div
        role="dialog"
        aria-label="Chat actions"
        style={{
          position: "relative",
          padding: 20,
          borderRadius: 24,
          background: `linear-gradient(180deg, ${deep}e6, ${deep}f5)`,
          border: `1px solid ${accent}99`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${accent}22`,
          display: "flex",
          flexDirection: "column",
          gap: 14,
          minWidth: 340,
          maxWidth: "92%",
          transform: `scale(${open ? 1 : 0.9})`,
          transition:
            "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1), opacity 220ms ease-out",
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: NEX_HIGHLIGHT,
            letterSpacing: "0.02em",
            textAlign: "center",
          }}
        >
          Add to this chat
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 10,
            justifyItems: "center",
          }}
        >
          <button
            type="button"
            data-nex-universal-plus-action="contacts"
            aria-label="Add contact to chat"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <ContactsIcon />
            </span>
            <span>Contacts</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="product"
            aria-label="Add, edit, delete or turn off a product"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <ProductIcon />
            </span>
            <span>Product</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="animation"
            aria-label="Open all theme animations"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <AnimationIcon />
            </span>
            <span>Animation</span>
          </button>
          <button
            type="button"
            data-nex-universal-plus-action="settings"
            aria-label="Open settings page"
            style={option}
          >
            <span aria-hidden style={iconCircle}>
              <SettingsIcon />
            </span>
            <span>Settings</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            marginTop: 2,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${NEX_HIGHLIGHT}33`,
            background: "transparent",
            color: NEX_HIGHLIGHT,
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Icons (self-contained · no engine dependency) ──────────────────

function PlusIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function DotsVerticalIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"
      aria-hidden>
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function CallIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

function VideoCallIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M22 7.5 15.5 12 22 16.5v-9z" />
    </svg>
  );
}

function MicIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function ContactsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}

function ProductIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function AnimationIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}
