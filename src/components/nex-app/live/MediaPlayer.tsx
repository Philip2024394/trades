"use client";

// src/components/nex-app/live/MediaPlayer.tsx
//
// NEX LIVE · Phase 2 · Media player
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// A single-item media surface. Handles VIDEO and AUDIO uniformly with
// truthful state (§4):
//   READY · PLAYING · PAUSED · BUFFERING · FAILED · ENDED · UNAVAILABLE
//
// UNAVAILABLE is critical (§4): if playback_url is null, the player
// renders an honest "media temporarily unavailable" state instead of
// pretending a black video is playing.
//
// §11 Rights safety: the player does NOT determine visibility · that is
// upstream. If the caller passes a media item, the player plays it. The
// caller is responsible for filtering REMOVED/RESTRICTED items.
//
// §29 Media transitions: when `active` flips from true → false, the
// player MUST pause its own element so no previous media keeps playing.

import { useCallback, useEffect, useRef, useState } from "react";

export type PlayerState =
  | "READY"          // media element created, not yet playing
  | "PLAYING"
  | "PAUSED"
  | "BUFFERING"
  | "FAILED"         // media element error
  | "ENDED"
  | "UNAVAILABLE";   // no playback_url

export type MediaKind = "video" | "audio";

export type MediaPlayerProps = {
  media_id: string;
  playback_url: string | null;
  poster_url: string | null;
  kind: MediaKind;
  /** Whether this player is the currently-active item. When false the
   *  player MUST NOT play (§29 no previous-media-continuing). */
  active: boolean;
  /** Muted default true so autoplay is permitted on mobile. */
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  onStateChange?: (state: PlayerState) => void;
};

export function MediaPlayer(props: MediaPlayerProps) {
  const { media_id, playback_url, poster_url, kind, active, muted, onMutedChange, onStateChange } = props;
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>(playback_url ? "READY" : "UNAVAILABLE");

  const emitState = useCallback((next: PlayerState) => {
    setState(next);
    onStateChange?.(next);
  }, [onStateChange]);

  // Active-flip handling — §29 no previous media playing
  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (!active) {
      el.pause();
      // Reset position so re-activation starts clean
      try { el.currentTime = 0; } catch { /* iOS may throw pre-load */ }
      emitState(playback_url ? "READY" : "UNAVAILABLE");
    } else if (playback_url) {
      // Autoplay muted is permitted on mobile browsers
      const p = el.play();
      if (p && typeof p.then === "function") {
        p.then(() => emitState("PLAYING")).catch(() => emitState("PAUSED"));
      }
    }
  }, [active, playback_url, emitState]);

  // Muted flag sync
  useEffect(() => {
    const el = mediaRef.current;
    if (el) el.muted = muted;
  }, [muted]);

  // Media element event handlers
  const onCanPlay = useCallback(() => {
    if (active && mediaRef.current) {
      const p = mediaRef.current.play();
      if (p && typeof p.then === "function") p.catch(() => { /* silent */ });
    }
  }, [active]);
  const onPlaying = useCallback(() => emitState("PLAYING"), [emitState]);
  const onWaiting = useCallback(() => emitState("BUFFERING"), [emitState]);
  const onPause = useCallback(() => {
    // Ignore pauses caused by our active-flip logic
    if (mediaRef.current && !mediaRef.current.ended && active) emitState("PAUSED");
  }, [emitState, active]);
  const onEnded = useCallback(() => emitState("ENDED"), [emitState]);
  const onError = useCallback(() => emitState("FAILED"), [emitState]);

  // Tap toggles mute (single-hand mobile pattern)
  const onTap = useCallback(() => {
    onMutedChange(!muted);
  }, [muted, onMutedChange]);

  // Unavailable state — honest §4
  if (!playback_url) {
    return (
      <div
        data-testid={`nex-live-media-player-${media_id}`}
        data-state="UNAVAILABLE"
        className="flex flex-col items-center justify-center w-full h-full bg-black text-white/70 select-none px-6 text-center"
      >
        <div className="text-sm mb-2 opacity-70">Media temporarily unavailable.</div>
        <div className="text-xs opacity-50">
          Storage or delivery hasn&#39;t returned a playback URL for this item yet. Try again later — we won&#39;t play a placeholder.
        </div>
      </div>
    );
  }

  // Real media element · `key` is passed directly to the JSX (React 19
  // warns when a `key` prop is spread from an object).
  const commonProps = {
    ref: mediaRef as React.RefObject<HTMLVideoElement | HTMLAudioElement>,
    src: playback_url,
    autoPlay: active,
    playsInline: true,
    loop: false,
    muted,
    controls: false,
    onCanPlay,
    onPlaying,
    onWaiting,
    onPause,
    onEnded,
    onError,
    onClick: onTap,
    "data-testid": `nex-live-media-player-${media_id}`,
    "data-state": state,
  } as const;

  if (kind === "audio") {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full bg-black" data-testid={`nex-live-audio-shell-${media_id}`}>
        {/* Audio surface · cover image + audio element */}
        {poster_url ? (
          <img
            src={poster_url}
            alt=""
            className="max-h-[60vh] max-w-full object-contain rounded-lg opacity-90"
          />
        ) : (
          <div className="text-white/50 text-6xl font-bold tracking-widest select-none">♪</div>
        )}
        <audio key={media_id} {...(commonProps as React.AudioHTMLAttributes<HTMLAudioElement> & { ref: React.RefObject<HTMLAudioElement>; "data-testid": string; "data-state": string })} />
      </div>
    );
  }
  return (
    <video
      key={media_id}
      {...(commonProps as React.VideoHTMLAttributes<HTMLVideoElement> & { ref: React.RefObject<HTMLVideoElement>; "data-testid": string; "data-state": string })}
      poster={poster_url ?? undefined}
      className="w-full h-full object-contain"
    />
  );
}
