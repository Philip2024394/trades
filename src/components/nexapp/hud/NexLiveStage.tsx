"use client";

// src/components/nexapp/hud/NexLiveStage.tsx
//
// NEX LIVE full-stage overlay · Philip 2026-08-27 v4.
//
// Consumes the CANONICAL <NexFrameViewport> — the single source of truth for
// the transparent inner display area of the NEX frame (measured from
// hud-frame-v12.png alpha channel · NEX_INNER_VIEWPORT in geometry.ts).
//
// Video fills the inner viewport edge-to-edge · object-fit: cover ·
// zero margins · no overlap with the frame artwork.
//
// Reuses the shipped Media Foundation via GET /api/nex-video/feed (Stage 2
// V1). No parallel video system. No LIVE broadcasting infrastructure — this
// is the visual/product-surface prototype only.

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { NexFrameViewport } from "./NexFrameViewport";

const SESSION_KEY = "nex-live-session";
function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let s = localStorage.getItem(SESSION_KEY);
  if (!s) {
    s = `live-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

interface FeedVideo {
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

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function NexLiveStage({ isOpen, onClose }: Props) {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [index, setIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [loading, setLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const impressionStartRef = useRef<number>(0);
  const prevIndexRef = useRef<number>(-1);
  const sessionRef = useRef<string>("");

  useEffect(() => { sessionRef.current = getSessionId(); }, []);

  const loadPage = useCallback(async (startCursor: string | null) => {
    setLoading(true);
    try {
      const url = new URL("/api/nex-video/feed", window.location.origin);
      if (startCursor) url.searchParams.set("cursor", startCursor);
      url.searchParams.set("limit", "10");
      const r = await fetch(url.toString(), { cache: "no-store" });
      const j = await r.json();
      if (r.ok && Array.isArray(j.videos)) {
        setVideos((prev) => [...prev, ...j.videos]);
        setCursor(j.next_cursor ?? null);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen && videos.length === 0 && !loading) void loadPage(null);
    if (!isOpen) {
      setIndex(0);
      setMuted(true);
      prevIndexRef.current = -1;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !loading && cursor && index >= videos.length - 2) void loadPage(cursor);
  }, [index, videos.length, cursor, loading, loadPage, isOpen]);

  const postImpression = useCallback(async (v: FeedVideo, watchedMs: number, unmuted: boolean) => {
    await fetch("/api/nex-video/impression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        media_id: v.media_id,
        viewer_id: sessionRef.current,
        session_id: sessionRef.current,
        watched_ms: watchedMs,
        unmuted,
      }),
      keepalive: true,
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const prev = prevIndexRef.current;
    if (prev >= 0 && prev < videos.length) {
      const watched = Math.max(0, Date.now() - impressionStartRef.current);
      void postImpression(videos[prev], watched, !muted);
    }
    impressionStartRef.current = Date.now();
    prevIndexRef.current = index;
    const v = videoRef.current;
    if (v) { v.currentTime = 0; v.play().catch(() => {}); }
  }, [index, videos, muted, postImpression, isOpen]);

  const goNext = useCallback(() => setIndex((i) => Math.min(i + 1, videos.length - 1)), [videos.length]);
  const goPrev = useCallback(() => setIndex((i) => Math.max(i - 1, 0)), []);

  // Swipe / wheel handlers · Philip 2026-08-27 v6 fix (native listeners).
  //
  // Earlier attempts used React synthetic event handlers on framer-motion's
  // motion.div. That did NOT work reliably (framer-motion swallowed some
  // handlers · React does not attach touch/wheel with { passive: false } by
  // default so preventDefault has no effect on scroll consumption). This v6
  // attaches NATIVE listeners to a plain div ref with { passive: false }
  // + explicit preventDefault, which is the guaranteed way.
  const swipeContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const el = swipeContainerRef.current;
    if (!el) return;

    let touchStartY: number | null = null;
    let touchStartTime = 0;
    let pointerStartY: number | null = null;
    let pointerIdActive: number | null = null;
    let wheelAccum = 0;
    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    const consume = (dy: number) => {
      if (dy < -30) goNext();
      else if (dy > 30) goPrev();
    };

    const onTouchStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      touchStartY = t.clientY;
      touchStartTime = Date.now();
    };
    const onTouchMove = (e: TouchEvent) => {
      // Prevent browser scroll · we own vertical drag
      if (touchStartY != null) e.preventDefault();
    };
    const onTouchEnd = (e: TouchEvent) => {
      if (touchStartY == null) return;
      const t = e.changedTouches[0];
      if (!t) { touchStartY = null; return; }
      const dy = t.clientY - touchStartY;
      const dt = Date.now() - touchStartTime;
      touchStartY = null;
      if (Math.abs(dy) < 30 && dt > 300) return;
      consume(dy);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      wheelAccum += e.deltaY;
      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        consume(wheelAccum);
        wheelAccum = 0;
      }, 80);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") return;
      pointerStartY = e.clientY;
      pointerIdActive = e.pointerId;
    };
    const onPointerUp = (e: PointerEvent) => {
      if (pointerIdActive == null || e.pointerId !== pointerIdActive) return;
      const dy = e.clientY - (pointerStartY ?? e.clientY);
      pointerStartY = null;
      pointerIdActive = null;
      consume(dy);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown" || e.key === "j") goNext();
      else if (e.key === "ArrowUp" || e.key === "k") goPrev();
      else if (e.key === "m") setMuted((m) => !m);
    };

    // { passive: false } is required so preventDefault actually blocks the
    // browser's default scroll behaviour.
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove",  onTouchMove,  { passive: false });
    el.addEventListener("touchend",   onTouchEnd,   { passive: false });
    el.addEventListener("wheel",      onWheel,      { passive: false });
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointerup",   onPointerUp);
    window.addEventListener("keydown", onKeyDown);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove",  onTouchMove);
      el.removeEventListener("touchend",   onTouchEnd);
      el.removeEventListener("wheel",      onWheel);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointerup",   onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      if (wheelTimer) clearTimeout(wheelTimer);
    };
  }, [isOpen, goNext, goPrev, onClose]);

  const current = videos[index];

  return (
    <AnimatePresence>
      {isOpen && (
        <NexFrameViewport background="#000" onBackdropClick={onClose}>
          {/* Content sits INSIDE the canonical inner viewport (NEX_INNER_VIEWPORT).
              Fills 100% width/height of that viewport · never overlaps the frame. */}
          <motion.div
            ref={swipeContainerRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            onClick={(e) => {
              // Tap = unmute · touch swipes fire touchstart+touchmove+touchend
              // but NOT click (browser suppresses click when pointer moves).
              // stopPropagation prevents the backdrop close handler above.
              e.stopPropagation();
              setMuted((m) => !m);
            }}
            style={{
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              background: "#000",
              cursor: "pointer",
              touchAction: "none",       // stop browser eating vertical swipe as scroll
              userSelect: "none",        // stop text-selection during drag
              WebkitUserSelect: "none",
              overscrollBehavior: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {loading && videos.length === 0 && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "rgba(255,255,255,0.55)", fontSize: 12,
              }}>
                Loading NEX Live…
              </div>
            )}

            {!loading && videos.length === 0 && (
              <div style={{
                position: "absolute", inset: 0,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "#fff", padding: 16, textAlign: "center",
              }}>
                <p style={{ marginBottom: 10, fontSize: 13, opacity: 0.9 }}>No public videos yet.</p>
                <a
                  href="/nex-video/create"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    display: "inline-block", padding: "7px 14px",
                    borderRadius: 999, background: "#fff", color: "#000",
                    fontSize: 11, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  ＋ Create a video
                </a>
              </div>
            )}

            {current && (
              <>
                {/* THE video · fills viewport edge-to-edge · object-fit: cover
                    ensures no white/empty margins even if the source aspect
                    differs from the viewport aspect.
                    pointerEvents: none is CRITICAL · keeps touch/wheel events
                    flowing to the swipe container. Tap-to-unmute is handled
                    by a separate overlay div below. */}
                <video
                  ref={videoRef}
                  key={current.media_id}
                  src={current.playback_url ?? undefined}
                  poster={current.poster_url ?? undefined}
                  autoPlay
                  playsInline
                  muted={muted}
                  loop
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    background: "#000",
                    pointerEvents: "none",
                  }}
                />


                {/* Top gradient · improves chip contrast */}
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: "18%",
                  background: "linear-gradient(180deg, rgba(0,0,0,0.55), rgba(0,0,0,0))",
                  pointerEvents: "none",
                }} />

                {/* LIVE identity chip · top-center */}
                <div style={{
                  position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
                  display: "flex", alignItems: "center", gap: 5,
                  padding: "3px 9px", borderRadius: 999,
                  background: "rgba(220,38,38,0.92)", color: "#fff",
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.1,
                  zIndex: 3, pointerEvents: "none",
                }}>
                  <span style={{
                    width: 5, height: 5, borderRadius: 999, background: "#fff",
                    boxShadow: "0 0 5px rgba(255,255,255,0.9)",
                    animation: "nex-live-stage-pulse 1.4s ease-in-out infinite",
                  }} />
                  LIVE
                </div>

                {/* Position indicator · top-right */}
                <div style={{
                  position: "absolute", top: 10, right: 10,
                  fontSize: 9, color: "rgba(255,255,255,0.7)", letterSpacing: 0.4,
                  zIndex: 3, pointerEvents: "none",
                }}>
                  {index + 1} / {videos.length}{cursor ? "+" : ""}
                </div>

                {muted && (
                  <div style={{
                    position: "absolute", top: 34, left: "50%", transform: "translateX(-50%)",
                    padding: "2px 8px", borderRadius: 999,
                    background: "rgba(0,0,0,0.55)", color: "rgba(255,255,255,0.85)",
                    fontSize: 9, letterSpacing: 0.3,
                    pointerEvents: "none", zIndex: 3,
                  }}>
                    tap to unmute
                  </div>
                )}

                {/* Bottom gradient + info */}
                <div style={{
                  position: "absolute", bottom: 0, left: 0, right: 0, height: "35%",
                  background: "linear-gradient(0deg, rgba(0,0,0,0.72), rgba(0,0,0,0))",
                  pointerEvents: "none",
                }} />
                <div style={{
                  position: "absolute", bottom: 10, left: 10, right: 10,
                  color: "#fff", zIndex: 3, pointerEvents: "none",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.95 }}>
                    @{current.owner_id.slice(0, 22)}
                  </div>
                  {current.title && (
                    <div style={{ marginTop: 2, fontSize: 11, fontWeight: 600 }}>{current.title}</div>
                  )}
                  {current.description && (
                    <div style={{
                      marginTop: 2, fontSize: 9, opacity: 0.82, lineHeight: 1.25,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {current.description}
                    </div>
                  )}
                </div>

                {index === 0 && videos.length > 1 && (
                  <div style={{
                    position: "absolute", bottom: "35%", left: "50%",
                    transform: "translateX(-50%)",
                    fontSize: 9, opacity: 0.55, color: "#fff",
                    pointerEvents: "none", zIndex: 3,
                    animation: "nex-live-swipe-hint 3s ease-out",
                  }}>
                    ↑ swipe for next
                  </div>
                )}
              </>
            )}
          </motion.div>

          <style>{`
            @keyframes nex-live-stage-pulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50%      { opacity: 0.4; transform: scale(1.3); }
            }
            @keyframes nex-live-swipe-hint {
              0%   { opacity: 0; transform: translateX(-50%) translateY(8px); }
              20%  { opacity: 0.8; transform: translateX(-50%) translateY(0); }
              80%  { opacity: 0.55; }
              100% { opacity: 0; }
            }
          `}</style>
        </NexFrameViewport>
      )}
    </AnimatePresence>
  );
}
