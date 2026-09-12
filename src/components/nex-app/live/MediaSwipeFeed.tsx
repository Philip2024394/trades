"use client";

// src/components/nex-app/live/MediaSwipeFeed.tsx
//
// NEX LIVE · Phase 2 · Vertical swipe discovery
// Philip 2026-09-06 · FOUNDER CEREMONIAL AUTHORIZATION · Phase 2
//
// §6 · touch + keyboard + mouse. Swipe up = next, swipe down = previous.
// §7 · mode-specific. The feed passes items in and the parent controls
//     the mode; switching mode is handled by re-rendering with a new
//     `items` prop + resetting `initialIndex`.
// §29 · only the active item plays. Previous items are paused via the
//     `active` prop on <MediaPlayer/>.
// §30 · preload only next-1. Never preload unlimited media.
// §32 · non-gesture keyboard fallback: ArrowUp/Down, j/k, PageUp/PageDown.
//
// The feed does NOT own discovery or ranking — it renders whatever
// items the parent passes. Ranking lives in the API layer.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MediaPlayer, type MediaKind } from "./MediaPlayer";
// Phase M · spatial gesture detector · classifies four-direction swipes
import { classifyGesture } from "@/lib/nex/live/spatial-gesture-detector";

export type SwipeItem = {
  media_id: string;
  playback_url: string | null;
  poster_url: string | null;
  kind: MediaKind;
  title: string | null;
  owner_id: string | null;
  declared_kind: string;
  customer_facing_label: string;
  visibility: string;
  /** Phase M §9 · mock chip must propagate to Artist World cards. */
  is_mock_fixture?: boolean;
};

export type MediaSwipeFeedProps = {
  items: ReadonlyArray<SwipeItem>;
  onActiveChange?: (index: number, item: SwipeItem | null) => void;
  onReport?: (item: SwipeItem) => void;
  /** Phase M · fired on left-swipe · Artist World should slide in */
  onSwipeLeft?: () => void;
  /** Phase M · fired on right-swipe · Create World should slide in */
  onSwipeRight?: () => void;
};

export function MediaSwipeFeed({ items, onActiveChange, onReport, onSwipeLeft, onSwipeRight }: MediaSwipeFeedProps) {
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Reset to top when items change (mode switch)
  useEffect(() => { setIndex(0); }, [items]);

  const activeItem: SwipeItem | null = items.length > 0 ? items[index] : null;

  // Emit active-change on transitions
  useEffect(() => {
    onActiveChange?.(index, activeItem);
  }, [index, activeItem, onActiveChange]);

  // ── Swipe / navigation handlers ─────────────────────────────────

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(items.length - 1, i + 1));
  }, [items.length]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  // Keyboard (§32 non-gesture)
  useEffect(() => {
    const handler = (ev: KeyboardEvent) => {
      // Ignore keys inside input/textarea
      const target = ev.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (ev.key === "ArrowDown" || ev.key === "j" || ev.key === "PageDown") { ev.preventDefault(); goNext(); }
      else if (ev.key === "ArrowUp" || ev.key === "k" || ev.key === "PageUp") { ev.preventDefault(); goPrev(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  // Touch · four-direction spatial gestures via the shared detector
  // (Phase M §1 §16). Vertical dominance → previous/next media;
  // horizontal dominance → Artist World (←) / Create World (→). The
  // detector rejects taps, too-short, too-slow, and diagonal swipes so
  // the feed never navigates by accident.
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const onTouchStart = useCallback((ev: React.TouchEvent) => {
    const t = ev.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }, []);
  const onTouchEnd = useCallback((ev: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const endTouch = ev.changedTouches[0];
    if (!endTouch) return;
    const decision = classifyGesture({
      dx: endTouch.clientX - start.x,
      dy: endTouch.clientY - start.y,
      dt_ms: Date.now() - start.t,
    });
    switch (decision.direction) {
      case "UP":    goPrev(); break;            // Previous media
      case "DOWN":  goNext(); break;            // Next / discover
      case "LEFT":  onSwipeLeft?.(); break;     // Artist World
      case "RIGHT": onSwipeRight?.(); break;    // Create World
      case "NONE":  /* tap / diagonal / too-short · ignore */ break;
    }
  }, [goNext, goPrev, onSwipeLeft, onSwipeRight]);

  // Mouse wheel (opt-in per §6)
  const lastWheelAtRef = useRef<number>(0);
  const onWheel = useCallback((ev: React.WheelEvent) => {
    const now = Date.now();
    if (now - lastWheelAtRef.current < 400) return;   // debounce
    if (Math.abs(ev.deltaY) < 30) return;
    lastWheelAtRef.current = now;
    if (ev.deltaY > 0) goNext();
    else goPrev();
  }, [goNext, goPrev]);

  // Only render the window of nearby items so we never mount a huge tree
  // (§30). We render current +/- 1 = 3 players max. React reuses via
  // `key`, so unmounting the leaving player triggers its pause path.
  const window = useMemo(() => {
    const around: { idx: number; item: SwipeItem }[] = [];
    for (const off of [-1, 0, 1]) {
      const i = index + off;
      if (i >= 0 && i < items.length) around.push({ idx: i, item: items[i] });
    }
    return around;
  }, [items, index]);

  // ── Empty state ─────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-white/60 select-none px-6 text-center">
        <div className="text-base mb-1">Nothing to discover here yet.</div>
        <div className="text-xs opacity-70">
          Publish something with a rights declaration and it will appear.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden touch-none"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onWheel={onWheel}
      data-testid="nex-live-media-swipe-feed"
      data-active-index={index}
      data-item-count={items.length}
    >
      {window.map(({ idx, item }) => (
        <div
          key={`slot-${item.media_id}`}
          className="absolute inset-0 transition-transform duration-200"
          style={{
            transform: `translateY(${(idx - index) * 100}%)`,
            pointerEvents: idx === index ? "auto" : "none",
          }}
        >
          <MediaPlayer
            media_id={item.media_id}
            playback_url={item.playback_url}
            poster_url={item.poster_url}
            kind={item.kind}
            active={idx === index}
            muted={muted}
            onMutedChange={setMuted}
          />
        </div>
      ))}

      {/* Position indicator + mute affordance · restrained */}
      <div className="absolute top-2 right-3 flex items-center gap-2 z-30 pointer-events-none">
        <span className="text-[10px] tracking-widest text-white/40 select-none">
          {index + 1} / {items.length}
        </span>
      </div>

      <button
        type="button"
        onClick={() => setMuted((m) => !m)}
        className="absolute top-2 left-3 rounded-full bg-white/10 backdrop-blur px-2 py-1 text-xs z-30 pointer-events-auto"
        aria-label={muted ? "Unmute" : "Mute"}
        data-testid="nex-live-swipe-mute"
      >
        {muted ? "🔇" : "🔊"}
      </button>

      {/* Report button on active item */}
      {activeItem && onReport && (
        <button
          type="button"
          onClick={() => onReport(activeItem)}
          className="absolute bottom-24 right-3 rounded-full bg-white/10 backdrop-blur px-3 py-1.5 text-[11px] z-30 pointer-events-auto"
          data-testid="nex-live-swipe-report"
        >
          Report
        </button>
      )}
    </div>
  );
}
