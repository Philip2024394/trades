"use client";

// src/app/nex-native/chat-standard/_universal-composer-footer.tsx
//
// UNIVERSAL COMPOSER FOOTER OVERLAY · sealed 2026-10-05 R3 revision 2.
//
// Drops the sealed Prototype 5 composer layout onto any legacy theme
// as a fixed overlay without touching that theme's shell. The overlay
// sits on top of whatever native composer exists at the bottom of the
// legacy page · its solid background covers the native composer so
// visually there is only one composer, the new one.
//
// Layout matches R3 revision 2 (sealed via the Standard Experience):
//
//   [😊 │ 📷 📎 Say something…]  [▶ round send]  [+ round plus]
//    INSIDE INPUT PILL             OUTSIDE RIGHT
//
// Also owns the + menu dialog (Contacts · Product · Animation ·
// Settings) so the + button on the right of the composer triggers the
// same menu the Standard Experience shows.
//
// Theme-neutral defaults · NEX cyan. Callers pass accent/deep to tint
// the overlay to the theme's identity.

import * as React from "react";

const NEX_CYAN = "#00AFFF";
const NEX_DEEP = "#020914";
const NEX_HIGHLIGHT = "#F4F7FC";

export interface UniversalComposerFooterProps {
  accent?: string;
  deep?: string;
  /** Optional send glyph · defaults to a paper-plane arrow. Themes may
   *  pass their signature glyph (🫧 for ocean · ☕ for coffee etc.) */
  sendGlyph?: React.ReactNode;
}

export function UniversalComposerFooter({
  accent = NEX_CYAN,
  deep = NEX_DEEP,
  sendGlyph,
}: UniversalComposerFooterProps): React.JSX.Element {
  const [value, setValue] = React.useState("");
  const [emojiActive, setEmojiActive] = React.useState(false);
  const [plusOpen, setPlusOpen] = React.useState(false);
  const hasText = value.trim().length > 0;

  return (
    <>
      {/* Bottom composer bar · fixed to the viewport, full width.
          OUTER CONTAINER BACKGROUND REMOVED (sealed 2026-10-05
          refinement) · just a transparent wrapper hosting the pill
          + round send + round plus. Chat / theme content shows
          through everywhere except on the actual button fills. */}
      <div
        data-nex-universal-composer-footer
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 55,
          padding: "10px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
          background: "transparent",
          display: "flex",
          alignItems: "center",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, pointerEvents: "auto" }}>
          <ComposerPill
            accent={accent}
            value={value}
            onChange={setValue}
            onSend={() => {
              if (hasText) setValue("");
            }}
            emojiActive={emojiActive}
            onToggleEmoji={() => setEmojiActive((v) => !v)}
          />
        </div>
        <SendButton
          accent={accent}
          deep={deep}
          disabled={!hasText}
          onClick={() => {
            if (hasText) setValue("");
          }}
          glyph={sendGlyph}
        />
        <PlusButton
          accent={accent}
          deep={deep}
          open={plusOpen}
          onToggle={() => setPlusOpen((v) => !v)}
        />
      </div>

      <PlusMenu
        accent={accent}
        deep={deep}
        open={plusOpen}
        onClose={() => setPlusOpen(false)}
      />
    </>
  );
}

// ─── Composer input pill ────────────────────────────────────────────

