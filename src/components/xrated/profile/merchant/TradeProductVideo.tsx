"use client";

// TradeProductVideo — trades-themed port of Hammerex's ProductVideo.
//
// Reads product.video_url from hammerex_xrated_products. When the URL
// is a YouTube link (watch / youtu.be / shorts / embed), renders a
// click-to-play facade using YouTube's auto-generated poster
// (img.youtube.com/vi/<id>/hqdefault.jpg) — no iframe until the user
// opts in, so the PDP stays light. Non-YouTube URLs fall back to a
// plain outbound "Watch product video" link.
//
// The trades schema has no video_cover_url column (unlike Hammerex),
// so the facade poster ALWAYS comes from YouTube's own CDN. If we
// later add merchant-supplied cover art, extend the component to
// prefer that source before falling back to YouTube's poster.

import { useState } from "react";

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = u.pathname.replace(/^\//, "").split("/")[0];
      return id || null;
    }
    if (host.endsWith("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;
      const parts = u.pathname.split("/").filter(Boolean);
      const idx = parts.findIndex((p) => p === "shorts" || p === "embed");
      if (idx >= 0 && parts[idx + 1]) return parts[idx + 1];
    }
    return null;
  } catch {
    return null;
  }
}

function YouTubePlayBadge() {
  return (
    <span
      aria-hidden
      className="pointer-events-none grid h-16 w-24 place-items-center rounded-2xl bg-[#FF0000] shadow-[0_6px_24px_rgba(0,0,0,0.45)] transition-transform group-hover:scale-105"
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="#fff" aria-hidden>
        <path d="M8 5v14l11-7z" />
      </svg>
    </span>
  );
}

export function TradeProductVideo({
  url,
  title
}: {
  url: string | null | undefined;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);

  if (!url) return null;
  const id = extractYouTubeId(url);

  if (!id) {
    return (
      <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-full border border-[#1B1A17]/10 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-700 hover:border-amber-400"
        >
          ▶ Watch product video
        </a>
      </section>
    );
  }

  const posterUrl = `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  const embed = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1&autoplay=1`;
  const showFacade = !playing;

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8 md:px-8">
      <div className="flex items-center gap-2 pb-3">
        <span
          aria-hidden
          className="grid h-6 w-9 place-items-center rounded-md bg-[#FF0000] text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
        <h2 className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-700">
          Watch — {title}
        </h2>
      </div>
      <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl border border-[#1B1A17]/10 bg-black">
        {showFacade ? (
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${title} video`}
            className="group relative block h-full w-full"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={posterUrl}
              alt={`${title} — video cover`}
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
            />
            <span className="absolute inset-0 grid place-items-center">
              <YouTubePlayBadge />
            </span>
          </button>
        ) : (
          <iframe
            src={embed}
            title={`${title} — product video`}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="h-full w-full"
          />
        )}
      </div>
    </section>
  );
}
