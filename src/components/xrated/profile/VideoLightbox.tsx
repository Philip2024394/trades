"use client";

// Click-to-enlarge YouTube lightbox used in the About + Video section.
//
// The compact thumbnail on the profile lives in the parent component;
// this only handles the modal lifecycle:
//  - click thumbnail → open at near-fullscreen, iframe autoplays
//  - ESC or backdrop click → close
//  - body scroll locks while open
//
// YouTube URLs supported: watch?v= / youtu.be / shorts.

import { useEffect, useState } from "react";

// True when the URL points at our self-hosted Supabase Storage rather
// than YouTube — drives whether we render <video> or <iframe>.
function isSelfHosted(url: string): boolean {
  return /^https:\/\/[^/]*supabase\.co\/storage\//.test(url);
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const shorts = u.pathname.match(/^\/shorts\/([^/]+)/);
      if (shorts) return shorts[1];
      const embed = u.pathname.match(/^\/embed\/([^/]+)/);
      if (embed) return embed[1];
    }
  } catch {
    // ignore — not a parseable URL
  }
  return null;
}

export function VideoLightbox({
  videoUrl,
  coverUrl,
  altText
}: {
  videoUrl: string;
  coverUrl: string | null;
  altText: string;
}) {
  const [open, setOpen] = useState(false);
  const selfHosted = isSelfHosted(videoUrl);
  const id = selfHosted ? null : youtubeId(videoUrl);
  // Adaptive aspect — the lightbox container shape-fits the actual
  // video on `loadedmetadata`. Portrait phone clips render at 9:16,
  // GoPro landscape at 16:9, square at 1:1 — no black bars regardless.
  // YouTube embeds are stuck on 16/9 because cross-origin iframes
  // don't expose dimensions.
  const [videoAspect, setVideoAspect] = useState<number | null>(null);
  function handleMetadata(e: React.SyntheticEvent<HTMLVideoElement>) {
    const v = e.currentTarget;
    if (v.videoWidth && v.videoHeight) {
      setVideoAspect(v.videoWidth / v.videoHeight);
    }
  }

  // Lock body scroll while the lightbox is open + close on ESC.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!selfHosted && !id) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Play introduction video"
        className="group relative block aspect-video w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-black/5 transition hover:ring-[#FFB300]"
      >
        {coverUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={coverUrl}
            alt={altText}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : id ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
            alt={altText}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
        ) : (
          <div className="h-full w-full bg-neutral-900" />
        )}
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 shadow-lg ring-1 ring-black/10 transition group-hover:scale-110 sm:h-14 sm:w-14">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden="true">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
        <span
          aria-hidden="true"
          className="absolute bottom-2 right-2 rounded-md bg-black/65 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-white"
        >
          ≤ 60s
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Video player"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-5xl"
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close video"
              className="absolute -top-12 right-0 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div
              className="mx-auto overflow-hidden rounded-2xl bg-black shadow-2xl"
              style={{
                // Native aspect once metadata loads; default to 16/9
                // pre-load and for cross-origin YouTube embeds. Cap at
                // 85vh so portrait clips don't overflow the viewport
                // and `w-auto` lets the width follow from the height.
                aspectRatio: videoAspect ?? 16 / 9,
                width: "auto",
                height: "auto",
                maxWidth: "100%",
                maxHeight: "85vh"
              }}
            >
              {selfHosted ? (
                /* eslint-disable-next-line jsx-a11y/media-has-caption */
                <video
                  src={videoUrl}
                  poster={coverUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  onLoadedMetadata={handleMetadata}
                  className="h-full w-full"
                />
              ) : (
                <iframe
                  src={`https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`}
                  title={altText}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  className="h-full w-full"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
