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
// Step 2 (sealed 2026-10-06) · universal ThemePackage asset
// consumption · the intro-video overlay plays `pkg.intro.videoUrl`
// twice-then-skip for every Standard Experience world without any
// per-theme code.
import { StandardIntroOverlay } from "./_standard-intro-overlay";

export interface StandardExperienceFixturePeer {
  accountId: string;
  displayName: string;
  tagline: string;
  avatarUrl?: string | null;
  /** Universal rule · peer avatar always carries a green rim. When
   *  `isOnline` is true an outer pulsing ring (ping) animates around
   *  it. Fixture defaults to true in the preview. */
  isOnline?: boolean;
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
  // Shop slider is hidden by default on every theme · tapping the Shop
  // icon in the header slides it up from below the composer. Universal
  // rule across all themes · the Standard Experience owns this
  // behaviour so no world package has to opt in.
  const [shopOpen, setShopOpen] = React.useState(false);
  // Floating 3-dots at bottom-right · tap to reveal Call / Video /
  // Mic icons sliding in to the LEFT. Universal rule across themes.
  const [callActionsOpen, setCallActionsOpen] = React.useState(false);
  // + button in the composer footer opens a centered floating menu
  // with Contacts / Add Product / Animations. Universal rule.
  const [plusMenuOpen, setPlusMenuOpen] = React.useState(false);
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

  // Step 2 (sealed 2026-10-06) · universal consumption of
  // `pkg.wallpaperUrl`. When the ThemePackage declares a wallpaper
  // asset, the shell renders it as the background image for every
  // world · ambient effects continue to sit above it exactly as
  // before. When the package declares `null`, the existing
  // gradient-based fallback renders unchanged (preserves the sealed
  // "remove the wallpaper, does it still feel Ocean?" acceptance
  // test). Zero per-theme branches · zero id checks · the behaviour
  // is universal across every Standard Experience world.
  const packageWallpaperUrl = engine.package.wallpaperUrl ?? null;
  const backgroundStyle: React.CSSProperties = packageWallpaperUrl
    ? {
        backgroundImage: `url("${packageWallpaperUrl}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        // Underlay in the engine's deep token so a transient image
        // load failure doesn't flash to white · never a hardcoded
        // colour.
        backgroundColor: colours.deep,
      }
    : {
        background:
          wallpaperFallback === "theme-gradient"
            ? `radial-gradient(ellipse at 50% 10%, ${colours.secondary}, ${colours.deep} 65%, #000 100%)`
            : // Even with the "wallpaper off" acceptance test, we provide
              // a very dark theme-tinted base rather than pure #000. This
              // is not a wallpaper — it's the colour of water at depth,
              // emitted by the Theme Engine's deep token. The ambient
              // layer then provides all motion / light / bubbles on top.
              `linear-gradient(180deg, #000 0%, ${colours.deep} 18%, ${colours.deep} 82%, #000 100%)`,
      };

  return (
    <>
      <style>{engine.stylesheet}</style>
      {/* Step 2 · universal intro-video overlay · plays
          `pkg.intro.videoUrl` twice-then-skip for any world that
          declares one · renders null for every world without a video.
          Sealed 2026-10-06. */}
      <StandardIntroOverlay engine={engine} />
      <div
        data-nex-standard-experience
        data-theme-id={engine.package.identity.id}
        data-personality={engine.personality}
        data-nex-wallpaper-mode={packageWallpaperUrl ? "image" : "fallback"}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          overflow: "hidden",
          ...backgroundStyle,
          color: colours.highlight,
          display: "flex",
          flexDirection: "column",
          fontFamily: "inherit",
        }}
      >
        {/* Ambient layer sits above the wallpaper, below everything else. */}
        <StandardAmbientLayer engine={engine} />

        {/* Header · universal · 3 right-side action icons (Home / Cart
            / Shop). The Shop icon toggles the slide-up shop sheet
            below. Rule applies to every theme without exception. */}
        <StandardHeader
          peer={peer}
          engine={engine}
          shopOpen={shopOpen}
          onToggleShop={() => setShopOpen((v) => !v)}
        />

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

