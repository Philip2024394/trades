"use client";

// src/app/nex-native/chat/_theme-intro-interstitial.tsx
//
// NEX Phase 4A · premium theme intro-video interstitial.
// Founder-authorised 2026-10-04.
//
// Rendered by _portrait-bloom-shell.tsx as a full-viewport overlay when:
//   · the peer's theme has a non-null intro_video_url, AND
//   · the viewer has not yet seen this theme's intro.
//
// Hard contract (sealed with the founder 2026-10-04):
//   · The intro MUST NEVER block chat entry for more than 5 seconds
//     under any circumstance. There's a hard safety ceiling (5000ms)
//     that forces `onComplete()` regardless of the video state.
//   · The configured `durationMs` is INFORMATIONAL · the client never
//     waits past this value · it listens for the real `onended` event.
//   · If the video errors (404, decode fail, autoplay blocked), skip
//     immediately · never trap the user behind a broken video.
//   · "Skip intro" button is always visible · tap exits immediately.
//   · `onComplete()` fires exactly once · subsequent events are no-ops.
//   · `onComplete()` triggers mark-seen as fire-and-forget · the chat
//     opens the moment the video ends · the mark-seen call runs in
//     parallel · chat entry never awaits it.

import * as React from "react";
import { markThemeIntroSeenAction } from "../_actions";

/** Hard safety ceiling · the intro will NEVER keep the chat closed
 *  past this value. 5000ms matches the sealed founder decision ·
 *  do not raise. */
const HARD_SAFETY_CEILING_MS = 5000;

interface ThemeIntroInterstitialProps {
  /** Theme id · used by the mark-seen fire-and-forget call. */
  themeId: string;
  /** Theme name · shown in the skip button a11y label and optional
   *  caption. */
  themeName: string;
  /** Required · if null the shell never mounts this component. */
  videoUrl: string;
  /** Optional still-frame while the video downloads. */
  posterUrl: string | null;
  /** Nominal duration in milliseconds · informational · the client
   *  never WAITS past this · it uses `onended`. Still passed through
   *  so a future analytics bridge can log watch-time ratio. */
  durationMs: number | null;
  /** Fires exactly once · either on video end, user skip, video error,
   *  or hard-ceiling timeout · whichever comes first. */
  onComplete: () => void;
}

const UI = {
  bg: "#020914",
  text: "#F2F5F8",
  textDim: "#B5C3D6",
  textMuted: "#7D9BC0",
  skipBg: "rgba(255,255,255,0.08)",
  skipBorder: "rgba(255,255,255,0.18)",
};

export function ThemeIntroInterstitial(props: ThemeIntroInterstitialProps): React.JSX.Element {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const firedRef = React.useRef(false);
  const safetyTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Single-fire guard · the chat shell depends on `onComplete` running
  // exactly once. Multiple events (ended + skip + error) collapse to
  // one onComplete call and one mark-seen fire-and-forget.
  const fire = React.useCallback(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    // Fire-and-forget mark-seen · chat opens instantly · we never
    // await this. Failure is silently absorbed inside the server
    // action and the service layer.
    void markThemeIntroSeenAction(props.themeId);
    props.onComplete();
  }, [props]);

  React.useEffect(() => {
    // Install the hard safety ceiling · fires regardless of video
    // state. 5000ms sealed with the founder.
    safetyTimerRef.current = setTimeout(fire, HARD_SAFETY_CEILING_MS);
    // Try to kick off playback explicitly. Browsers block autoplay
    // on muted-with-sound; we set muted on the element below · which
    // is almost always allowed. If play() rejects we skip immediately.
    const el = videoRef.current;
    if (el) {
      const p = el.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => fire());
      }
    }
    return () => {
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
    };
  }, [fire]);

  // ESC also exits immediately · a11y nice-to-have for keyboard users.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") fire();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fire]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${props.themeName} theme introduction`}
      data-nex-theme-intro
      data-theme-id={props.themeId}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        background: UI.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <video
        ref={videoRef}
        src={props.videoUrl}
        poster={props.posterUrl ?? undefined}
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={fire}
        onError={fire}
        onStalled={() => {
          // Don't fail outright on a brief stall · but if the browser
          // never recovers the hard safety ceiling will catch it.
        }}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          background: UI.bg,
        }}
      />
      <button
        type="button"
        onClick={fire}
        aria-label={`Skip ${props.themeName} intro and open chat`}
        style={{
          position: "absolute",
          top: "calc(env(safe-area-inset-top, 0px) + 16px)",
          right: 16,
          padding: "8px 14px",
          borderRadius: 999,
          background: UI.skipBg,
          border: `1px solid ${UI.skipBorder}`,
          color: UI.text,
          fontSize: 12.5,
          fontWeight: 600,
          letterSpacing: "0.04em",
          cursor: "pointer",
          fontFamily:
            "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        Skip intro →
      </button>
    </div>
  );
}
