"use client";

// src/components/nex-app/live/FreeContentLiveIntro.tsx
//
// NEX LIVE · Master Experience · Free-user Live discovery experiment
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Master Build
//
// §15-16 experiment · before selected FREE music/video, present a very
// short Live discovery clip. The user MUST always be able to leave.
//
// §16 · §33-36 · not a normal ad. Not deceptive. Not attention
// manipulation. Short. Clear. Skippable. Honestly labeled.
//
// The caller determines WHEN to show this (frequency policy §34 OFF /
// LOW / MEDIUM / HIGH lives in configuration, not in this component).
// This component just renders honestly once opened.

import { useEffect, useState } from "react";

export type FreeContentLiveIntroProps = {
  open: boolean;
  clip: {
    media_id: string;
    entity_name: string;
    city_label: string | null;
    title: string | null;
    playback_url: string | null;
    poster_url: string | null;
    duration_hint_sec: number;   // typically 8-15s · never fabricated
    is_mock_fixture: boolean;
  } | null;
  onContinue: () => void;
  onWatchLive: () => void;
  onClose: () => void;
};

export function FreeContentLiveIntro({ open, clip, onContinue, onWatchLive, onClose }: FreeContentLiveIntroProps) {
  const [countdown, setCountdown] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !clip) { setCountdown(null); return; }
    setCountdown(clip.duration_hint_sec);
    const iv = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null) return null;
        if (prev <= 1) { clearInterval(iv); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [open, clip]);

  // Escape closes · always
  useEffect(() => {
    if (!open) return;
    const h = (ev: KeyboardEvent) => { if (ev.key === "Escape") onClose(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open || !clip) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Live discovery"
      data-testid="nex-live-free-content-intro"
      className="fixed inset-0 z-50 bg-black flex flex-col"
    >
      {/* Header · honest labels · always-visible close */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-white/50">Live around you</div>
          {clip.city_label && (
            <div className="text-sm font-semibold text-white">{clip.city_label}</div>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-white/10 px-3 py-1.5 text-xs backdrop-blur hover:bg-white/20"
          aria-label="Close Live intro"
          data-testid="nex-live-intro-close"
        >
          ✕ Close
        </button>
      </header>

      {/* Media stage · real clip · never fake · UNAVAILABLE if no URL */}
      <div className="relative flex-1 bg-black flex items-center justify-center">
        {clip.playback_url ? (
          clip.playback_url.startsWith("/") || clip.playback_url.startsWith("http") ? (
            <video
              key={clip.media_id}
              src={clip.playback_url}
              poster={clip.poster_url ?? undefined}
              autoPlay
              playsInline
              muted
              className="max-h-full max-w-full object-contain"
              data-testid="nex-live-intro-video"
            />
          ) : (
            <div className="text-white/50">Media temporarily unavailable.</div>
          )
        ) : (
          <div className="text-center max-w-xs px-6 text-white/60">
            <div className="text-sm mb-1">Media temporarily unavailable.</div>
            <div className="text-xs text-white/40">
              We won&#39;t play a placeholder. Try again in a moment.
            </div>
          </div>
        )}

        {/* MOCK marker · never hidden */}
        {clip.is_mock_fixture && (
          <div className="absolute top-3 left-3 rounded-full bg-black/60 backdrop-blur px-2 py-0.5">
            <span className="text-[9px] uppercase tracking-wider text-amber-400">Mock</span>
          </div>
        )}

        {/* Countdown · honest */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute top-3 right-3 rounded-full bg-black/60 backdrop-blur px-2 py-0.5">
            <span className="text-[10px] tracking-wider text-white/70">{countdown}s</span>
          </div>
        )}
      </div>

      {/* Bottom · title + actions · Continue always available */}
      <footer className="p-4 bg-gradient-to-t from-black to-transparent">
        <div className="mx-auto max-w-lg">
          {clip.title && (
            <div className="text-white text-sm mb-1">{clip.title}</div>
          )}
          <div className="text-[11px] text-white/50 mb-3">
            @{clip.entity_name}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onContinue}
              className="flex-1 rounded-full bg-white text-black px-4 py-3 text-sm font-semibold hover:bg-slate-200"
              data-testid="nex-live-intro-continue"
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onWatchLive}
              className="flex-1 rounded-full bg-white/15 text-white px-4 py-3 text-sm font-semibold hover:bg-white/25"
              data-testid="nex-live-intro-watch"
            >
              Watch Live
            </button>
          </div>
          <div className="mt-3 text-[10px] text-white/40 text-center">
            NEX shows you what&#39;s happening around you. You can always continue to your content.
          </div>
        </div>
      </footer>
    </div>
  );
}
