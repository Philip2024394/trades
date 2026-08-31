"use client";

// NEX Video Feed V1 · client · Philip 2026-08-27.
//
// Full-screen vertical swipe player. Recency-only feed. Autoplay muted.
// Tap to unmute. Swipe up = next. Swipe down = previous.
// Every view POSTs one impression row.
//
// No fancy recommendation. No follow/like/comment. No LIVE. No music.
// This is the minimum surface to answer: "will people actually watch NEX videos?"

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Video {
  media_id: string;
  owner_id: string;
  title: string | null;
  description: string | null;
  mime_type: string;
  duration_ms: number | null;
  width_px: number | null;
  height_px: number | null;
  uploaded_at: string;
  playback_url: string | null;
  poster_url: string | null;
}

const SESSION_KEY = "nex-video-session";

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

export interface VideoFeedClientProps {
  /**
   * When true, the feed uses `absolute inset-0` positioning instead of
   * `fixed inset-0`, so it fills its nearest positioned ancestor rather
   * than the viewport. Used when embedding inside the NEX shell's
   * workspace zone (Phase 3 · Discover → Feed) so the phone frame stays
   * visible around the feed. Default false = original standalone behaviour.
   */
  contained?: boolean;
}
export function VideoFeedClient({ contained = false }: VideoFeedClientProps = {}) {
  const [videos, setVideos] = useState<Video[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [end, setEnd] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const impressionStartRef = useRef<number>(0);
  const impressionSentRef = useRef<Set<string>>(new Set());
  const sessionIdRef = useRef<string>("");

  useEffect(() => { sessionIdRef.current = getSessionId(); }, []);

  const loadPage = useCallback(async (startCursor: string | null) => {
    setLoading(true);
    try {
      const url = new URL("/api/nex-video/feed", window.location.origin);
      if (startCursor) url.searchParams.set("cursor", startCursor);
      url.searchParams.set("limit", "10");
      const r = await fetch(url.toString());
      const j = await r.json();
      if (r.ok && Array.isArray(j.videos)) {
        setVideos((prev) => [...prev, ...j.videos]);
        setCursor(j.next_cursor ?? null);
        if (!j.next_cursor && (j.videos.length === 0)) setEnd(true);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void loadPage(null); }, [loadPage]);

  // Preload the next page when the viewer is within 2 videos of the tail.
  useEffect(() => {
    if (!loading && cursor && index >= videos.length - 2) void loadPage(cursor);
  }, [index, videos.length, cursor, loading, loadPage]);

  // Post an impression when a video starts, and again with watched_ms on switch.
  const postImpression = useCallback(async (v: Video, watchedMs: number, unmuted: boolean) => {
    // Only post once per (media_id, session) unless the watched_ms grows.
    // For V1 simplicity, we post once per video switch (start OR end of view).
    await fetch("/api/nex-video/impression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        media_id: v.media_id,
        viewer_id: sessionIdRef.current,
        session_id: sessionIdRef.current,
        watched_ms: watchedMs,
        unmuted,
      }),
      keepalive: true,
    }).catch(() => { /* silent · impression logging is best effort */ });
  }, []);

  // On index change: (a) log impression for previous, (b) start clock for current
  const prevIndexRef = useRef<number>(-1);
  useEffect(() => {
    const prev = prevIndexRef.current;
    if (prev >= 0 && prev < videos.length) {
      const watchedMs = Math.max(0, Date.now() - impressionStartRef.current);
      void postImpression(videos[prev], watchedMs, !muted);
    }
    impressionStartRef.current = Date.now();
    prevIndexRef.current = index;
    // Try to play current
    const v = videoRef.current;
    if (v) { v.currentTime = 0; v.play().catch(() => { /* autoplay may block · fine */ }); }
  }, [index, videos, muted, postImpression]);

  // On unmount: log the last impression
  useEffect(() => {
    return () => {
      const prev = prevIndexRef.current;
      if (prev >= 0 && prev < videos.length) {
        const watchedMs = Math.max(0, Date.now() - impressionStartRef.current);
        void postImpression(videos[prev], watchedMs, !muted);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wheel + touch swipe handlers
  const swipeStartY = useRef<number | null>(null);
  const wheelAccum = useRef<number>(0);
  const wheelTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const goNext = useCallback(() => {
    setIndex((i) => Math.min(i + 1, videos.length - 1));
  }, [videos.length]);
  const goPrev = useCallback(() => {
    setIndex((i) => Math.max(i - 1, 0));
  }, []);

  const onWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    wheelAccum.current += e.deltaY;
    if (wheelTimer.current) clearTimeout(wheelTimer.current);
    wheelTimer.current = setTimeout(() => {
      if (wheelAccum.current > 60) goNext();
      else if (wheelAccum.current < -60) goPrev();
      wheelAccum.current = 0;
    }, 80);
  }, [goNext, goPrev]);

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    swipeStartY.current = e.touches[0]?.clientY ?? null;
  }, []);
  const onTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (swipeStartY.current == null) return;
    const endY = e.changedTouches[0]?.clientY ?? 0;
    const dy = endY - swipeStartY.current;
    swipeStartY.current = null;
    if (dy < -50) goNext();
    else if (dy > 50) goPrev();
  }, [goNext, goPrev]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "j") goNext();
      else if (e.key === "ArrowUp" || e.key === "k") goPrev();
      else if (e.key === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev]);

  const current = videos[index];

  return (
    <div
      ref={containerRef}
      onWheel={onWheel}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      className={`${contained ? "absolute" : "fixed"} inset-0 flex items-center justify-center bg-black text-white select-none`}
      style={{ overscrollBehavior: "none" }}
    >
      {/* Empty state */}
      {videos.length === 0 && !loading && (
        <div className="text-center">
          <p className="mb-4 text-lg">No videos yet.</p>
          <Link href="/nex-video/create" className="inline-block rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-200">
            ＋ Create the first NEX Video
          </Link>
        </div>
      )}

      {loading && videos.length === 0 && (
        <p className="text-slate-400">Loading feed…</p>
      )}

      {current && (
        <>
          {/* Video */}
          <video
            ref={videoRef}
            key={current.media_id}
            src={current.playback_url ?? undefined}
            poster={current.poster_url ?? undefined}
            autoPlay
            playsInline
            muted={muted}
            loop
            className="max-h-full max-w-full object-contain"
            onClick={() => { setMuted((m) => !m); }}
          />

          {/* Info overlay · bottom-left */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-8 bg-gradient-to-t from-black/70 to-transparent">
            <div className="text-sm font-semibold">@{current.owner_id.slice(0, 24)}</div>
            {current.title && <div className="mt-1 text-base font-medium">{current.title}</div>}
            {current.description && <div className="mt-1 text-xs text-slate-200 line-clamp-2">{current.description}</div>}
          </div>

          {/* Action rail · right (Stage 3 will populate this · V1 leaves placeholders) */}
          <div className="absolute right-3 top-1/3 flex flex-col items-center gap-4 text-xs">
            <button
              onClick={() => setMuted((m) => !m)}
              className="rounded-full bg-white/10 px-3 py-2 backdrop-blur hover:bg-white/20"
              aria-label={muted ? "Unmute" : "Mute"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
            <div className="text-slate-300">♡</div>
            <div className="text-slate-300">💬</div>
            <div className="text-slate-300">↗</div>
          </div>

          {/* Position indicator · top */}
          <div className="pointer-events-none absolute top-3 right-3 text-xs text-slate-400">
            {index + 1} / {videos.length}{cursor ? "+" : ""}
          </div>

          {/* + Create button · top-left */}
          <Link
            href="/nex-video/create"
            className="absolute top-3 left-3 rounded-full bg-white/10 px-3 py-1.5 text-sm font-semibold backdrop-blur hover:bg-white/20"
          >
            ＋ Create
          </Link>

          {/* Muted hint · fades after 3s (V1: static) */}
          {muted && (
            <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-xs backdrop-blur">
              tap to unmute
            </div>
          )}
        </>
      )}

      {end && videos.length === 0 && (
        <p className="mt-4 text-slate-500">No public videos yet.</p>
      )}
    </div>
  );
}
