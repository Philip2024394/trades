"use client";

// Phase 2 · Immersive Preview Shell. Feature-flag gated by
// NEX_THEMES_IMMERSIVE_PREVIEW. Replaces the PreviewModal when the flag
// is on; the legacy modal stays mounted when the flag is off so a
// single kill-switch flip restores the old behaviour byte-for-byte.
//
// Mobile (≤ 900 px viewport):
//   · position: fixed; inset: 0 · edge-to-edge
//   · 56 px top strip (back / name + tier chip / overflow)
//   · ThemeWorld + bubbles + composer fill between
//   · 72 px bottom action bar (Use / Upgrade / Active CTA)
//   · NO inner phone silhouette (hard requirement from the audit)
//
// Desktop (≥ 901 px viewport):
//   · blurred backdrop
//   · ONE centred 390 × 820 phone silhouette with notch bar
//   · 320 px right rail · name, tagline, tier chip, accent swatch, CTA,
//     "Open full screen →" link to the sealed page where applicable
//
// Shared behaviour:
//   · Esc closes · Arrow Left/Right swap theme · swipe prev/next
//   · ?preview=<id> URL state · back-button closes · deep link works
//   · Local test conversation (max 3 messages, cleared on theme switch
//     and on close)
//   · Intro video plays once with onLoadedMetadata seek-to-0 + opacity
//     gate (same pattern as the shipped intro-video fix); Replay chip
//     once video has ended
//   · prefers-reduced-motion collapses the swipe cross-fade to a snap
//   · Uses Phase 0 <ThemeWorld size="preview"> + <ThemeBubble> · no
//     second rendering system
//   · All business logic (activation, locked state, FREE/trial, active
//     chip) comes from the same props the legacy modal already received

import * as React from "react";
import {
  ThemeWorld,
  ThemeBubble,
  type BubblePreset,
} from "@/lib/nex-native/chat-render/theme-world";
import type { BrowserThemeRow } from "./_theme-browser-client";
import {
  appendLocalMessage,
  buildPreviewUrl,
  canSendLocalMessage,
  evaluateSwipe,
  LOCAL_MESSAGE_LIMIT,
  navigateIndex,
  type LocalMessage,
} from "./_preview-shell-logic";

const NEX = {
  bg: "#020914",
  bgSoft: "rgba(2,9,20,0.75)",
  cyan: "#00AFFF",
  cyanBorder: "rgba(0,175,255,0.35)",
  orange: "#FF7800",
  green: "#16D66B",
  text: "#F4F7FC",
  textDim: "#8BA9D1",
  textMute: "#526B89",
};

export interface ImmersivePreviewShellProps {
  theme: BrowserThemeRow;
  active: boolean;
  locked: boolean;
  canUsePremium: boolean;
  activateAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  prevLabel: string | null;
  nextLabel: string | null;
  /** Sealed-page URL for themes that ship a bespoke experience
   *  (pink-dream / theme-1 / cyber-grid / theme-0). When present, the
   *  footer surfaces an "Open full screen →" link in addition to the
   *  activation CTA. */
  openFullScreenHref: string | null;
}

type SwipeState = {
  startX: number;
  currentX: number;
  startTime: number;
};

