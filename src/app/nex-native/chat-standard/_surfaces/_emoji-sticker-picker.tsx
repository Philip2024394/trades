"use client";

// src/app/nex-native/chat-standard/_surfaces/_emoji-sticker-picker.tsx
//
// Phase 2A.0 · Standard emoji + sticker picker surface.
//
// Two tabs: Emoji + Stickers. Both read their visual treatment from
// the engine. Stickers are rendered by the engine's SVG generator
// unless the theme supplies explicit URLs.
//
// Universal functionality: pick an emoji → onPickEmoji(glyph);
// pick a sticker → onPickSticker(slug). Caller decides what sending
// means.

import * as React from "react";
import type { ResolvedEngine } from "../_engine/theme-engine";

const BASE_EMOJI = [
  "😀",
  "😂",
  "🥹",
  "😍",
  "🤯",
  "😎",
  "🤔",
  "👍",
  "❤️",
  "🫧",
  "🌊",
  "🐚",
  "🐟",
  "✨",
  "🙌",
  "🔥",
];

export interface StandardEmojiStickerPickerProps {
  engine: ResolvedEngine;
  onPickEmoji: (glyph: string) => void;
  onPickSticker: (slug: string) => void;
}

export function StandardEmojiStickerPicker({
  engine,
  onPickEmoji,
  onPickSticker,
}: StandardEmojiStickerPickerProps): React.JSX.Element {
  const [tab, setTab] = React.useState<"emoji" | "stickers">("emoji");
  const emoji = engine.emojiTreatment();
  const stickers = engine.stickerTreatment();
  const colours = engine.colours;

  return (
    <div
      data-nex-se-emoji-sticker-picker
      style={{
        padding: 10,
        borderRadius: 14,
        background: `rgba(2,9,20,0.72)`,
        border: `1px solid ${colours.primary}66`,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        <TabButton
          label="Emoji"
          active={tab === "emoji"}
          accent={colours.primary}
          onClick={() => setTab("emoji")}
        />
        <TabButton
          label="Stickers"
          active={tab === "stickers"}
          accent={colours.primary}
          onClick={() => setTab("stickers")}
        />
      </div>
      {tab === "emoji" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(auto-fill, minmax(${emoji.tileSize + 8}px, 1fr))`,
            gap: 6,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {BASE_EMOJI.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onPickEmoji(g)}
              aria-label={`Pick ${g}`}
              style={{
                ...emoji.tileStyle,
                background: emoji.tileStyle.background,
                border: emoji.tileStyle.border,
                boxShadow: emoji.tileStyle.boxShadow,
                borderRadius: emoji.tileStyle.borderRadius,
                cursor: "pointer",
                fontSize: Math.round(emoji.tileSize * 0.55),
                padding: 0,
                color: colours.highlight,
                filter: emoji.colorFilter ?? undefined,
                animation: emoji.pickAnimation
                  ? `${emoji.pickAnimation} 240ms ease-out`
                  : undefined,
              }}
            >
              {g}
            </button>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 8,
            maxHeight: 180,
            overflowY: "auto",
          }}
        >
          {stickers.slugs.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => onPickSticker(slug)}
              aria-label={`Send ${slug} sticker`}
              style={{
                padding: 6,
                background: "rgba(255,255,255,0.03)",
                border: `1px solid ${colours.primary}22`,
                borderRadius: 10,
                cursor: "pointer",
                display: "grid",
                placeItems: "center",
              }}
            >
              {stickers.render(slug, 56)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  accent,
  onClick,
}: {
  label: string;
  active: boolean;
  accent: string;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        background: active ? `${accent}33` : "transparent",
        border: `1px solid ${active ? accent : "rgba(255,255,255,0.1)"}`,
        color: active ? "#fff" : "rgba(255,255,255,0.6)",
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}
