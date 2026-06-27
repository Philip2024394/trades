"use client";

// Thumbnail strip with click-to-enlarge for Yard post attachments.
// Renders up to 3 image thumbs inline (designed to sit beside the
// Reply / Open thread action row). Tapping a thumb opens a full-screen
// lightbox over the page; Esc / backdrop / X dismiss; left/right
// arrows step between attached images.

import { useCallback, useEffect, useState } from "react";

export function YardImageThumbs({
  urls,
  alt = ""
}: {
  urls: string[];
  alt?: string;
}) {
  const thumbs = urls.slice(0, 3);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const isOpen = openIdx !== null;

  const close = useCallback(() => setOpenIdx(null), []);
  const next = useCallback(
    () =>
      setOpenIdx((i) => (i === null ? null : (i + 1) % thumbs.length)),
    [thumbs.length]
  );
  const prev = useCallback(
    () =>
      setOpenIdx((i) =>
        i === null ? null : (i - 1 + thumbs.length) % thumbs.length
      ),
    [thumbs.length]
  );

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [isOpen, close, next, prev]);

  if (thumbs.length === 0) return null;

  return (
    <>
      <ul className="flex shrink-0 items-center gap-1.5">
        {thumbs.map((url, i) => (
          <li key={`${url}-${i}`}>
            <button
              type="button"
              onClick={() => setOpenIdx(i)}
              aria-label={`Open attached image ${i + 1} of ${thumbs.length}`}
              className="block h-12 w-12 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100 transition hover:border-neutral-400 hover:ring-2 hover:ring-[#FFB300]/40 sm:h-14 sm:w-14"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </button>
          </li>
        ))}
      </ul>

      {isOpen && openIdx !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 p-4"
          onClick={close}
        >
          {/* Close button — always-visible top-right. */}
          <button
            type="button"
            onClick={close}
            aria-label="Close image"
            className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-5 sm:top-5"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          {/* Prev / next arrows — only if more than one. */}
          {thumbs.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:left-5"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next image"
                className="absolute right-3 top-1/2 z-10 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-5"
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </>
          )}

          {/* Image — click on the image itself doesn't close (only the
              backdrop does). */}
          <div onClick={(e) => e.stopPropagation()} className="max-h-[92vh] max-w-5xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbs[openIdx]}
              alt={alt}
              className="max-h-[92vh] max-w-full object-contain"
            />
            {thumbs.length > 1 && (
              <p className="mt-3 text-center text-[12px] font-bold text-white/70">
                {openIdx + 1} / {thumbs.length}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

export default YardImageThumbs;
