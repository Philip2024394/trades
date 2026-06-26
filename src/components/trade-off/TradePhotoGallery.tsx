"use client";

import { useCallback, useEffect, useState } from "react";

export function TradePhotoGallery({ photos, name }: { photos: string[]; name: string }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const close = useCallback(() => setOpenIndex(null), []);
  const prev = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  }, [photos.length]);
  const next = useCallback(() => {
    setOpenIndex((i) => (i === null ? null : (i + 1) % photos.length));
  }, [photos.length]);

  useEffect(() => {
    if (openIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [openIndex, close, prev, next]);

  if (!photos || photos.length === 0) return null;

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((src, i) => (
          <li key={`${src}-${i}`}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group block aspect-square w-full overflow-hidden rounded-xl border border-brand-line bg-neutral-100 transition hover:border-[#FFB300]"
              aria-label={`Open photo ${i + 1} of ${photos.length}`}
            >
              <img
                src={src}
                alt={`${name} — photo ${i + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition group-hover:scale-[1.02]"
              />
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${name} photo viewer`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90"
          onClick={close}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            aria-label="Close"
            className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:border-brand-accent hover:text-brand-accent"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prev();
                }}
                aria-label="Previous photo"
                className="absolute left-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:border-brand-accent hover:text-brand-accent"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  next();
                }}
                aria-label="Next photo"
                className="absolute right-4 top-1/2 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition hover:border-brand-accent hover:text-brand-accent"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </>
          )}

          <img
            src={photos[openIndex]}
            alt={`${name} — photo ${openIndex + 1} of ${photos.length}`}
            className="max-h-[90vh] max-w-[92vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <p className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
              {openIndex + 1} / {photos.length}
            </p>
          )}
        </div>
      )}
    </>
  );
}
