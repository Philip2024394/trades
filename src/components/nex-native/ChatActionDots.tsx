// src/components/nex-native/ChatActionDots.tsx
//
// Universal chat action dots · founder direction 2026-10-04.
// --------------------------------------------------------------
// A floating 3-dots button at the bottom-right of a chat surface
// that, when tapped, slides a horizontal action pill to the LEFT
// exposing four communication actions: Call · Video · Mic · Camera.
//
// Theme-neutral by default · the component accepts an `accent` prop
// so each theme's chat surface can tint the dots + pill in its own
// amber (haunted-hotel) / green (joker) / cyan (default) / etc.
//
// Mount this component inside the chat surface's page.tsx and wire
// each callback to the surface's call/capture infrastructure
// (PeerCallLauncher for Call/Video; the composer's MediaCapture
// handles for Mic/Camera).

"use client";

import * as React from "react";

interface ChatActionDotsProps {
  onCall?: () => void;
  onVideo?: () => void;
  onMic?: () => void;
  onCamera?: () => void;
  /** Accent hex · paints the dots + action-button icons. Defaults to
   *  the NEX cyan brand accent. Haunted Hotel passes "#d8a856". */
  accent?: string;
  /** Hide the dots entirely when the shop slider / an overlay is up.
   *  Listens to the same `nex-shop-slider-visible` event the Joker +
   *  Haunted Hotel controllers used before. */
  hideWhileOverlayOpen?: boolean;
}

const DEFAULT_ACCENT = "#00AFFF";

export function ChatActionDots({
  onCall,
  onVideo,
  onMic,
  onCamera,
  accent = DEFAULT_ACCENT,
  hideWhileOverlayOpen = true,
}: ChatActionDotsProps): React.JSX.Element | null {
  const [open, setOpen] = React.useState(false);
  const [overlayUp, setOverlayUp] = React.useState(false);

  React.useEffect(() => {
    if (!hideWhileOverlayOpen) return;
    const onEvt = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      setOverlayUp(!!detail?.open);
    };
    window.addEventListener(
      "nex-shop-slider-visible",
      onEvt as EventListener,
    );
    return () =>
      window.removeEventListener(
        "nex-shop-slider-visible",
        onEvt as EventListener,
      );
  }, [hideWhileOverlayOpen]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (overlayUp) return null;

  // When no explicit callback is passed for an action, fall back to
  // dispatching a window CustomEvent so a server page can mount this
  // component without providing client-side closures. Theme + chat
  // surfaces listen for the event they care about and wire the real
  // behaviour on their own tier.
  const defaultDispatch = (key: "call" | "video" | "mic" | "camera") => {
    window.dispatchEvent(new CustomEvent(`nex-chat-action-${key}`));
  };
  const actions: {
    key: "call" | "video" | "mic" | "camera";
    label: string;
    icon: React.ReactNode;
    handler: () => void;
  }[] = [
    {
      key: "call",
      label: "Call",
      icon: <PhoneIcon />,
      handler: onCall ?? (() => defaultDispatch("call")),
    },
    {
      key: "video",
      label: "Video",
      icon: <VideoIcon />,
      handler: onVideo ?? (() => defaultDispatch("video")),
    },
    {
      key: "mic",
      label: "Mic",
      icon: <MicIcon />,
      handler: onMic ?? (() => defaultDispatch("mic")),
    },
    {
      key: "camera",
      label: "Camera",
      icon: <CameraIcon />,
      handler: onCamera ?? (() => defaultDispatch("camera")),
    },
  ];

  return (
    <>
      {/* Backdrop · tap anywhere outside to close the slider. Rendered
          BEHIND the pill but ABOVE the composer so the pill stays
          interactive. */}
      {open && (
        <div
          data-nex-chat-action-backdrop
          aria-hidden
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "transparent",
            zIndex: 9994,
          }}
        />
      )}

      <style>{`
        @keyframes nex-chat-action-pill-in {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes nex-chat-action-dot-pulse {
          0%, 100% { transform: scale(1);   opacity: 0.72; }
          50%      { transform: scale(1.35); opacity: 1; }
        }
      `}</style>

      {/* Horizontal action pill · slides to the LEFT when open. Lives
          to the LEFT of the 3-dots button so tapping an action is a
          natural leftward swipe. */}
      {open && (
        <div
          data-nex-chat-action-pill
          role="toolbar"
          aria-label="Chat actions"
          style={{
            position: "fixed",
            right: 60,
            bottom: 96,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px",
            borderRadius: 999,
            background: "rgba(10, 6, 4, 0.72)",
            border: `1px solid ${withAlpha(accent, 0.5)}`,
            backdropFilter: "blur(14px) saturate(140%)",
            WebkitBackdropFilter: "blur(14px) saturate(140%)",
            boxShadow:
              "0 10px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.08)",
            zIndex: 9996,
            animation: "nex-chat-action-pill-in 180ms cubic-bezier(.2,.7,.2,1) both",
          }}
        >
          {actions.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-label={a.label}
              title={a.label}
              onClick={() => {
                a.handler();
                setOpen(false);
              }}
              data-nex-chat-action={a.key}
              style={{
                width: 38,
                height: 38,
                borderRadius: 999,
                padding: 0,
                display: "grid",
                placeItems: "center",
                background: "rgba(0,0,0,0.45)",
                border: `1px solid ${withAlpha(accent, 0.55)}`,
                color: accent,
                cursor: "pointer",
              }}
            >
              {a.icon}
            </button>
          ))}
        </div>
      )}

      {/* 3-dots floating trigger · bare icon · no round chip.
          Founder direction 2026-10-04: drop the glass container
          around the dots so the trigger reads as just the dots on
          the atmosphere, not as a button chip stacked on top of it. */}
      <button
        type="button"
        aria-label={open ? "Close chat actions" : "Open chat actions"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        data-nex-chat-action-trigger
        style={{
          position: "fixed",
          right: 16,
          bottom: 96,
          width: 32,
          height: 32,
          padding: 0,
          display: "grid",
          placeItems: "center",
          background: "transparent",
          border: "none",
          color: accent,
          cursor: "pointer",
          filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.75))",
          zIndex: 9997,
        }}
      >
        <DotsVerticalIcon />
      </button>
    </>
  );
}

// --- helpers ---------------------------------------------------------

function withAlpha(hex: string, alpha: number): string {
  const clean = hex.replace(/^#/, "");
  const full =
    clean.length === 3
      ? clean.split("").map((c) => c + c).join("")
      : clean;
  const num = parseInt(full, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// --- icons -----------------------------------------------------------

function DotsVerticalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5"  r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.8.3 1.6.6 2.4a2 2 0 0 1-.5 2.1L7.9 9.5a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.8.3 1.6.5 2.4.6a2 2 0 0 1 1.7 2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="3"
        y="6"
        width="13"
        height="12"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M16 10l5-3v10l-5-3z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="3"
        width="6"
        height="12"
        rx="3"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M5 11a7 7 0 0 0 14 0M12 18v3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l2-2h6l2 2h3a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.4" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