export function ImmersivePreviewShell(
  props: ImmersivePreviewShellProps,
): React.JSX.Element {
  const {
    theme,
    active,
    locked,
    canUsePremium,
    activateAction,
    onClose,
    onPrev,
    onNext,
    openFullScreenHref,
  } = props;

  const [localMessages, setLocalMessages] = React.useState<LocalMessage[]>([]);
  const [composerText, setComposerText] = React.useState("");
  const [swipe, setSwipe] = React.useState<SwipeState | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  // URL state sync · the shell owns pushState/popstate for ?preview=<id>.
  // On popstate (back button) → onClose. On theme switch → replaceState.
  // On unmount → strip the preview param.
  usePreviewUrl(theme.id, onClose);

  // Detect reduced-motion once · we respect user preference for the
  // swipe cross-fade and theme switch transition.
  React.useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);

  // Clear local test messages whenever the theme changes OR the preview
  // closes · the brief requires both.
  React.useEffect(() => {
    setLocalMessages([]);
    setComposerText("");
  }, [theme.id]);

  // Keyboard shortcuts · Esc closes, Arrow keys navigate.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowLeft" && onPrev) {
        onPrev();
      } else if (e.key === "ArrowRight" && onNext) {
        onNext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  // Lock body scroll while the preview is open · identical semantics to
  // the legacy modal, so flipping the flag never changes scroll feel.
  React.useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Swipe handlers · pointer events so this works for touch, pen, mouse.
  const onPointerDown = React.useCallback((e: React.PointerEvent) => {
    setSwipe({
      startX: e.clientX,
      currentX: e.clientX,
      startTime: Date.now(),
    });
  }, []);

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (!swipe) return;
      setSwipe((s) => (s ? { ...s, currentX: e.clientX } : s));
    },
    [swipe],
  );

  const commitSwipe = React.useCallback(() => {
    if (!swipe) return;
    const delta = swipe.currentX - swipe.startX;
    const elapsed = Date.now() - swipe.startTime;
    const decision = evaluateSwipe(delta, elapsed);
    setSwipe(null);
    if (decision.direction === "prev" && onPrev) onPrev();
    else if (decision.direction === "next" && onNext) onNext();
  }, [swipe, onPrev, onNext]);

  const dragDelta = swipe ? swipe.currentX - swipe.startX : 0;

  // Composer send · appends to local messages up to the limit, clears
  // the input, cannot send empty.
  const handleSend = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setLocalMessages((m) => appendLocalMessage(m, composerText));
      setComposerText("");
    },
    [composerText],
  );

  const bubblePreset: BubblePreset =
    theme.wallpaper_config?.bubbleStyle?.preset ?? "classic";
  const bubbleRim = theme.bubble_rim_hex ?? theme.accent_hex;
  const accentGlassMine = "rgba(0,159,239,0.26)";
  const accentGlassPeer = "rgba(30,44,66,0.72)";

  return (
    <>
      <style>{`
        @keyframes nex-immersive-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        [data-nex-immersive-preview] {
          position: fixed;
          inset: 0;
          z-index: 950;
          background: ${NEX.bg};
          color: ${NEX.text};
          display: flex;
          flex-direction: column;
          animation: nex-immersive-fade-in 160ms ease-out both;
          font-family: inherit;
        }
        /* Mobile default · edge-to-edge, no inner phone frame. Rail +
         * notch hidden here so the mobile layout cannot accidentally
         * show desktop chrome. */
        [data-nex-immersive-preview] [data-nex-preview-phone] {
          flex: 1 1 auto;
          position: relative;
          overflow: hidden;
        }
        [data-nex-immersive-preview] [data-nex-preview-rail] {
          display: none !important;
        }
        [data-nex-immersive-preview] [data-nex-preview-phone-notch] {
          display: none !important;
        }
        /* Desktop layout · blurred backdrop + centred phone + info rail.
         * !important on display is deliberate · the InfoRail component
         * sets an inline display:none fallback so the rail cannot leak
         * into the mobile layout when CSS is still loading, and we need
         * the media query to beat inline on the desktop breakpoint. */
        @media (min-width: 901px) {
          [data-nex-immersive-preview] {
            background: ${NEX.bgSoft};
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            display: grid;
            grid-template-columns: 1fr auto 320px 1fr;
            grid-template-rows: 1fr;
            align-items: center;
            justify-items: center;
            padding: 40px 32px;
            gap: 32px;
          }
          [data-nex-immersive-preview] [data-nex-preview-phone] {
            width: 390px;
            height: 820px;
            max-height: calc(100vh - 80px);
            flex: 0 0 auto;
            border-radius: 44px;
            border: 1px solid ${NEX.cyanBorder};
            box-shadow: 0 24px 60px rgba(0,0,0,0.65);
            overflow: hidden;
            position: relative;
            grid-column: 2 / 3;
          }
          [data-nex-immersive-preview] [data-nex-preview-rail] {
            display: flex !important;
            grid-column: 3 / 4;
            align-self: center;
            width: 320px;
          }
          [data-nex-immersive-preview] [data-nex-preview-topstrip] {
            position: absolute;
            top: 24px;
            left: 24px;
            right: unset;
            grid-column: 1 / -1;
            align-self: start;
            justify-self: start;
          }
          [data-nex-immersive-preview] [data-nex-preview-footer-mobile] {
            display: none !important;
          }
          [data-nex-immersive-preview] [data-nex-preview-phone-notch] {
            display: block !important;
          }
        }
        /* Reduced motion · defeat the swipe cross-fade transition
         * authoritatively via CSS. The React state (reducedMotion) is
         * kept for logic that may want it later, but the visible result
         * is driven here so Playwright's media-emulate matches reality. */
        @media (prefers-reduced-motion: reduce) {
          [data-nex-immersive-preview] [data-nex-preview-phone] {
            transition: none !important;
          }
        }
      `}</style>

      <div
        data-nex-immersive-preview
        data-theme-id={theme.id}
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${theme.name}`}
      >
        {/* ─── Top strip · 56 px on mobile, floating on desktop ─── */}
        <TopStrip
          theme={theme}
          onClose={onClose}
          onPrev={onPrev}
          onNext={onNext}
          openFullScreenHref={openFullScreenHref}
        />

        {/* ─── Phone body · fills on mobile, 390×820 on desktop ─── */}
        <div
          data-nex-preview-phone
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={commitSwipe}
          onPointerCancel={commitSwipe}
          style={{
            touchAction: "pan-y",
            transform: swipe
              ? `translateX(${dragDelta * 0.4}px)`
              : "translateX(0)",
            opacity: swipe
              ? Math.max(0.5, 1 - Math.abs(dragDelta) / 400)
              : 1,
            transition: reducedMotion
              ? "none"
              : swipe
                ? "none"
                : "transform 220ms ease-out, opacity 220ms ease-out",
          }}
        >
          <ThemeWorld
            wallpaperUrl={theme.hero_image_url}
            wallpaperConfig={theme.wallpaper_config}
            size="preview"
          />
          {/* Desktop-only notch bar · hidden on mobile via CSS. */}
          <div
            data-nex-preview-phone-notch
            aria-hidden
            style={{
              display: "none",
              position: "absolute",
              top: 10,
              left: "50%",
              transform: "translateX(-50%)",
              width: 100,
              height: 6,
              borderRadius: 999,
              background: "rgba(2,9,20,0.72)",
              border: "1px solid rgba(255,255,255,0.08)",
              zIndex: 10,
            }}
          />
          <ChatSurface
            theme={theme}
            bubblePreset={bubblePreset}
            bubbleRim={bubbleRim}
            accentGlassMine={accentGlassMine}
            accentGlassPeer={accentGlassPeer}
            localMessages={localMessages}
            composerText={composerText}
            onComposerChange={setComposerText}
            onComposerSubmit={handleSend}
          />
          {/* Intro video overlay · plays once per preview-open. */}
          {theme.intro_video_url && (
            <IntroVideoOverlay
              videoUrl={theme.intro_video_url}
              posterUrl={theme.intro_poster_url}
              themeName={theme.name}
              accentHex={theme.accent_hex}
            />
          )}
        </div>

        {/* ─── Mobile footer · action bar ─── */}
        <ActionFooter
          theme={theme}
          active={active}
          locked={locked}
          canUsePremium={canUsePremium}
          activateAction={activateAction}
          openFullScreenHref={openFullScreenHref}
          scope="mobile"
        />

        {/* ─── Desktop info rail · hidden on mobile via CSS ─── */}
        <InfoRail
          theme={theme}
          active={active}
          locked={locked}
          canUsePremium={canUsePremium}
          activateAction={activateAction}
          openFullScreenHref={openFullScreenHref}
        />
      </div>
    </>
  );
}

// ─── Top strip ──────────────────────────────────────────────────────

function TopStrip({
  theme,
  onClose,
  onPrev,
  onNext,
  openFullScreenHref: _openFullScreenHref,
}: {
  theme: BrowserThemeRow;
  onClose: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  openFullScreenHref: string | null;
}): React.JSX.Element {
  return (
    <div
      data-nex-preview-topstrip
      style={{
        height: 56,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "0 14px",
        borderBottom: `1px solid rgba(0,175,255,0.14)`,
        background: NEX.bg,
        zIndex: 20,
      }}
    >
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          background: "rgba(0,0,0,0.42)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: NEX.text,
          cursor: "pointer",
          padding: 0,
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        <span aria-hidden style={{ fontSize: 18, lineHeight: 1 }}>
          ←
        </span>
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            lineHeight: 1.2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {theme.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: NEX.textMute,
            letterSpacing: "0.02em",
            marginTop: 2,
          }}
        >
          {theme.tier === "bisnis" ? "Premium" : "Free"}
        </div>
      </div>
      <button
        type="button"
        onClick={onPrev ?? undefined}
        disabled={!onPrev}
        aria-label="Previous theme"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: "rgba(0,0,0,0.42)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: onPrev ? NEX.text : NEX.textMute,
          cursor: onPrev ? "pointer" : "default",
          padding: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>
          ‹
        </span>
      </button>
      <button
        type="button"
        onClick={onNext ?? undefined}
        disabled={!onNext}
        aria-label="Next theme"
        style={{
          width: 34,
          height: 34,
          borderRadius: 999,
          background: "rgba(0,0,0,0.42)",
          border: "1px solid rgba(255,255,255,0.1)",
          color: onNext ? NEX.text : NEX.textMute,
          cursor: onNext ? "pointer" : "default",
          padding: 0,
          display: "grid",
          placeItems: "center",
        }}
      >
        <span aria-hidden style={{ fontSize: 14 }}>
          ›
        </span>
      </button>
    </div>
  );
}

// ─── Chat surface · bubbles + composer ──────────────────────────────

function ChatSurface({
  theme,
  bubblePreset,
  bubbleRim,
  accentGlassMine,
  accentGlassPeer,
  localMessages,
  composerText,
  onComposerChange,
  onComposerSubmit,
}: {
  theme: BrowserThemeRow;
  bubblePreset: BubblePreset;
  bubbleRim: string;
  accentGlassMine: string;
  accentGlassPeer: string;
  localMessages: LocalMessage[];
  composerText: string;
  onComposerChange: (v: string) => void;
  onComposerSubmit: (e: React.FormEvent) => void;
}): React.JSX.Element {
  const canSend = canSendLocalMessage(localMessages);
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        gap: 10,
        padding: "0 14px 14px",
        zIndex: 5,
      }}
    >
      <ThemeBubble
        preset={bubblePreset}
        mine={false}
        bubbleRim={bubbleRim}
        accentGlassMine={accentGlassMine}
        accentGlassPeer={accentGlassPeer}
        size="preview"
      >
        hey! check out this theme ✨
      </ThemeBubble>
      <ThemeBubble
        preset={bubblePreset}
        mine={true}
        bubbleRim={bubbleRim}
        accentGlassMine={accentGlassMine}
        accentGlassPeer={accentGlassPeer}
        size="preview"
      >
        love this one — so you
      </ThemeBubble>
      {localMessages.map((m) => (
        <ThemeBubble
          key={m.id}
          preset={bubblePreset}
          mine={true}
          bubbleRim={bubbleRim}
          accentGlassMine={accentGlassMine}
          accentGlassPeer={accentGlassPeer}
          size="preview"
        >
          {m.text}
        </ThemeBubble>
      ))}
      <form
        onSubmit={onComposerSubmit}
        data-nex-preview-composer
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginTop: 6,
          padding: "8px 10px",
          borderRadius: 20,
          background: "rgba(2,9,20,0.52)",
          border: `1px solid ${theme.composer_rim_hex ?? theme.accent_hex}66`,
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        <input
          type="text"
          value={composerText}
          onChange={(e) => onComposerChange(e.target.value)}
          disabled={!canSend}
          placeholder={
            canSend
              ? "Try a message in this theme…"
              : `Max ${LOCAL_MESSAGE_LIMIT} test messages · close & reopen`
          }
          aria-label="Try a sample message"
          data-nex-preview-composer-input
          style={{
            flex: 1,
            minWidth: 0,
            background: "transparent",
            border: "none",
            outline: "none",
            color: NEX.text,
            fontSize: 13,
            fontFamily: "inherit",
          }}
        />
        <button
          type="submit"
          disabled={!canSend || composerText.trim().length === 0}
          aria-label="Send sample message"
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background: theme.accent_hex,
            border: "none",
            color: "#0B0F1A",
            fontSize: 14,
            fontWeight: 800,
            cursor: canSend ? "pointer" : "not-allowed",
            opacity: canSend && composerText.trim().length > 0 ? 1 : 0.45,
          }}
        >
          ↑
        </button>
      </form>
    </div>
  );
}

// ─── Intro video overlay ────────────────────────────────────────────

function IntroVideoOverlay({
  videoUrl,
  posterUrl,
  themeName,
  accentHex,
}: {
  videoUrl: string;
  posterUrl: string | null;
  themeName: string;
  accentHex: string;
}): React.JSX.Element | null {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = React.useState(true);
  const [videoReady, setVideoReady] = React.useState(false);

  // Reset state when the video URL changes (theme switch).
  React.useEffect(() => {
    setVisible(true);
    setVideoReady(false);
  }, [videoUrl]);

  React.useEffect(() => {
    if (!visible) return;
    const el = videoRef.current;
    if (!el) return;
    try {
      el.currentTime = 0;
    } catch {
      // ignore · onLoadedMetadata will seek
    }
    const p = el.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => setVisible(false));
    }
  }, [visible, videoUrl]);

  const replay = React.useCallback(() => {
    setVideoReady(false);
    setVisible(true);
  }, []);

  if (!visible) {
    return (
      <button
        type="button"
        onClick={replay}
        aria-label={`Replay ${themeName} intro`}
        style={{
          position: "absolute",
          bottom: 14,
          right: 14,
          padding: "8px 14px",
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          border: `1px solid ${accentHex}`,
          color: NEX.text,
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          boxShadow: `0 2px 18px ${accentHex}66`,
          zIndex: 15,
        }}
      >
        ↻ Replay intro
      </button>
    );
  }

  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        inset: 0,
        background: NEX.bg,
        zIndex: 12,
      }}
    >
      <video
        ref={videoRef}
        key={videoUrl}
        src={videoUrl}
        poster={posterUrl ?? undefined}
        autoPlay
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={(e) => {
          try {
            e.currentTarget.currentTime = 0;
          } catch {
            // ignore
          }
        }}
        onPlaying={() => setVideoReady(true)}
        onEnded={() => setVisible(false)}
        onError={() => setVisible(false)}
        aria-label={`${themeName} theme intro`}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center center",
          background: NEX.bg,
          display: "block",
          opacity: videoReady ? 1 : 0,
          transition: "opacity 120ms linear",
        }}
      />
    </div>
  );
}

// ─── Mobile action footer ───────────────────────────────────────────

function ActionFooter({
  theme,
  active,
  locked,
  canUsePremium: _canUsePremium,
  activateAction,
  openFullScreenHref,
  scope,
}: {
  theme: BrowserThemeRow;
  active: boolean;
  locked: boolean;
  canUsePremium: boolean;
  activateAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  openFullScreenHref: string | null;
  scope: "mobile" | "desktop";
}): React.JSX.Element {
  const base: React.CSSProperties =
    scope === "mobile"
      ? {
          flexShrink: 0,
          padding: "14px 16px calc(env(safe-area-inset-bottom, 0) + 14px)",
          borderTop: `1px solid rgba(0,175,255,0.14)`,
          background: NEX.bg,
          zIndex: 20,
          minHeight: 72,
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }
      : {
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
        };
  return (
    <div
      data-nex-preview-footer-mobile={scope === "mobile" ? "" : undefined}
      data-nex-preview-footer-desktop={scope === "desktop" ? "" : undefined}
      style={base}
    >
      {active ? (
        openFullScreenHref ? (
          <a
            href={openFullScreenHref}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              textDecoration: "none",
              padding: "12px 14px",
              borderRadius: 10,
              background: `${theme.accent_hex}22`,
              border: `1px solid ${theme.accent_hex}`,
              color: theme.accent_hex,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            <span>✓ Currently active · Open full screen</span>
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                fontWeight: 700,
              }}
            >
              Open →
            </span>
          </a>
        ) : (
          <div
            style={{
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              padding: "12px",
              borderRadius: 10,
              background: `${theme.accent_hex}22`,
              border: `1px solid ${theme.accent_hex}`,
              color: theme.accent_hex,
            }}
          >
            ✓ Currently active on your NEX
          </div>
        )
      ) : locked ? (
        <a
          href="/nex-native/settings/tier"
          style={{
            display: "block",
            textAlign: "center",
            padding: "12px",
            borderRadius: 10,
            background: NEX.orange,
            color: "#0B0F1A",
            textDecoration: "none",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          Upgrade to NEX Bisnis to unlock →
        </a>
      ) : (
        <>
          {openFullScreenHref && (
            <a
              href={openFullScreenHref}
              style={{
                display: "block",
                textAlign: "center",
                padding: "10px",
                borderRadius: 10,
                background: "transparent",
                border: `1px solid ${theme.accent_hex}`,
                color: theme.accent_hex,
                textDecoration: "none",
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              Open full screen →
            </a>
          )}
          <form action={activateAction}>
            <input type="hidden" name="chat_theme" value={theme.id} />
            {openFullScreenHref && (
              <input type="hidden" name="next" value={openFullScreenHref} />
            )}
            <button
              type="submit"
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: 10,
                background: theme.accent_hex,
                color: "#0B0F1A",
                border: "none",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Use this theme
            </button>
          </form>
        </>
      )}
    </div>
  );
}

// ─── Desktop info rail ──────────────────────────────────────────────

function InfoRail({
  theme,
  active,
  locked,
  canUsePremium,
  activateAction,
  openFullScreenHref,
}: {
  theme: BrowserThemeRow;
  active: boolean;
  locked: boolean;
  canUsePremium: boolean;
  activateAction: (formData: FormData) => Promise<never> | void | Promise<void>;
  openFullScreenHref: string | null;
}): React.JSX.Element {
  return (
    <div
      data-nex-preview-rail
      style={{
        display: "none",
        flexDirection: "column",
        gap: 16,
        padding: "28px",
        borderRadius: 20,
        background: "rgba(3,16,29,0.72)",
        border: "1px solid rgba(0,175,255,0.14)",
        color: NEX.text,
        maxWidth: 320,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: theme.accent_hex,
            boxShadow: `0 0 20px ${theme.accent_hex}55`,
            flexShrink: 0,
          }}
        />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{theme.name}</div>
          <div
            style={{
              fontSize: 10,
              color: NEX.textMute,
              fontFamily: "ui-monospace, monospace",
            }}
          >
            {theme.accent_hex}
          </div>
        </div>
      </div>
      {theme.tagline && (
        <div style={{ fontSize: 13, color: NEX.textDim, lineHeight: 1.55 }}>
          {theme.tagline}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            fontSize: 9,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            padding: "3px 8px",
            borderRadius: 999,
            background:
              theme.tier === "bisnis"
                ? "rgba(255,120,0,0.18)"
                : "rgba(22,214,107,0.18)",
            color: theme.tier === "bisnis" ? NEX.orange : NEX.green,
          }}
        >
          {theme.tier === "bisnis" ? "Bisnis" : "Free"}
        </span>
        {active && (
          <span
            style={{
              fontSize: 9,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              fontWeight: 700,
              padding: "3px 8px",
              borderRadius: 999,
              background: `${theme.accent_hex}cc`,
              color: "#0B0F1A",
            }}
          >
            Active
          </span>
        )}
      </div>
      <ActionFooter
        theme={theme}
        active={active}
        locked={locked}
        canUsePremium={canUsePremium}
        activateAction={activateAction}
        openFullScreenHref={openFullScreenHref}
        scope="desktop"
      />
    </div>
  );
}

// ─── URL sync helpers ───────────────────────────────────────────────

/** Keep the browser URL in sync with the currently-open preview.
 *
 *  Runs inside ImmersivePreviewShell so the fixture benefits from URL
 *  state too. On first mount for a given theme id: pushState. On theme
 *  switch (parent calls onPrev/onNext → new instance OR same instance
 *  with new theme): replaceState. On popstate: call onClose so the
 *  parent can tear the shell down. */
function usePreviewUrl(themeId: string, onClose: () => void): void {
  const openedRef = React.useRef(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const curr = window.location.search;
    const next = buildPreviewUrl(window.location.pathname, curr, themeId);
    const already = `${window.location.pathname}${curr}` === next;
    if (!openedRef.current) {
      openedRef.current = true;
      if (!already) {
        window.history.pushState({ preview: themeId }, "", next);
      }
    } else if (!already) {
      window.history.replaceState({ preview: themeId }, "", next);
    }
  }, [themeId]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const onPop = () => {
      const params = new URLSearchParams(window.location.search);
      if (!params.get("preview")) {
        onClose();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [onClose]);

  // On unmount (preview closed via UI), strip the ?preview=<id> so a
  // reload lands back on the gallery, not the preview.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      const curr = window.location.search;
      const next = buildPreviewUrl(window.location.pathname, curr, null);
      if (`${window.location.pathname}${curr}` !== next) {
        window.history.replaceState(null, "", next);
      }
    };
  }, []);
}

/** Honour a `?preview=<id>` deep link on the browser-client first
 *  render. Pulls the id out of the URL and hands it to the setter so
 *  the real page knows to open the preview. */
export function useInitialPreviewFromUrl(
  setPreviewId: (id: string | null) => void,
): void {
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("preview");
    if (id) setPreviewId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