function ComposerPill({
  accent,
  value,
  onChange,
  onSend,
  emojiActive,
  onToggleEmoji,
}: {
  accent: string;
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  emojiActive: boolean;
  onToggleEmoji: () => void;
}): React.JSX.Element {
  const inlineIconStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: 999,
    background: "transparent",
    border: "none",
    color: NEX_HIGHLIGHT,
    cursor: "pointer",
    display: "grid",
    placeItems: "center",
    flexShrink: 0,
    padding: 0,
    fontSize: 16,
  };
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        height: 44,
        borderRadius: 999,
        // Pill fill removed 2026-10-05 · outlined border only ·
        // matches the Standard Experience composer treatment.
        background: "transparent",
        border: `1px solid ${accent}55`,
      }}
    >
      <button
        type="button"
        aria-label={emojiActive ? "Close picker" : "Open emoji picker"}
        aria-pressed={emojiActive}
        onClick={onToggleEmoji}
        style={{
          ...inlineIconStyle,
          background: emojiActive ? `${accent}aa` : "transparent",
        }}
      >
        {emojiActive ? "×" : "😊"}
      </button>
      <span
        aria-hidden
        style={{
          width: 1,
          height: 20,
          background: `${NEX_HIGHLIGHT}44`,
          margin: "0 2px",
          flexShrink: 0,
        }}
      />
      <button
        type="button"
        aria-label="Take photo"
        style={inlineIconStyle}
      >
        <CameraIcon />
      </button>
      <button
        type="button"
        aria-label="Attach file"
        style={inlineIconStyle}
      >
        <ClipIcon />
      </button>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSend();
          }
        }}
        placeholder="Say something…"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
          border: "none",
          outline: "none",
          color: NEX_HIGHLIGHT,
          fontSize: 13,
          fontFamily: "inherit",
          paddingLeft: 6,
        }}
      />
    </div>
  );
}

// ─── Send button ────────────────────────────────────────────────────

function SendButton({
  accent,
  deep,
  disabled,
  onClick,
  glyph,
}: {
  accent: string;
  deep: string;
  disabled: boolean;
  onClick: () => void;
  glyph?: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label="Send"
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        cursor: disabled ? "default" : "pointer",
        flexShrink: 0,
        padding: 0,
        pointerEvents: "auto",
        background: disabled
          ? `${accent}44`
          : `linear-gradient(180deg, ${accent}, ${accent}dd)`,
        border: `1px solid ${accent}`,
        color: deep,
        fontSize: 16,
        fontWeight: 800,
        opacity: disabled ? 0.55 : 1,
        boxShadow: disabled
          ? "none"
          : `0 4px 12px ${accent}55, inset 0 1px 1px rgba(255,255,255,0.3)`,
        transition:
          "background 160ms ease-out, opacity 160ms ease-out, box-shadow 160ms ease-out",
      }}
    >
      {glyph ?? <SendIcon />}
    </button>
  );
}

// ─── Plus button ────────────────────────────────────────────────────

function PlusButton({
  accent,
  deep: _deep,
  open,
  onToggle,
}: {
  accent: string;
  deep: string;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-label={open ? "Close menu" : "Add to this chat"}
      aria-pressed={open}
      onClick={onToggle}
      style={{
        width: 40,
        height: 40,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        flexShrink: 0,
        padding: 0,
        pointerEvents: "auto",
        background: open ? `${accent}aa` : `${accent}22`,
        border: open ? `1px solid ${accent}` : `1px solid ${accent}99`,
        color: NEX_HIGHLIGHT,
        transition: "background 160ms ease-out, border 160ms ease-out",
      }}
    >
      <PlusIcon />
    </button>
  );
}

// ─── Plus menu (same four sealed actions) ───────────────────────────

function PlusMenu({
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
        }}
      />
      <div
        role="dialog"
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
          transition: "transform 240ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 700, color: NEX_HIGHLIGHT, textAlign: "center" }}>
          Add to this chat
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, justifyItems: "center" }}>
          <button type="button" aria-label="Contacts" style={option}>
            <span aria-hidden style={iconCircle}><ContactsIcon /></span>
            <span>Contacts</span>
          </button>
          <button type="button" aria-label="Product" style={option}>
            <span aria-hidden style={iconCircle}><ProductIcon /></span>
            <span>Product</span>
          </button>
          <button type="button" aria-label="Animation" style={option}>
            <span aria-hidden style={iconCircle}><AnimationIcon /></span>
            <span>Animation</span>
          </button>
          <button type="button" aria-label="Settings" style={option}>
            <span aria-hidden style={iconCircle}><SettingsIcon /></span>
            <span>Settings</span>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
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

// ─── Icons ──────────────────────────────────────────────────────────

function CameraIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
function ClipIcon(): React.JSX.Element {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}
function SendIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M3 11.5 21 3l-7 18-2-8-9-1.5z" />
    </svg>
  );
}
function PlusIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ContactsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}
function ProductIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}
function AnimationIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}
function SettingsIcon(): React.JSX.Element {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}
