"use client";

// FaqImageLightbox — yellow ring-4 modal for FAQ reference images.
//
// The dedicated FAQ page renders each FAQ's images as a tappable grid.
// Tapping any thumbnail opens this lightbox with prev/next nav between
// images attached to the SAME FAQ (we never cross FAQ boundaries — a
// customer who's on FAQ-001 doesn't want to flick into FAQ-007 by
// accident). ESC closes. Tap outside closes. Body scroll locked.

import { useEffect, useState } from "react";
import type { HammerexXratedFaqImage } from "@/lib/supabase";

export function FaqImageLightbox({
  images,
  refCode
}: {
  images: HammerexXratedFaqImage[];
  refCode: string;
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  useEffect(() => {
    if (openIndex === null) return;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenIndex(null);
      if (e.key === "ArrowRight") setOpenIndex((i) => (i === null ? null : Math.min(images.length - 1, i + 1)));
      if (e.key === "ArrowLeft") setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [openIndex, images.length]);

  if (images.length === 0) return null;

  return (
    <>
      <ul
        className={`grid gap-2 ${
          images.length === 1
            ? "grid-cols-1"
            : images.length === 2
              ? "grid-cols-2"
              : "grid-cols-2 sm:grid-cols-3"
        }`}
      >
        {images.map((img, i) => (
          <li key={img.id}>
            <button
              type="button"
              onClick={() => setOpenIndex(i)}
              className="group block w-full overflow-hidden rounded-xl border border-neutral-200 bg-white text-left transition hover:border-[#FFB300] hover:shadow-md"
              aria-label={`Enlarge ${img.title}`}
            >
              <span className="block aspect-[4/3] w-full overflow-hidden bg-neutral-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.image_url}
                  alt={img.alt_text ?? img.title}
                  className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                  loading="lazy"
                />
              </span>
              <span className="block px-3 py-2">
                <span className="block text-[13px] font-bold text-neutral-900 line-clamp-2">
                  {img.title}
                </span>
                <span className="mt-0.5 block text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
                  {refCode} &middot; {i + 1} / {images.length}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {openIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
          onClick={() => setOpenIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`${refCode} reference image`}
        >
          <div
            className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{ outline: "4px solid #FFB300", outlineOffset: "-4px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(null)}
              aria-label="Close"
              className="absolute right-2 top-2 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/80 text-white transition hover:bg-black"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="bg-neutral-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={images[openIndex].image_url}
                alt={images[openIndex].alt_text ?? images[openIndex].title}
                className="block max-h-[70vh] w-full object-contain"
              />
            </div>

            <div className="flex items-center justify-between gap-3 p-4">
              <button
                type="button"
                onClick={() => setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)))}
                disabled={openIndex === 0}
                aria-label="Previous image"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 transition hover:border-[#FFB300] disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <div className="min-w-0 flex-1 text-center">
                <p className="text-sm font-extrabold text-neutral-900 line-clamp-1">
                  {images[openIndex].title}
                </p>
                <p className="mt-0.5 text-[10px] font-extrabold uppercase tracking-[0.22em] text-neutral-500">
                  {refCode} &middot; {openIndex + 1} / {images.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setOpenIndex((i) =>
                    i === null ? null : Math.min(images.length - 1, i + 1)
                  )
                }
                disabled={openIndex === images.length - 1}
                aria-label="Next image"
                className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-900 transition hover:border-[#FFB300] disabled:opacity-30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
