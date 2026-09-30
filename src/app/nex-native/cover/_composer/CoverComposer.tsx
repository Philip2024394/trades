"use client";

// src/app/nex-native/cover/_composer/CoverComposer.tsx
//
// Bridge 99 · Stage 8 · Cover footer composer.
// -----------------------------------------------------------------------------
// Founder direction 2026-09-30 · every cover theme's footer matches the
// Pink Dream chat-composer aesthetic (small "+" left, emoji middle, naked
// input with accent underline, gradient Send button right) so the visitor
// can send a message directly from the cover.
//
// Theme-aware via CSS vars set by <CoverThemeSkin>:
//   · var(--nex-accent)       → primary accent (send button, +, underline)
//   · var(--nex-accent-soft)  → soft accent (borders)
//   · var(--nex-accent-faint) → faint tint (backgrounds)
//   · var(--nex-text)         → body text
//   · var(--nex-font-body)    → font
//
// Send button POSTs /api/nex-native/first-message per Bridge 99 sealed
// §7B activation boundary ("Curiosity does not create identity;
// participation does"). Success redirects to the owner's chat.

import * as React from "react";
import { useCoverSendMessage } from "./useCoverSendMessage";
import {
  CoverInfoTray,
  type CoverInfoTrayContent,
} from "./CoverInfoTray";

export interface CoverComposerProps {
  ownerAccountId: string;
  ownerBusinessId: string | null;
  ownerBisnisTier?: "gratis" | "bisnis";
  ownerDisplayName?: string;
  /** Founder direction 2026-09-30 · when provided, tapping the +
   *  button opens a themed info tray populated from these fields.
   *  When omitted (or empty), the + button stays disabled with the
   *  legacy "More actions coming soon" affordance. */
  infoTrayContent?: CoverInfoTrayContent | null;
}

