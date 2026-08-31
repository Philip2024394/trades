"use client";

// NEX LIVE surface · client · Philip 2026-08-27 (prototype).
//
// Fetches ONE real video from the shipped /api/nex-video/feed (Stage 2 · V1)
// and plays it inside a dark NEX-styled surface. Reuses the exact same
// playback pipeline as /nex-video. No parallel storage/media/broadcaster
// system created.
//
// When no public video exists yet, the surface shows an empty state that
// links to /nex-video/create so the operator can seed one and immediately
// see it here.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

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

export function NexLiveClient() {
  const [video, setVideo] = useState<FeedVideo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Unmount guard · Philip 2026-08-30. NexLiveClient was designed as a
  // standalone-route component where full-page unmount cleaned up in-flight
  // fetches. Now that it renders as a NEX shell artifact, users can switch
  // artifact mid-fetch · without this ref, the fetch resolves against a
  // torn-down component and React warns about state-update-before-mounted.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const r = await fetch("/api/nex-video/feed?limit=1", { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? `HTTP ${r.status}`);
      const first = Array.isArray(j.videos) && j.videos.length > 0 ? j.videos[0] : null;
      if (mountedRef.current) setVideo(first);
    } catch (e) {
      if (mountedRef.current) setError((e as Error).message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="fixed inset-0 flex flex-col bg-black text-white overflow-hidden select-none">
      {/* Top chrome · NEX identity + LIVE badge + close */}
      <header className="relative z-20 flex items-center justify-between p-4">
        <Link
          href="/nexapp"
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur hover:bg-white/20"
        >
          ← NEX
        </Link>
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full bg-red-500"
            style={{ boxShadow: "0 0 8px rgba(239,68,68,0.9)", animation: "nex-live-dot 1.4s ease-in-out infinite" }}
          />
          <span className="text-xs font-bold tracking-widest text-red-400">NEX · LIVE</span>
        </div>
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          className="rounded-full bg-white/10 px-3 py-1.5 text-sm backdrop-blur hover:bg-white/20"
          aria-label={muted ? "Unmute" : "Mute"}
        >
          {muted ? "🔇" : "🔊"}
        </button>
      </header>

      {/* Video stage */}
      <div className="relative flex-1 flex items-center justify-center bg-black">
        {loading && (
          <div className="text-center text-slate-400">
            <p className="text-lg">Loading NEX Live surface…</p>
          </div>
        )}

        {!loading && error && (
          <div className="text-center max-w-md p-6">
            <p className="mb-2 text-lg text-rose-400">Could not reach the feed.</p>
            <p className="text-sm text-slate-400">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 rounded bg-white/10 px-4 py-2 text-sm hover:bg-white/20"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && !video && (
          <div className="text-center max-w-md p-6">
            <p className="mb-3 text-lg">The NEX LIVE surface is ready.</p>
            <p className="mb-6 text-sm text-slate-400">
              No public NEX videos yet. Record one and this surface will play it back through the
              real Media Foundation.
            </p>
            <Link
              href="/nex-video/create"
              className="inline-block rounded-full bg-white text-black px-5 py-2.5 text-sm font-semibold hover:bg-slate-200"
            >
              ＋ Create the first NEX Video
            </Link>
          </div>
        )}

        {!loading && !error && video && video.playback_url && (
          <video
            ref={videoRef}
            key={video.media_id}
            src={video.playback_url}
            poster={video.poster_url ?? undefined}
            autoPlay
            playsInline
            loop
            muted={muted}
            controls={false}
            className="max-h-full max-w-full object-contain"
            onClick={() => setMuted((m) => !m)}
          />
        )}

        {!loading && !error && video && !video.playback_url && (
          <div className="text-center max-w-md p-6">
            <p className="mb-2 text-lg text-amber-400">Video found, but no playback URL.</p>
            <p className="text-sm text-slate-400">
              The storage backend could not sign a playback URL for the newest public video. Check
              <code className="mx-1 rounded bg-white/10 px-1">NEX_OBJECT_BACKEND</code> and R2 credentials.
            </p>
          </div>
        )}
      </div>

      {/* Bottom info + provenance card */}
      {video && (
        <footer className="relative z-10 p-4 bg-gradient-to-t from-black via-black/70 to-transparent">
          <div className="mx-auto max-w-3xl">
            <div className="text-xs text-slate-400">
              @{video.owner_id.slice(0, 28)} · uploaded {new Date(video.uploaded_at).toLocaleString()}
            </div>
            {video.title && <div className="mt-1 text-base font-semibold">{video.title}</div>}
            {video.description && <div className="mt-1 text-sm text-slate-300 line-clamp-2">{video.description}</div>}
            <div className="mt-2 text-[10px] text-slate-500 uppercase tracking-wider">
              NEX Media Foundation · media_id={video.media_id.slice(0, 8)} · {video.mime_type}
              {video.duration_ms ? ` · ${(video.duration_ms / 1000).toFixed(1)}s` : ""}
              {video.width_px && video.height_px ? ` · ${video.width_px}x${video.height_px}` : ""}
            </div>
          </div>
        </footer>
      )}

      <style>{`
        @keyframes nex-live-dot {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%      { opacity: 0.4; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
}