        {/* Shop sheet · UNIVERSAL RULE across every theme ·
            - CONNECTED to the bottom of the phone screen (flush with
              the bottom edge · no gap · not a floating panel).
            - Slides UP from the bottom of the screen when the Shop
              icon in the header is tapped.
            - Rounded corners ONLY on the top (left + right at top);
              bottom corners are square because the sheet is flush with
              the screen edge.
            - Full width (left: 0 · right: 0) · does NOT push chat
              bubbles up (bubbles stay anchored, sheet covers them
              from the bottom).
            Theming (background + border + shadow) inherits from engine
            colours so each world gets its own tinted sheet with zero
            world-specific branches. */}
        <div
          aria-hidden={!shopOpen}
          data-nex-se-shop-sheet={shopOpen ? "open" : "closed"}
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            // UNIVERSAL RULE sealed 2026-10-05 · the shop sheet opens
            // to EXACTLY 70% of the stage height on every theme ·
            // never more, never less · gives the chat column
            // breathing room above and keeps the sheet reachable with
            // the thumb.
            height: "70%",
            zIndex: 7,
            padding: "14px 12px calc(env(safe-area-inset-bottom, 0) + 14px)",
            borderRadius: "24px 24px 0 0",
            background: `linear-gradient(180deg, ${colours.deep}f0, ${colours.deep})`,
            borderTop: `1px solid ${colours.primary}66`,
            boxShadow: `0 -12px 32px rgba(0,0,0,0.55), 0 -2px 6px ${colours.primary}33`,
            backdropFilter: "blur(10px) saturate(1.1)",
            WebkitBackdropFilter: "blur(10px) saturate(1.1)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            transform: `translateY(${shopOpen ? "0%" : "100%"})`,
            transition:
              "transform 320ms cubic-bezier(0.2, 0.9, 0.3, 1.1)",
            pointerEvents: shopOpen ? "auto" : "none",
          }}
        >
          {/* Grab-handle · a thin top bar universal to every theme so
              the sheet reads as a draggable bottom sheet. */}
          <div
            aria-hidden
            style={{
              width: 44,
              height: 4,
              borderRadius: 999,
              background: `${colours.highlight}55`,
              margin: "0 auto 10px",
              flexShrink: 0,
            }}
          />
          {/* Shop slider · fills the remaining sheet height (70% stage
              minus the grab handle) and scrolls vertically within. */}
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <StandardShopSlider engine={engine} products={products} />
          </div>
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

        {/* Composer footer · UNIVERSAL RULE R3 revision 2 sealed
            2026-10-05 (Prototype 5 pattern) ·
            INSIDE the input pill (left → right):
              😊 emoji · │ divider · 📷 camera · 📎 attach · text input
            OUTSIDE the input, right side:
              ▶ round send button · + round plus button
            3-dots stays alone on the floating lower-right (see
            FloatingCallActions below). */}
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
          <div style={{ flex: 1, minWidth: 0 }}>
            <StandardComposer
              engine={engine}
              value={composerText}
              onChange={setComposerText}
              onSend={handleSend}
              placeholder={`Say something in ${engine.package.identity.name}…`}
              onEmojiToggle={() => setPickerOpen((v) => !v)}
              emojiToggleActive={pickerOpen}
              onCameraTap={() => {
                /* preview no-op · wired later */
              }}
              onAttachTap={() => {
                /* preview no-op · wired later */
              }}
            />
          </div>
          <ComposerSendButton
            engine={engine}
            disabled={composerText.trim().length === 0}
            onSend={handleSend}
          />
          <ComposerPlusButton
            engine={engine}
            plusOpen={plusMenuOpen}
            onTogglePlus={() => setPlusMenuOpen((v) => !v)}
          />
        </div>

        {/* UNIVERSAL RULE sealed 2026-10-05 · floating 3-dots on the
            lower-right of the stage · tap to reveal Call / Video /
            Mic icons sliding in to the left. */}
        <FloatingCallActions
          engine={engine}
          open={callActionsOpen}
          onToggle={() => setCallActionsOpen((v) => !v)}
        />

        {/* UNIVERSAL RULE · + button opens a centered floating menu
            with Contacts / Product / Animation / Settings. Backdrop
            click dismisses. zIndex 10 so it floats above every other
            overlay. The trigger lives in FloatingCallActions above. */}
        <FloatingPlusMenu
          engine={engine}
          open={plusMenuOpen}
          onClose={() => setPlusMenuOpen(false)}
        />
      </div>
    </>
  );
}

// Round send button · UNIVERSAL THEME CONTROLS RULE (sealed 2026-10-06).
// Sits OUTSIDE the input pill. Colour comes from the active
// ThemePackage's resolved primary via engine.controlsTreatment() ·
// Ocean renders ocean blue, Café renders espresso, future worlds auto-
// inherit. The sealed 2026-10-05 "SEND_GREEN everywhere" rule is
// EXPLICITLY SUPERSEDED by this rule · universal recognisability now
// comes from (a) the button's fixed outside-right position, (b) its
// solid filled treatment, and (c) its theme sendGlyph.
function ComposerSendButton({
  engine,
  disabled,
  onSend,
}: {
  engine: ResolvedEngine;
  disabled: boolean;
  onSend: () => void;
}): React.JSX.Element {
  const composer = engine.composerTreatment();
  const controls = engine.controlsTreatment();
  return (
    <button
      type="button"
      aria-label="Send message"
      data-nex-se-composer-send
      onClick={() => {
        if (!disabled) onSend();
      }}
      disabled={disabled}
      style={controls.sendButton(disabled)}
    >
      {composer.sendGlyph}
    </button>
  );
}

function PlusIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

function AttachIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21.5 11.5 12 21a5 5 0 0 1-7-7l9.5-9.5a3.5 3.5 0 0 1 5 5L10.5 18a2 2 0 0 1-3-3L16 7" />
    </svg>
  );
}

function CameraIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h3l2-2.5h8L18 8h3v12H3V8z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function StandardHeader({
  peer,
  engine,
  shopOpen,
  onToggleShop,
}: {
  peer: StandardExperienceFixturePeer;
  engine: ResolvedEngine;
  shopOpen: boolean;
  onToggleShop: () => void;
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
      <PeerAvatarWithPresence peer={peer} engine={engine} />
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
      <StandardHeaderActions
        engine={engine}
        shopOpen={shopOpen}
        onToggleShop={onToggleShop}
      />
    </div>
  );
}

// Three circular action buttons docked on the right of the header ·
// universal across every world · theming inherits from the engine so
// Ocean renders teal-rimmed buttons, Midnight renders magenta-rimmed
// buttons, French renders rose-wood-rimmed buttons, etc. No world-
// specific branches.
//
// RULE · every theme design MUST render all three icons (Home, Cart,
// Shop). The Shop icon toggles the slide-up shop sheet below the
// composer · universal behaviour · not per-theme-customisable.
function StandardHeaderActions({
  engine,
  shopOpen,
  onToggleShop,
}: {
  engine: ResolvedEngine;
  shopOpen: boolean;
  onToggleShop: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · header R1
  // buttons draw from engine.controlsTreatment() so they stay solid
  // and visible on every wallpaper regardless of world.
  const controls = engine.controlsTreatment();
  const baseBtn = controls.headerButton;
  const shopActiveBtn = controls.headerButtonActive;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        aria-label="Home"
        data-nex-se-header-action="home"
        style={baseBtn}
      >
        <HomeIcon />
      </button>
      <button
        type="button"
        aria-label="Cart"
        data-nex-se-header-action="cart"
        style={baseBtn}
      >
        <CartIcon />
      </button>
      <button
        type="button"
        aria-label={shopOpen ? "Close shop" : "Open shop"}
        aria-pressed={shopOpen}
        data-nex-se-header-action="shop"
        data-nex-se-shop-toggle={shopOpen ? "open" : "closed"}
        onClick={onToggleShop}
        style={shopOpen ? shopActiveBtn : baseBtn}
      >
        <ShopIcon />
      </button>
    </div>
  );
}

// Peer avatar · UNIVERSAL RULE across every theme ·
//   - Green rim ALWAYS (not theme-tinted · green is the universal
//     presence colour).
//   - When isOnline === true, a pulsing outer ring (ping) animates
//     outward infinitely so you can see the person is live.
// Fixture defaults isOnline → true in the preview.
const ONLINE_GREEN = "#22C55E";
const ONLINE_PING_KEYFRAMES = `
@keyframes nex-se-online-ping {
  0%   { transform: scale(1);   opacity: 0.75; }
  100% { transform: scale(1.9); opacity: 0;    }
}
`;

function PeerAvatarWithPresence({
  peer,
  engine,
}: {
  peer: StandardExperienceFixturePeer;
  engine: ResolvedEngine;
}): React.JSX.Element {
  const colours = engine.colours;
  const isOnline = peer.isOnline !== false;
  // R12 entry point 2 (sealed 2026-10-05) · tapping the peer avatar
  // opens their status viewer. In production this will route to the
  // viewer scoped to this peer; in preview it opens the dev viewer
  // tinted to the current engine's theme.
  const viewerHref = `/nex-native/dev/status-viewer-v1?theme=${encodeURIComponent(engine.package.identity.id)}`;
  return (
    <a
      href={viewerHref}
      aria-label={`Open ${peer.displayName}'s status`}
      data-nex-se-peer-avatar
      style={{
        position: "relative",
        width: 36,
        height: 36,
        flexShrink: 0,
        display: "block",
        textDecoration: "none",
      }}
    >
      <style>{ONLINE_PING_KEYFRAMES}</style>
      {isOnline && (
        <span
          aria-hidden
          data-nex-se-online-ping
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            border: `2px solid ${ONLINE_GREEN}`,
            animation: "nex-se-online-ping 1.8s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}
      <div
        aria-hidden
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          background: peer.avatarUrl
            ? `center/cover url(${peer.avatarUrl})`
            : `linear-gradient(135deg, ${colours.primary}, ${colours.secondary})`,
          border: `2px solid ${ONLINE_GREEN}`,
          boxShadow: isOnline ? `0 0 0 1px rgba(34,197,94,0.3)` : undefined,
        }}
      />
    </a>
  );
}