export function CoverComposer(props: CoverComposerProps): React.JSX.Element {
  const [text, setText] = React.useState("");
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const [infoTrayOpen, setInfoTrayOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const infoTrayEnabled =
    props.infoTrayContent !== null &&
    props.infoTrayContent !== undefined;
  const { send, sendState, lastError, lastResponse } = useCoverSendMessage({
    ownerAccountId: props.ownerAccountId,
    ownerBusinessId: props.ownerBusinessId,
    ownerBisnisTier: props.ownerBisnisTier ?? "gratis",
  });

  const canSend =
    sendState === "idle" && text.trim().length >= 3 && text.trim().length <= 4000;

  // Founder direction 2026-09-30 · rotating "running text" placeholder
  // cycles through short prompts every ~3.5s while the field is empty.
  // Each new phrase slides up from below with a fade so the composer
  // feels alive and invites the visitor to send a message.
  const rotation = React.useMemo(() => {
    const name = props.ownerDisplayName?.trim();
    const base = [
      "Say hello…",
      "Ask us anything…",
      "Send a quick question…",
      "Place an order or enquiry…",
      "Message us anytime…",
    ];
    return name ? [`Message ${name}…`, ...base] : base;
  }, [props.ownerDisplayName]);
  const [placeholderIdx, setPlaceholderIdx] = React.useState(0);
  React.useEffect(() => {
    if (text.length > 0) return;
    const id = window.setInterval(() => {
      setPlaceholderIdx((i) => (i + 1) % rotation.length);
    }, 3500);
    return () => window.clearInterval(id);
  }, [text.length, rotation.length]);
  const runningPlaceholder = rotation[placeholderIdx] ?? rotation[0];

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEmojiOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onSubmit = React.useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSend) return;
      const body = text.trim();
      setText("");
      await send(body);
    },
    [canSend, text, send],
  );

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (!el) {
      setText((p) => p + emoji);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + emoji + el.value.slice(end);
    setText(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  return (
    <>
      <form
        onSubmit={onSubmit}
        data-nex-cover-composer
        style={{
          // Founder direction 2026-09-30 (revised again) · transparent
          // footer wrapper · ONE long rounded container holds the +
          // button, the emoji button, the input, AND the send button
          // together. Both + and Send render as solid accent-colour
          // round buttons inside the field.
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          padding: "10px 12px calc(env(safe-area-inset-bottom, 0) + 10px)",
          display: "flex",
          alignItems: "center",
          background: "transparent",
          fontFamily: "var(--nex-font-body, inherit)",
        }}
      >
        {/* Single long rounded field · holds [+] [😊] [input] [Send].
            Founder direction 2026-09-30 · SOLID dark-navy fill (no
            translucency, no backdrop-blur) so wallpaper/products behind
            never bleed through and the composer reads as its own solid
            band regardless of the theme underneath. */}
        <div
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: 4,
            paddingLeft: 4,
            paddingRight: 4,
            borderRadius: 999,
            background: "#050f1e",
            border:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
            boxShadow: "0 6px 20px rgba(0,0,0,0.5)",
          }}
        >
          {/* Left · SOLID accent-colour "+" round button · when
              infoTrayContent is threaded through, this opens the
              CoverInfoTray with About Us / Delivery / etc. Otherwise
              it stays disabled with a "More actions coming soon" hint. */}
          <button
            type="button"
            aria-label={infoTrayEnabled ? "Open info" : "More actions"}
            aria-expanded={infoTrayEnabled ? infoTrayOpen : undefined}
            disabled={!infoTrayEnabled}
            title={
              infoTrayEnabled
                ? "About · Delivery · Hours · more"
                : "More actions coming soon"
            }
            onClick={
              infoTrayEnabled
                ? () => setInfoTrayOpen((v) => !v)
                : undefined
            }
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "none",
              background: "var(--nex-accent, #00AFFF)",
              color: "#03101D",
              display: "grid",
              placeItems: "center",
              cursor: infoTrayEnabled ? "pointer" : "not-allowed",
              opacity: infoTrayEnabled ? 1 : 0.85,
              flex: "0 0 auto",
              padding: 0,
              boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
            }}
          >
            <PlusIcon />
          </button>

          {/* Emoji picker toggle · transparent, tucks between + and
              input so it doesn't fight the two solid buttons for
              attention. */}
          <button
            type="button"
            aria-label="Insert emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((v) => !v)}
            style={{
              width: 28,
              height: 28,
              padding: 0,
              borderRadius: "50%",
              background: "transparent",
              border: "none",
              color: "var(--nex-text-dim, rgba(255,255,255,0.65))",
              cursor: "pointer",
              flex: "0 0 auto",
              display: "grid",
              placeItems: "center",
            }}
          >
            <SmileIcon />
          </button>

          {/* Text input + running-text placeholder overlay · wrapper
              is position:relative so the overlay lays exactly over
              the input. HTML placeholder is empty · overlay owns the
              rotating hint so the change animates instead of
              swapping instantly. */}
          <style>{`
            @keyframes nex-cover-placeholder-in {
              0%   { opacity: 0; transform: translateY(8px); }
              100% { opacity: 1; transform: translateY(0); }
            }
          `}</style>
          <div
            style={{
              position: "relative",
              flex: "1 1 0%",
              minWidth: 0,
              display: "flex",
              alignItems: "center",
            }}
          >
            <input
              ref={inputRef}
              type="text"
              aria-label={runningPlaceholder}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={sendState === "sending"}
              maxLength={4000}
              style={{
                flex: "1 1 0%",
                minWidth: 0,
                width: "100%",
                padding: "6px 4px",
                background: "transparent",
                border: "none",
                color: "var(--nex-text, #F2F5F8)",
                fontSize: 15,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            {text.length === 0 && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  top: 0,
                  left: 4,
                  right: 4,
                  bottom: 0,
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                  color: "var(--nex-text-dim, rgba(255,255,255,0.55))",
                  fontSize: 15,
                  fontFamily: "inherit",
                  overflow: "hidden",
                }}
              >
                <span
                  key={placeholderIdx}
                  style={{
                    animation:
                      "nex-cover-placeholder-in 420ms ease-out both",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "inline-block",
                    maxWidth: "100%",
                  }}
                >
                  {runningPlaceholder}
                </span>
              </div>
            )}
          </div>

          {/* Right · SOLID accent-colour Send round button · sits
              INSIDE the field. Disabled state shrinks its presence
              rather than switching to a grey scheme so the composer
              always feels theme-coloured. */}
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            style={{
              flex: "0 0 auto",
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "none",
              background: "var(--nex-accent, #00AFFF)",
              color: "#03101D",
              display: "grid",
              placeItems: "center",
              cursor: canSend ? "pointer" : "not-allowed",
              opacity: canSend ? 1 : 0.45,
              boxShadow: canSend
                ? "0 4px 10px rgba(0,0,0,0.35), 0 0 10px var(--nex-accent-glow, rgba(0,175,255,0.35))"
                : "none",
              padding: 0,
              transition: "opacity 120ms ease, box-shadow 120ms ease",
            }}
          >
            {sendState === "sending" ? <DotsIcon /> : <SendIcon />}
          </button>
        </div>
      </form>

      {/* Founder direction 2026-09-30 · info tray opens from the +
          button. Renders only when infoTrayContent is threaded through
          from the layout (real business data OR MARIA_MOCK preview). */}
      {infoTrayEnabled && props.infoTrayContent && (
        <CoverInfoTray
          open={infoTrayOpen}
          onClose={() => setInfoTrayOpen(false)}
          businessName={props.ownerDisplayName ?? "this shop"}
          content={props.infoTrayContent}
        />
      )}

      {/* Error toast · surfaces above the composer */}
      {lastError && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0) + 70px)",
            left: 12,
            right: 12,
            zIndex: 31,
            padding: "8px 12px",
            fontSize: 12,
            color: "#FFB1A4",
            background: "rgba(60, 20, 20, 0.92)",
            borderRadius: 10,
            fontFamily: "var(--nex-font-body, inherit)",
          }}
        >
          {lastError}
        </div>
      )}

      {/* Challenge surface · sealed §Q7 neutral copy */}
      {lastResponse?.status === "challenge" && (
        <div
          role="alert"
          style={{
            position: "fixed",
            bottom: "calc(env(safe-area-inset-bottom, 0) + 70px)",
            left: 12,
            right: 12,
            zIndex: 31,
            padding: "8px 12px",
            fontSize: 12,
            color: "var(--nex-text, #F2F5F8)",
            background: "rgba(30, 50, 90, 0.92)",
            borderRadius: 10,
            fontFamily: "var(--nex-font-body, inherit)",
          }}
        >
          Please confirm you're not a bot.
        </div>
      )}

      {/* Emoji picker · simple grid · close on pick or backdrop */}
      {emojiOpen && (
        <EmojiPicker
          onClose={() => setEmojiOpen(false)}
          onPick={(e) => {
            insertEmoji(e);
            setEmojiOpen(false);
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Emoji picker · minimal · uses theme accent
// ---------------------------------------------------------------------------

const EMOJI_SET: string[] = [
  "😀", "😁", "😂", "🤣", "😊", "🥰", "😍", "🤩",
  "😘", "🙂", "🤗", "😌", "😉", "😎", "🥳", "😇",
  "🤔", "🫶", "🙌", "👏", "🤝", "🙏", "💕", "💖",
  "💗", "💘", "💝", "❤️", "🩷", "✨", "⭐", "🌟",
  "🔥", "🎉", "🎊", "🎁", "🍰", "☕", "🍵", "🍕",
];

function EmojiPicker({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (emoji: string) => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Insert emoji"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        display: "grid",
        placeItems: "end center",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0) + 80px)",
        background: "rgba(3,8,20,0.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(340px, calc(100vw - 24px))",
          padding: 12,
          borderRadius: 18,
          background:
            "linear-gradient(160deg, rgba(6,14,28,0.96), rgba(3,8,20,0.98))",
          border: "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
          boxShadow: "0 30px 80px rgba(0,0,0,0.55)",
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gap: 4,
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {EMOJI_SET.map((emoji, i) => (
          <button
            key={`${emoji}-${i}`}
            type="button"
            onClick={() => onPick(emoji)}
            style={{
              width: "100%",
              aspectRatio: "1 / 1",
              border: "none",
              background: "transparent",
              color: "var(--nex-text, #F2F5F8)",
              fontSize: 22,
              cursor: "pointer",
              padding: 0,
              borderRadius: 8,
            }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
function SmileIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8.5 14c1 1.2 2.2 1.8 3.5 1.8s2.5-.6 3.5-1.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="15" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 12l16-8-6 16-2.5-6.5L4 12z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DotsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" />
    </svg>
  );
}
