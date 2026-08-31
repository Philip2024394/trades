// src/components/nexapp/ChatBubbleTranslated.tsx
//
// Stage 3.32 · Phase 25 · Chat bubble UI with translate-toggle icon
// (Philip 2026-08-31).
//
// Per the Aug-31 spec: when an Indonesian user chats with an English
// user (or vice versa), each side sees the message in their OWN
// language automatically. A small icon sits in the top-right of every
// bubble that was translated. Tapping it swaps to the original text
// as sent; tapping again returns to the translated view.
//
// Per-bubble state · no global toggle · matches the spec exactly.
//
// Doctrine:
//   · Translation source is `translateChatMessage` (NEX Brain
//     deterministic phrase pack) per Philip's earlier choice.
//   · When `translated=false` (pack couldn't translate), the toggle
//     icon is NOT rendered — there's nothing to swap to. The message
//     shows verbatim and the caller can surface a caveat elsewhere.
//   · Numbers, business names, URLs preserved verbatim by the
//     translator itself.

"use client";

import React, { useMemo, useState } from "react";
import { translateChatMessage, type Lang } from "@/lib/nex/brain/chat-translate";

export type ChatBubbleTranslatedProps = {
  /** Message text as sent by the author. */
  text: string;
  /** Language the author sent the message in. */
  sentLang: Lang;
  /** Language the current viewer reads in. */
  viewerLang: Lang;
  /** Speaker role · affects colour (self=orange · other=grey). */
  role?: "self" | "other";
  /** Author display name (for accessibility only · not rendered). */
  authorName?: string;
  /** Optional timestamp shown below the bubble. */
  timestamp?: string;
};

export function ChatBubbleTranslated({
  text,
  sentLang,
  viewerLang,
  role = "other",
  authorName,
  timestamp,
}: ChatBubbleTranslatedProps): React.ReactElement {
  // Compute translation once per (text, sentLang, viewerLang) triple.
  const translation = useMemo(
    () => translateChatMessage({ text, from: sentLang, to: viewerLang }),
    [text, sentLang, viewerLang],
  );

  // `showingOriginal` starts false — the viewer sees the translated
  // form by default (that's the whole point of auto-translate). Tap
  // the icon → true (show original) → tap again → false.
  const [showingOriginal, setShowingOriginal] = useState(false);

  const isTranslated = translation.translated;
  const displayText = showingOriginal ? text : translation.text;

  // Colour: self = orange · other = neutral grey. Match the existing
  // nex-app palette (see nex-sign-on for orange #f97316).
  const bgColor = role === "self" ? "#f97316" : "#f3f4f6";
  const fgColor = role === "self" ? "#ffffff" : "#0a0e18";
  const borderRadius = role === "self"
    ? "18px 18px 4px 18px"
    : "18px 18px 18px 4px";

  return (
    <div
      role="group"
      aria-label={authorName ? `Message from ${authorName}` : "Chat message"}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: role === "self" ? "flex-end" : "flex-start",
        gap: 4,
        maxWidth: "80%",
        alignSelf: role === "self" ? "flex-end" : "flex-start",
      }}
    >
      <div
        style={{
          position: "relative",
          padding: "10px 14px",
          paddingRight: isTranslated ? 34 : 14,
          background: bgColor,
          color: fgColor,
          borderRadius,
          fontSize: 15,
          lineHeight: 1.4,
          wordBreak: "break-word",
          boxShadow: role === "self"
            ? "0 2px 6px rgba(249,115,22,0.25)"
            : "0 1px 3px rgba(0,0,0,0.06)",
        }}
      >
        <span>{displayText}</span>

        {isTranslated && (
          <button
            type="button"
            onClick={() => setShowingOriginal((v) => !v)}
            aria-pressed={showingOriginal}
            aria-label={
              showingOriginal
                ? "Show translated text"
                : "Show original text"
            }
            title={
              showingOriginal
                ? "Show translated text"
                : "Show original text"
            }
            style={{
              position: "absolute",
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              padding: 0,
              display: "grid",
              placeItems: "center",
              border: "none",
              borderRadius: 6,
              background: role === "self"
                ? "rgba(255,255,255,0.22)"
                : "rgba(10,14,24,0.06)",
              color: role === "self" ? "#ffffff" : "#4b5563",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              lineHeight: 1,
              opacity: showingOriginal ? 1 : 0.85,
              transition: "opacity 120ms ease, background 120ms ease",
            }}
          >
            {/* Small globe/translate glyph. When showing original,
                the glyph inverts colour so state is unambiguous. */}
            <TranslateGlyph active={showingOriginal} />
          </button>
        )}
      </div>

      {/* Sub-line: shows "translated" caveat + optional timestamp */}
      {(isTranslated || timestamp) && (
        <div
          style={{
            display: "flex",
            gap: 6,
            fontSize: 11,
            color: "#9ca3af",
            padding: role === "self" ? "0 4px 0 0" : "0 0 0 4px",
            alignItems: "center",
          }}
        >
          {isTranslated && (
            <span>
              {showingOriginal ? "Original" : "Translated"}
            </span>
          )}
          {isTranslated && timestamp && <span aria-hidden="true">·</span>}
          {timestamp && <time>{timestamp}</time>}
        </div>
      )}
    </div>
  );
}

// Minimal translate glyph · two overlapping brackets suggest cross-lang.
function TranslateGlyph({ active }: { active: boolean }): React.ReactElement {
  return (
    <svg
      viewBox="0 0 16 16"
      width="12"
      height="12"
      aria-hidden="true"
      style={{ display: "block" }}
    >
      <path
        d={active
          // Active (showing original): filled globe glyph
          ? "M8 1a7 7 0 100 14A7 7 0 008 1zm0 2c1.1 0 2.3 1.6 2.7 4H5.3C5.7 4.6 6.9 3 8 3zm-4.6 4h1.7c0 .7-.1 1.3-.1 2H3.1a5 5 0 01.3-2zm2.7 0h3.8c.1.7.1 1.3 0 2H6.1c-.1-.7-.1-1.3 0-2zm4.8 0h1.7a5 5 0 01.3 2H11c.1-.7.1-1.3 0-2zM8 13c-1.1 0-2.3-1.6-2.7-4h5.4c-.4 2.4-1.6 4-2.7 4z"
          // Inactive (showing translated): outlined globe
          : "M8 1a7 7 0 100 14A7 7 0 008 1zm0 1.4a5.6 5.6 0 110 11.2A5.6 5.6 0 018 2.4zM5 7h6M5 9h6M8 3v10"}
        fill={active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth={active ? 0 : 1.1}
        strokeLinecap="round"
      />
    </svg>
  );
}
