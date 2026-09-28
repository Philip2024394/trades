"use client";

// src/app/nex-native/themes/pink-dream/_hud.tsx
//
// Bridge 24f · Pink Dream floating HUD.
// -------------------------------------
// Two floating overlays layered above the wallpaper:
//   1. Right-side rail · Home + Contacts (mirrors _side-nav-panel.tsx
//      from the Portrait Bloom shell, i.e. "same as theme 1")
//   2. Lower-right 3-dot button that opens a center action sheet
//      with Camera · Video · Mic · Themes
//
// Everything is client-side · Home is a real link back to /chat,
// Contacts / action-sheet buttons open small centered panels then
// close on backdrop tap or Esc.

import * as React from "react";
import Link from "next/link";
import { useEffect, useState } from "react";

const PINK = "#FF3F9F";
const PINK_SOFT = "rgba(255, 79, 163, 0.45)";
const SANS =
  "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

export function PinkDreamHud() {
  const [contactsOpen, setContactsOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setContactsOpen(false);
      setActionsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Bridge 24u · dancing 3-dot merged INTO the right-side rail
         as a third RailButton per Founder polish direction · one
         clean stack instead of two competing right-edge clusters. */}
      <style>{`
        @keyframes nex-pd-dance {
          0%, 60%, 100% {
            opacity: 0.45;
            transform: translateY(0) scale(1);
          }
          30% {
            opacity: 1;
            transform: translateY(-2px) scale(1.2);
            box-shadow: 0 0 8px rgba(255, 139, 197, 0.9);
          }
        }
      `}</style>
      <div
        role="toolbar"
        aria-label="Chat navigation"
        style={{
          position: "fixed",
          right: 6,
          top: "50%",
          transform: "translateY(-50%)",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          zIndex: 7,
        }}
      >
        <RailLink href="/nex-native/chat" ariaLabel="Home">
          <HomeIcon />
        </RailLink>
        <RailButton
          ariaLabel="Contacts"
          onClick={() => setContactsOpen(true)}
        >
          <ContactsIcon />
        </RailButton>
        <RailButton
          ariaLabel="More · Call / Video / Camera / Mic / Themes"
          onClick={() => setActionsOpen(true)}
        >
          <span
            aria-hidden
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
            }}
          >
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                style={{
                  display: "block",
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: PINK,
                  animation: `nex-pd-dance 1.2s ease-in-out ${i * 0.18}s infinite`,
                }}
              />
            ))}
          </span>
        </RailButton>
      </div>

      {contactsOpen && (
        <CenterPanel
          title="Contacts"
          onClose={() => setContactsOpen(false)}
        >
          <PanelHint>
            Your NEX friends appear here when this theme is live in your
            peer chat. This is a preview so the list is empty.
          </PanelHint>
          <Link
            href="/nex-native/chat"
            style={cta()}
            onClick={() => setContactsOpen(false)}
          >
            Open my chats →
          </Link>
        </CenterPanel>
      )}

      {actionsOpen && (
        <CenterPanel title="Send" onClose={() => setActionsOpen(false)}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <ActionTile label="Call" icon={<PhoneIcon />} />
            <ActionTile label="Video" icon={<VideoIcon />} />
            <ActionTile label="Camera" icon={<CameraIcon />} />
            <ActionTile label="Mic" icon={<MicIcon />} />
            <Link
              href="/nex-native/settings/theme"
              onClick={() => setActionsOpen(false)}
              style={{ textDecoration: "none", gridColumn: "1 / -1" }}
            >
              <ActionTile label="Themes" icon={<PaletteIcon />} />
            </Link>
          </div>
          <PanelHint>
            Call / Video / Camera / Mic are visual only in this preview
            · the live peer chat wires each into the calling +
            attachments flow (Bridge 8+9).
          </PanelHint>
        </CenterPanel>
      )}
    </>
  );
}

/* ---------------------------------------------------------------- *
 * Center panel · backdrop + card                                   *
 * ---------------------------------------------------------------- */

function CenterPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20,
        display: "grid",
        placeItems: "center",
        fontFamily: SANS,
      }}
      onClick={onClose}
    >
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(12,7,18,0.55)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "relative",
          width: "min(340px, calc(100vw - 32px))",
          padding: "18px 18px 16px",
          borderRadius: 22,
          background:
            "linear-gradient(160deg, rgba(50,27,61,0.92), rgba(23,18,31,0.94))",
          border: `1px solid ${PINK_SOFT}`,
          color: "#FFF5FA",
          boxShadow:
            "0 30px 80px rgba(0,0,0,0.55), 0 0 30px rgba(255,79,163,0.18)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: PINK,
              fontWeight: 700,
            }}
          >
            {title}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.42)",
              border: "1px solid rgba(255,255,255,0.10)",
              color: "#FFD4E8",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              padding: 0,
            }}
          >
            <CloseIcon />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ActionTile({
  label,
  icon,
}: {
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "16px 8px",
        borderRadius: 16,
        background: "rgba(24,15,30,0.72)",
        border: "1px solid rgba(255,139,197,0.35)",
        color: "#FFF5FA",
        cursor: "pointer",
        transition: "background 160ms ease",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background:
            "linear-gradient(135deg, rgba(255,138,197,0.28), rgba(255,63,159,0.22))",
          display: "grid",
          placeItems: "center",
          color: "#FFF5FA",
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function PanelHint({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        lineHeight: 1.55,
        color: "rgba(255,245,250,0.72)",
      }}
    >
      {children}
    </div>
  );
}

function cta(): React.CSSProperties {
  return {
    display: "block",
    padding: "10px 14px",
    borderRadius: 12,
    background: "linear-gradient(135deg, #FF8AC5, #FF3F9F)",
    color: "#0B0F1A",
    textAlign: "center",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    textDecoration: "none",
    boxShadow: "0 8px 20px rgba(255,63,159,0.35)",
  };
}

/* ---------------------------------------------------------------- *
 * Rail primitives                                                  *
 * ---------------------------------------------------------------- */

function RailLink({
  href,
  ariaLabel,
  children,
}: {
  href: string;
  ariaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      title={ariaLabel}
      style={railBaseStyle()}
    >
      {children}
    </Link>
  );
}

function RailButton({
  ariaLabel,
  onClick,
  children,
}: {
  ariaLabel: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={onClick}
      style={railBaseStyle()}
    >
      {children}
    </button>
  );
}

function railBaseStyle(): React.CSSProperties {
  return {
    width: 34,
    height: 34,
    borderRadius: "50%",
    background: "rgba(11,15,26,0.88)",
    border: "1px solid rgba(255,139,197,0.35)",
    color: "#FFF5FA",
    display: "grid",
    placeItems: "center",
    padding: 0,
    textDecoration: "none",
    cursor: "pointer",
    boxShadow:
      "0 4px 10px rgba(0,0,0,0.55), 0 0 12px rgba(255,79,163,0.18)",
  };
}

/* ---------------------------------------------------------------- *
 * Icons                                                            *
 * ---------------------------------------------------------------- */

function HomeIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12l9-9 9 9" />
      <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
  );
}
function ContactsIcon() {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function PhoneIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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
function CameraIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.8" />
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
function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 11a7 7 0 0014 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="18" x2="12" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function PaletteIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
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
function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
