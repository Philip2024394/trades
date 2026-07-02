"use client";

// MachineImageCarousel — interactive main image + 3 thumbnails + a
// yellow indicator bar that slides to the active thumbnail. Fills any
// missing gallery slots with the main image so every machine always
// shows the 3-thumbnail row (demo-friendly + graceful for merchants
// who haven't uploaded extras yet).
//
// Clicking the main image opens the existing yellow-rimmed lightbox
// (PlantMachineImageModal handles that). Clicking a thumbnail swaps
// the main image and slides the indicator; the indicator uses CSS
// transform for a smooth 220ms transition.

import { useCallback, useEffect, useState } from "react";

const THUMB_COUNT = 3;

export function MachineImageCarousel({
  mainImage,
  galleryUrls,
  videoUrl,
  label,
  buyNowSalePricePence,
  buyNowSaleYear,
  buyNowWaHref,
  merchantName
}: {
  mainImage: string;
  galleryUrls: string[];
  videoUrl?: string;
  label: string;
  buyNowSalePricePence?: number | null;
  buyNowSaleYear?: number | null;
  buyNowWaHref?: string | null;
  merchantName?: string;
}) {
  const [lightbox, setLightbox] = useState<string | null>(null);
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

  const hasVideo = Boolean(videoUrl && videoUrl.trim().length > 0);
  const open = useCallback((url: string) => setLightbox(url), []);
  // Build the visible slot array: prefer merchant gallery, pad with
  // main image so we always have THUMB_COUNT slots to iterate.
  const slots: string[] = [];
  const preferred = [mainImage, ...galleryUrls.filter((u) => u && u !== mainImage)];
  for (let i = 0; i < THUMB_COUNT; i++) {
    slots.push(preferred[i] ?? mainImage);
  }

  const [active, setActive] = useState(0);

  // If mainImage or gallery changes (SSR nav to another category),
  // reset to slot 0.
  useEffect(() => {
    setActive(0);
  }, [mainImage, galleryUrls.join("|")]);

  const currentUrl = slots[active] ?? mainImage;

  return (
    <div className="flex flex-col gap-3">
      {/* Main image — click opens lightbox. Eye icon top-right. */}
      <button
        type="button"
        onClick={() => open(currentUrl)}
        className="group relative grid aspect-[4/3] w-full place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 transition hover:border-[#FFB300]"
        aria-label={`Open ${label} image`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={currentUrl}
          alt={label}
          className="h-full w-full object-contain p-4 transition duration-300"
          key={currentUrl}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full shadow-lg transition group-hover:scale-110"
          style={{ background: "#0A0A0A" }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#FFB300"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </span>
      </button>

      {/* Yellow bar indicator — one segment per slot (3 images + optional
       *  video). Active segment is full yellow with subtle scale +
       *  shadow; inactive are muted. */}
      <div className="flex gap-1.5 px-1" aria-hidden="true">
        {slots.map((_, i) => (
          <span
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-200"
            style={{
              background: i === active ? "#FFB300" : "#E5E7EB",
              boxShadow:
                i === active ? "0 2px 6px rgba(255,179,0,0.35)" : undefined,
              transform: i === active ? "scaleY(1.2)" : "scaleY(1)"
            }}
          />
        ))}
        {hasVideo && (
          <span
            className="h-1.5 flex-1 rounded-full transition-all duration-200"
            style={{ background: "#E5E7EB" }}
          />
        )}
      </div>

      {/* Thumbnails — 3 image slots + optional video slot, all on one line */}
      <ul
        className={hasVideo ? "grid grid-cols-4 gap-2" : "grid grid-cols-3 gap-2"}
      >
        {slots.map((u, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => setActive(i)}
              className="group grid aspect-square w-full place-items-center overflow-hidden rounded-lg border-2 bg-neutral-50 transition"
              style={{
                borderColor: i === active ? "#FFB300" : "#E5E7EB"
              }}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === active}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={u}
                alt=""
                loading="lazy"
                className="h-full w-full object-contain p-1 transition group-hover:scale-105"
              />
            </button>
          </li>
        ))}
        {hasVideo && (
          <li>
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="group relative grid aspect-square w-full place-items-center overflow-hidden rounded-lg border-2 border-neutral-200 bg-neutral-900 transition hover:border-[#FFB300]"
              aria-label="Play walkaround video"
            >
              {/* Poster = main image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mainImage}
                alt=""
                loading="lazy"
                className="absolute inset-0 h-full w-full object-contain opacity-70 transition group-hover:opacity-90"
              />
              <span
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.15) 50%, rgba(0,0,0,0.55) 100%)"
                }}
                aria-hidden="true"
              />
              <span
                className="relative grid h-10 w-10 place-items-center rounded-full shadow-lg transition group-hover:scale-110"
                style={{ background: "#FFB300" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#0A0A0A" aria-hidden="true">
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

      {videoOpen && hasVideo && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} video walkaround`}
          onClick={() => setVideoOpen(false)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-4xl overflow-hidden rounded-2xl bg-black shadow-2xl"
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
              poster={mainImage}
              className="mx-auto block max-h-[80vh] w-auto max-w-full"
            />
          </div>
        </div>
      )}

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${label} photo`}
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/90 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-full w-full max-w-6xl flex-col gap-3 sm:flex-row"
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-2 top-2 z-10 grid h-11 w-11 place-items-center rounded-full text-[24px] font-extrabold transition hover:opacity-90"
              style={{ background: "#0A0A0A", color: "#FFB300" }}
              aria-label="Close"
            >
              ×
            </button>
            {/* Image — full available area */}
            <div className="grid min-h-0 flex-1 place-items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={lightbox}
                alt={label}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            {/* Right-side buy-now panel — only when for-sale */}
            {buyNowSalePricePence && buyNowSalePricePence > 0 && (
              <aside className="flex shrink-0 flex-col justify-end gap-3 rounded-2xl bg-white p-4 sm:w-80 sm:justify-center">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[#FFB300]">
                  Also for sale
                </p>
                <h3 className="text-2xl font-extrabold text-neutral-900">{label}</h3>
                {buyNowSaleYear && (
                  <p className="text-[12px] font-bold text-neutral-500">Year: {buyNowSaleYear}</p>
                )}
                <p className="text-[28px] font-extrabold text-neutral-900">
                  £{(buyNowSalePricePence / 100).toLocaleString()}
                </p>
                <a
                  href={
                    buyNowWaHref
                      ? `${buyNowWaHref}?text=${encodeURIComponent(
                          `Hi ${merchantName ?? ""}, I'd like to buy the ${label}${buyNowSaleYear ? ` (${buyNowSaleYear})` : ""}. Advertised at £${(buyNowSalePricePence / 100).toLocaleString()}. Please send purchase details.`
                        )}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-extrabold uppercase tracking-widest text-black transition hover:opacity-90"
                  style={{ background: "#FFB300" }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="9" cy="21" r="1" />
                    <circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  Buy Now
                </a>
              </aside>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