// Centered floating menu triggered by the composer-footer "+" button ·
// UNIVERSAL RULE across every theme. Contents (per founder-direction
// 2026-10-05):
//   - Contacts  → add a contact to the chat
//   - Product   → add / edit / delete / turn-off product
//   - Animation → open the full theme animation gallery
// Backdrop click dismisses. Theming inherits from the engine so each
// world's menu reads as part of its visual identity.
function FloatingPlusMenu({
  engine,
  open,
  onClose,
}: {
  engine: ResolvedEngine;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const c = engine.colours;
  const option: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
    padding: "12px 8px",
    width: "100%",
    minWidth: 0,
    borderRadius: 16,
    border: `1px solid ${c.primary}66`,
    background: `${c.primary}1a`,
    color: c.highlight,
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
    background: `linear-gradient(135deg, ${c.primary}, ${c.secondary})`,
    color: c.highlight,
    boxShadow: `0 4px 12px ${c.primary}55`,
  };
  return (
    <div
      aria-hidden={!open}
      data-nex-se-plus-menu={open ? "open" : "closed"}
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
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
          background: `linear-gradient(180deg, ${c.deep}e6, ${c.deep}f5)`,
          border: `1px solid ${c.primary}99`,
          boxShadow: `0 20px 50px rgba(0,0,0,0.55), 0 0 0 1px ${c.primary}22`,
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
            color: c.highlight,
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
          <a
            href="/nex-native/friends"
            data-nex-se-plus-action="contacts"
            aria-label="Add contact to chat"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <ContactsIcon />
            </span>
            <span>Contacts</span>
          </a>
          <a
            href="/nex-native/manage/products"
            data-nex-se-plus-action="product"
            aria-label="Add, edit, delete or turn off a product"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <ProductIcon />
            </span>
            <span>Product</span>
          </a>
          <a
            href={`/nex-native/themes/${engine.package.identity.id}/motion`}
            data-nex-se-plus-action="animation"
            aria-label="Open all theme animations"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <AnimationIcon />
            </span>
            <span>Animation</span>
          </a>
          <a
            href="/nex-native/settings"
            data-nex-se-plus-action="settings"
            aria-label="Open settings page"
            style={{ ...option, textDecoration: "none" }}
          >
            <span aria-hidden style={iconCircle}>
              <SettingsIcon />
            </span>
            <span>Settings</span>
          </a>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            alignSelf: "center",
            marginTop: 2,
            padding: "6px 14px",
            borderRadius: 999,
            border: `1px solid ${c.highlight}33`,
            background: "transparent",
            color: c.highlight,
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

function ContactsIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="8" r="3.5" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="7" r="2.5" />
      <path d="M15 14c3 0 6 1.5 6 5" />
    </svg>
  );
}

function ProductIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 7.5 12 3l9 4.5v9L12 21 3 16.5v-9z" />
      <path d="M3 7.5 12 12l9-4.5" />
      <path d="M12 12v9" />
    </svg>
  );
}

function AnimationIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 2 l1.6 4.4 L18 8l-4.4 1.6L12 14l-1.6-4.4L6 8l4.4-1.6z" />
      <path d="M18 15l0.8 2.2L21 18l-2.2 0.8L18 21l-0.8-2.2L15 18l2.2-0.8z" />
      <path d="M6 15l0.6 1.8L8 17.4l-1.4 0.6L6 19.8l-0.6-1.8L4 17.4l1.4-0.6z" />
    </svg>
  );
}

function SettingsIcon(): React.JSX.Element {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .4 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.4 1.6 1.6 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .4-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.4-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.4H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.4l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.4 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" />
    </svg>
  );
}

