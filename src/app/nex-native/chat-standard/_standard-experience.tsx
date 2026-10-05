"use client";

// src/app/nex-native/chat-standard/_standard-experience.tsx
//
// Phase 2A.0 · Standard NEX Experience · composition.
//
// Mounts the five founder-chosen surfaces (bubbles, composer,
// emoji+stickers, ambient animation, shop+product cards) with the
// supplied Theme Engine. All features are universal. Only the engine
// changes between themes.
//
// Explicit non-goals in 2A.0:
//   · reactions / buttons / navigation / loading / empty states ·
//     notifications / micro-interactions · calls · video calls
//   · live chat / real session / real WebRTC
//
// Those arrive in 2A.1+ once the first five surfaces are reviewed and
// the engine is stress-tested on Ocean.

import * as React from "react";
import type { ResolvedEngine } from "./_engine/theme-engine";
import { StandardAmbientLayer } from "./_surfaces/_ambient-layer";
import { StandardBubble } from "./_surfaces/_bubble";
import { StandardComposer } from "./_surfaces/_composer";
import { StandardEmojiStickerPicker } from "./_surfaces/_emoji-sticker-picker";
import {
  StandardShopSlider,
  type StandardShopProduct,
} from "./_surfaces/_shop-slider";

export interface StandardExperienceFixturePeer {
  accountId: string;
  displayName: string;
  tagline: string;
  avatarUrl?: string | null;
}

export interface StandardExperienceSeedMessage {
  id: string;
  mine: boolean;
  body: string;
}

export interface StandardExperienceProps {
  engine: ResolvedEngine;
  peer: StandardExperienceFixturePeer;
  seedMessages: StandardExperienceSeedMessage[];
  products: StandardShopProduct[];
  /** Preview-mode composer: appends locally to a fixture message list.
   *  Live-mode would wire a server action here. */
  onSendLocalMessage: (body: string) => void;
  localMessages: StandardExperienceSeedMessage[];
  /** Overlay a procedurally-generated wallpaper if the theme package
   *  has no asset. The acceptance test says Ocean must feel Ocean
   *  WITHOUT the wallpaper, so this is deliberately low-weight. */
  wallpaperFallback?: "theme-gradient" | "none";
}

