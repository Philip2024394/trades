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

export interface CoverComposerProps {
  ownerAccountId: string;
  ownerBusinessId: string | null;
  ownerBisnisTier?: "gratis" | "bisnis";
  ownerDisplayName?: string;
}

export function CoverComposer(props: CoverComposerProps): React.JSX.Element {
  const [text, setText] = React.useState("");
  const [emojiOpen, setEmojiOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const { send, sendState, lastError, lastResponse } = useCoverSendMessage({
    ownerAccountId: props.ownerAccountId,
    ownerBusinessId: props.ownerBusinessId,
    ownerBisnisTier: props.ownerBisnisTier ?? "gratis",
  });

  const canSend =
    sendState === "idle" && text.trim().length >= 3 && text.trim().length <= 4000;
  const placeholder = props.ownerDisplayName
    ? `Message ${props.ownerDisplayName}…`
    : "Message…";

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
          // Founder direction 2026-09-30 (revised) · NO background
          // container on the footer itself · the composer floats. All
          // affordances live inside a single long rounded field. Send
          // button sits alongside the field, not inside it.
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 30,
          padding: "10px 12px calc(env(safe-area-inset-bottom, 0) + 10px)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "transparent",
          fontFamily: "var(--nex-font-body, inherit)",
        }}
      >
        {/* Single long rounded field · holds [+] [😊] [input] together.
            Accent-soft border, faint accent-tinted fill so the field
            reads as one continuous surface per cover theme. */}
        <div
          style={{
            flex: "1 1 0%",
            minWidth: 0,
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 10px 6px 8px",
            borderRadius: 24,
            background:
              "var(--nex-accent-faint, rgba(0,175,255,0.08))",
            border:
              "1px solid var(--nex-accent-soft, rgba(0,175,255,0.35))",
            backdropFilter: "blur(10px) saturate(1.05)",
            WebkitBackdropFilter: "blur(10px) saturate(1.05)",
          }}
        >
          {/* Small "+" INSIDE the field · deferred panel (placeholder
              for future shop/marketing/share). */}
          <button
            type="button"
            aria-label="More actions"
            disabled
            title="More actions coming soon"
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              border: "none",
              background: "transparent",
              color: "var(--nex-accent, #00AFFF)",
              display: "grid",
              placeItems: "center",
              cursor: "not-allowed",
              opacity: 0.85,
              flex: "0 0 auto",
              padding: 0,
            }}
          >
            <PlusIcon />
          </button>

          {/* Emoji picker toggle · INSIDE the field. */}
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

          {/* Text input · fills remaining width · NO border, NO fill
              of its own · it draws from the outer field. */}
          <input
            ref={inputRef}
            type="text"
            placeholder={placeholder}
            aria-label={placeholder}
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
        </div>

        {/* Right · gradient Send · sits alongside the field. */}
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Send"
          style={{
            flex: "0 0 auto",
            width: 42,
            height: 42,
            borderRadius: "50%",
            border: "1px solid var(--nex-accent, #00AFFF)",
            background: canSend
              ? "linear-gradient(135deg, var(--nex-accent, #00AFFF), var(--nex-accent-soft, rgba(0,175,255,0.55)))"
              : "rgba(255,255,255,0.10)",
            color: canSend ? "#03101D" : "rgba(255,255,255,0.4)",
            display: "grid",
            placeItems: "center",
            cursor: canSend ? "pointer" : "not-allowed",
            boxShadow: canSend
              ? "0 6px 16px rgba(0,0,0,0.35), 0 0 12px var(--nex-accent-glow, rgba(0,175,255,0.35))"
              : "none",
            padding: 0,
            transition: "background 120ms ease, box-shadow 120ms ease",
          }}
        >
          {sendState === "sending" ? <DotsIcon /> : <SendIcon />}
        </button>
      </form>

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