// Floating lower-right 3-dots · UNIVERSAL RULE sealed 2026-10-05 ·
// tap to reveal Call / Video Call / Mic icons sliding in from the
// right. The + button now lives at the right of the composer footer
// (see ComposerPlusButton below) · it is NOT stacked here.
function FloatingCallActions({
  engine,
  open,
  onToggle,
}: {
  engine: ResolvedEngine;
  open: boolean;
  onToggle: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · lower-right
  // 3-dots stack uses the same solid-themed treatment as the header
  // R1 buttons so the chrome is visually coherent across every
  // world. 40×40 instead of 32×32 so the floating group has enough
  // tap-target weight without changing size.
  const controls = engine.controlsTreatment();
  const c = controls.colors;
  const circle: React.CSSProperties = {
    ...controls.headerButton,
    width: 40,
    height: 40,
    boxShadow: `0 6px 16px ${c.deep}66, 0 0 0 1px ${c.primary}55`,
  };
  // Three action buttons slide in from the right (toward the left of
  // the 3-dots trigger).
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
  return (
    <div
      data-nex-se-call-actions={open ? "open" : "closed"}
      style={{
        position: "absolute",
        right: 14,
        bottom: "calc(env(safe-area-inset-bottom, 0) + 72px)",
        zIndex: 9,
        display: "flex",
        flexDirection: "row",
        gap: 8,
        alignItems: "center",
      }}
    >
      <div style={actionWrap}>
        <a
          href="/nex-native/dev/status-viewer-v1"
          aria-label="Open status"
          data-nex-se-call-action="status"
          style={{ ...circle, textDecoration: "none" }}
        >
          <StatusIcon />
        </a>
        <button
          type="button"
          aria-label="Mic"
          data-nex-se-call-action="mic"
          style={circle}
        >
          <MicIcon />
        </button>
        <button
          type="button"
          aria-label="Video call"
          data-nex-se-call-action="video"
          style={circle}
        >
          <VideoCallIcon />
        </button>
        <button
          type="button"
          aria-label="Call"
          data-nex-se-call-action="call"
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
        data-nex-se-call-actions-toggle={open ? "open" : "closed"}
        style={{
          ...circle,
          // Open state uses the universal solid-primary active
          // treatment with auto-contrast icon colour · sealed
          // 2026-10-06 · the icon colour comes from headerButtonActive
          // so a very light primary gets dark glyph automatically.
          background: open ? controls.headerButtonActive.background : circle.background,
          color: open ? controls.headerButtonActive.color : circle.color,
          border: open ? controls.headerButtonActive.border : circle.border,
          transition: "background 180ms ease-out, border 180ms ease-out, color 180ms ease-out",
        }}
      >
        <DotsVerticalIcon />
      </button>
    </div>
  );
}

// Composer-footer + button · sealed 2026-10-05 revision · sits on the
// right side of the footer, outside the input, next to the send glyph.
// Opens the centered + menu with the four sealed actions.
function ComposerPlusButton({
  engine,
  plusOpen,
  onTogglePlus,
}: {
  engine: ResolvedEngine;
  plusOpen: boolean;
  onTogglePlus: () => void;
}): React.JSX.Element {
  // Universal Theme Controls Rule · sealed 2026-10-06 · the + button
  // is a UNIVERSAL NEX semantic (near-black background on every
  // world · theme accent border/glow for integration). Same
  // philosophy as the universal gold NEW badge: "add to this chat"
  // must be instantly recognisable regardless of host theme.
  const controls = engine.controlsTreatment();
  return (
    <button
      type="button"
      aria-label={plusOpen ? "Close menu" : "Add to this chat"}
      aria-pressed={plusOpen}
      onClick={onTogglePlus}
      data-nex-se-composer-action="plus"
      data-nex-se-plus-toggle={plusOpen ? "open" : "closed"}
      style={plusOpen ? controls.plusButtonActive : controls.plusButton}
    >
      <PlusIcon />
    </button>
  );
}

function DotsVerticalIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="12" cy="5" r="1.9" />
      <circle cx="12" cy="12" r="1.9" />
      <circle cx="12" cy="19" r="1.9" />
    </svg>
  );
}

function CallIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6A2 2 0 0 1 22 16.9z" />
    </svg>
  );
}

// R7 extension sealed 2026-10-05 (R12 entry point 1) · Status icon ·
// opens the full-screen status viewer at /nex-native/dev/status-viewer-v1
// · in production this will dispatch to the viewer with the current
// chat's peer status feed.
function StatusIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" strokeDasharray="4 2.5" />
      <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function VideoCallIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="6" width="13" height="12" rx="2" />
      <path d="M22 7.5 15.5 12 22 16.5v-9z" />
    </svg>
  );
}

function MicIcon(): React.JSX.Element {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="3" width="6" height="12" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

function HomeIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </svg>
  );
}

function CartIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
      <path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6" />
    </svg>
  );
}

function ShopIcon(): React.JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8l1.5-4h15L21 8" />
      <path d="M3 8v2a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0V8" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}