export function StandardExperience({
  engine,
  peer,
  seedMessages,
  products,
  onSendLocalMessage,
  localMessages,
  wallpaperFallback = "theme-gradient",
}: StandardExperienceProps): React.JSX.Element {
  const [composerText, setComposerText] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [lastReactId, setLastReactId] = React.useState<string | null>(null);
  const colours = engine.colours;

  const handleSend = React.useCallback(() => {
    const trimmed = composerText.trim();
    if (!trimmed) return;
    onSendLocalMessage(trimmed);
    setComposerText("");
  }, [composerText, onSendLocalMessage]);

  const handleEmojiPick = React.useCallback(
    (g: string) => {
      setComposerText((v) => v + g);
    },
    [],
  );

  const handleStickerPick = React.useCallback(
    (slug: string) => {
      onSendLocalMessage(`[sticker:${slug}]`);
      setPickerOpen(false);
    },
    [onSendLocalMessage],
  );

  const stickers = engine.stickerTreatment();

  const allMessages = React.useMemo(
    () => [...seedMessages, ...localMessages],
    [seedMessages, localMessages],
  );

  // Trigger a reaction animation when the newest peer message arrives.
  React.useEffect(() => {
    const last = allMessages[allMessages.length - 1];
    if (last && !last.mine) {
      setLastReactId(last.id);
      const id = window.setTimeout(() => setLastReactId(null), 1000);
      return () => window.clearTimeout(id);
    }
  }, [allMessages]);

  return (
    <>
      <style>{engine.stylesheet}</style>
      <div
        data-nex-standard-experience
        data-theme-id={engine.package.identity.id}
        data-personality={engine.personality}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          background:
            wallpaperFallback === "theme-gradient"
              ? `radial-gradient(ellipse at 50% 10%, ${colours.secondary}, ${colours.deep} 65%, #000 100%)`
              : // Even with the "wallpaper off" acceptance test, we provide
                // a very dark theme-tinted base rather than pure #000. This
                // is not a wallpaper — it's the colour of water at depth,
                // emitted by the Theme Engine's deep token. The ambient
                // layer then provides all motion / light / bubbles on top.
                `linear-gradient(180deg, #000 0%, ${colours.deep} 18%, ${colours.deep} 82%, #000 100%)`,
          color: colours.highlight,
          display: "flex",
          flexDirection: "column",
          fontFamily: "inherit",
        }}
      >
        {/* Ambient layer sits above the wallpaper, below everything else. */}
        <StandardAmbientLayer engine={engine} />

        {/* Header · minimal in 2A.0, just so the fixture reads as a chat */}
        <StandardHeader peer={peer} engine={engine} />

        {/* Shop slider · appears above messages in a slim strip */}
        <div style={{ position: "relative", zIndex: 5, padding: "6px 10px" }}>
          <StandardShopSlider engine={engine} products={products} />
        </div>

        {/* Messages */}
        <div
          style={{
            position: "relative",
            zIndex: 5,
            flex: 1,
            overflowY: "auto",
            padding: "10px 14px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            justifyContent: "flex-end",
          }}
        >
          {allMessages.map((m) => {
            if (m.body.startsWith("[sticker:")) {
              const slug = m.body.slice(9, -1);
              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: m.mine ? "flex-end" : "flex-start",
                    maxWidth: "40%",
                  }}
                >
                  {stickers.render(slug, 96)}
                </div>
              );
            }
            return (
              <StandardBubble
                key={m.id}
                engine={engine}
                mine={m.mine}
                reacting={lastReactId === m.id}
                idle={true}
              >
                {m.body}
              </StandardBubble>
            );
          })}
        </div>

        {/* Emoji + Sticker picker (overlay above composer when open) */}
        {pickerOpen && (
          <div
            style={{
              position: "relative",
              zIndex: 6,
              padding: "0 10px 8px",
            }}
          >
            <StandardEmojiStickerPicker
              engine={engine}
              onPickEmoji={handleEmojiPick}
              onPickSticker={handleStickerPick}
            />
          </div>
        )}

        {/* Composer + picker toggle */}
        <div
          style={{
            position: "relative",
            zIndex: 6,
            padding:
              "8px 10px calc(env(safe-area-inset-bottom, 0) + 10px)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <button
            type="button"
            aria-label={pickerOpen ? "Close picker" : "Open emoji + sticker picker"}
            onClick={() => setPickerOpen((v) => !v)}
            data-nex-se-picker-toggle={pickerOpen ? "open" : "closed"}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              background: pickerOpen
                ? `${colours.primary}aa`
                : `${colours.primary}22`,
              border: `1px solid ${colours.primary}66`,
              color: colours.highlight,
              cursor: "pointer",
              fontSize: 16,
            }}
          >
            {pickerOpen ? "×" : "😊"}
          </button>
          <div style={{ flex: 1 }}>
            <StandardComposer
              engine={engine}
              value={composerText}
              onChange={setComposerText}
              onSend={handleSend}
              placeholder={`Say something in ${engine.package.identity.name}…`}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function StandardHeader({
  peer,
  engine,
}: {
  peer: StandardExperienceFixturePeer;
  engine: ResolvedEngine;
}): React.JSX.Element {
  const colours = engine.colours;
  return (
    <div
      style={{
        position: "relative",
        zIndex: 5,
        padding:
          "calc(env(safe-area-inset-top, 0) + 10px) 14px 8px",
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: peer.avatarUrl
            ? `center/cover url(${peer.avatarUrl})`
            : `linear-gradient(135deg, ${colours.primary}, ${colours.secondary})`,
          border: `1px solid ${colours.highlight}55`,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            textShadow: "0 1px 4px rgba(0,0,0,0.6)",
          }}
        >
          {peer.displayName}
        </div>
        <div
          style={{
            fontSize: 11,
            color: "rgba(255,255,255,0.7)",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          {peer.tagline}
        </div>
      </div>
    </div>
  );
}
