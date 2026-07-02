"use client";

// MachineGalleryStrip — thumbnail row for the machine detail page.
// Renders up to 4 image thumbnails + 1 video thumbnail. Clicking an
// image opens the same yellow-rimmed image modal; clicking the video
// opens a video-player modal with the Supabase-hosted MP4 inline.

import { useEffect, useState } from "react";

export function MachineGalleryStrip({
  imageUrls,
  videoUrl,
  posterUrl,
  label
}: {
  imageUrls: string[];
  videoUrl?: string;
  posterUrl?: string;
  label: string;
}) {
  const [lightbox, setLightbox] = useState<{ kind: "image"; url: string } | null>(null);
  const [videoOpen, setVideoOpen] = useState(false);

  useEffect(() => {
    if (!lightbox && !videoOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setLightbox(null);
        setVideoOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [lightbox, videoOpen]);

  // Deduplicate image URLs and cap at 4.
  const imgs = Array.from(new Set(imageUrls.filter(Boolean))).slice(0, 4);
  const hasVideo = Boolean(videoUrl && videoUrl.trim().length > 0);

  if (imgs.length === 0 && !hasVideo) return null;

  return (
    <>
      <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {imgs.map((u, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setLightbox({ kind: "image", url: u })}
              className="grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50 transition hover:border-[#FFB300]"
              aria-label={`View photo ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain"
              />
            </button>
          </li>
        ))}
        {hasVideo && (
          <li>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border border-neutral-200 bg-neutral-900 transition hover:border-[#FFB300]"
              aria-label="Play walkaround video"
            >
              {posterUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={posterUrl}
                  alt=""
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain opacity-70 transition group-hover:opacity-90"
                />
              )}
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)"
                }}
                aria-hidden="true"
              />
              <span
                className="relative grid h-11 w-11 place-items-center rounded-full shadow-lg transition group-hover:scale-110"
                style={{ background: "#FFB300" }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden="true">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
              <span
                className="absolute bottom-1 left-0 right-0 text-center text-[8px] font-extrabold uppercase tracking-widest text-white"
                aria-hidden="true"
              >
                Video
              </span>
            </button>
          </li>
        )}
      </ul>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} photo`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white p-4 shadow-2xl"
            style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.45)" }}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
              style={{ background: "#0A0A0A", color: "#FFB300" }}
              aria-label="Close"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.url}
              alt={label}
              className="mx-auto block max-h-[80vh] w-auto max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {videoOpen && hasVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} video walkaround`}
          onClick={() => setVideoOpen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-2xl"
            style={{ boxShadow: "0 0 0 4px #FFB300, 0 20px 60px rgba(0,0,0,0.6)" }}
          >
            <button
              type="button"
              onClick={() => setVideoOpen(false)}
              className="absolute right-3 top-3 z-10 grid h-10 w-10 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
              style={{ background: "#0A0A0A", color: "#FFB300" }}
              aria-label="Close video"
            >
              ×
            </button>
            <video
              src={videoUrl}
              controls
              autoPlay
              playsInline
              poster={posterUrl}
              className="mx-auto block max-h-[80vh] w-auto max-w-full"
            />
          </div>
        </div>
      )}
    </>
  );
}
