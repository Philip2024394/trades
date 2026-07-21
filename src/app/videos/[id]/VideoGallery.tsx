"use client";

// VideoGallery — "What this technique can look like" section.
//
// Layout: black container on the LEFT holding the primary image
// (clickable to enlarge in a lightbox), list of finish-type chips
// on the RIGHT so users see what's achievable + what to ask for.
//
// Lightbox: dark backdrop, close X, Escape key, backdrop click.
// If multiple images, thumbnail strip appears below the primary
// so all images are reachable.

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, ArrowRight, Maximize2, ChevronLeft, ChevronRight, Info } from "lucide-react";

export type GalleryImage = {
  id:         string;
  image_url:  string;
  caption:    string | null;
  alt_text:   string | null;
  credit:     string | null;
  disclaimer: string | null;
  sort_order: number;
  position?:  "left" | "right" | null;
};

export type FinishTopic = {
  slug:         string;
  display_name: string;
  description:  string | null;
};

type Props = {
  images:      GalleryImage[];
  finishes:    FinishTopic[];
  tradeSlug:   string | null;
  eyebrow?:    string;
  heading?:    string;
};

export function VideoGallery({
  images,
  finishes,
  tradeSlug,
  eyebrow = "Example finishes you can ask for",
  heading = "What this technique can look like"
}: Props) {
  // Split left (carousel) vs right (aside image) by position column
  const leftImages   = images.filter(g => (g.position ?? "left") === "left");
  const rightImages  = images.filter(g => g.position === "right");
  const rightImage   = rightImages[0] ?? null;

  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [primaryIdx,  setPrimaryIdx]  = useState(0);

  const primary    = leftImages[primaryIdx] ?? leftImages[0];
  const disclaimer = leftImages.find(g => g.disclaimer)?.disclaimer;

  // Escape closes lightbox; arrow keys navigate
  useEffect(() => {
    if (lightboxIdx === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape")     setLightboxIdx(null);
      if (e.key === "ArrowLeft")  setLightboxIdx((i) => (i === null ? null : Math.max(0, i - 1)));
      if (e.key === "ArrowRight") setLightboxIdx((i) => (i === null ? null : Math.min(leftImages.length - 1, i + 1)));
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxIdx, leftImages.length]);

  if (leftImages.length === 0 && !rightImage) return null;

  return (
    <section className="mt-8">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.22em]" style={{ color: "#FFB300" }}>
          {eyebrow}
        </p>
        <h2 className="mt-0.5 text-[18px] font-black text-neutral-900 md:text-[22px]">
          {heading}
        </h2>
      </div>

      {/* Side-by-side layout — black container left with image, finish chips right */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">

        {/* LEFT — black container with primary image (click to enlarge). Only when left images exist. */}
        {leftImages.length > 0 && primary && (
        <div className="rounded-2xl border-2 p-3 md:p-4" style={{ borderColor: "#0A0A0A", backgroundColor: "#0A0A0A" }}>
          <button
            type="button"
            onClick={() => setLightboxIdx(primaryIdx)}
            className="group relative block w-full overflow-hidden rounded-xl bg-neutral-900"
            aria-label="Enlarge image"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={primary.image_url}
              alt={primary.alt_text ?? primary.caption ?? "Example finish"}
              className="mx-auto block h-auto w-full object-contain"
              style={{ maxHeight: "70vh" }}
              loading="lazy"
            />

            {/* Hover — magnify affordance */}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"
              style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
            >
              <div className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11.5px] font-black uppercase tracking-wider text-neutral-900" style={{ backgroundColor: "#FFB300" }}>
                <Maximize2 size={12}/> Click to enlarge
              </div>
            </div>
          </button>

          {/* Caption strip under image */}
          {(primary.caption || primary.credit) && (
            <div className="mt-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
              {primary.caption && (
                <p className="text-[11.5px] font-black text-white">{primary.caption}</p>
              )}
              {primary.credit && (
                <p className="text-[9.5px] font-black uppercase tracking-wider" style={{ color: "#FFB300" }}>
                  {primary.credit}
                </p>
              )}
            </div>
          )}

          {/* Thumbnail strip — only when multiple left images */}
          {leftImages.length > 1 && !!primary && (
            <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {leftImages.map((g, i) => (
                <li key={g.id}>
                  <button
                    type="button"
                    onClick={() => setPrimaryIdx(i)}
                    className="shrink-0 overflow-hidden rounded-lg border-2"
                    style={{ borderColor: i === primaryIdx ? "#FFB300" : "rgba(255,255,255,0.12)" }}
                    aria-label={`Show image ${i + 1}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={g.image_url}
                      alt=""
                      className="h-14 w-20 object-cover"
                      loading="lazy"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        )}

        {/* RIGHT — supporting image (if present) + finish-type chips from KB pack */}
        <aside className="rounded-2xl border-2 bg-white p-4 shadow-sm md:p-5" style={{ borderColor: "rgba(139,69,19,0.10)" }}>
          {/* Optional right-side hero image — mounted above the chips.
              Used for e.g. materials product shot on the concrete video,
              tool line-up on the plastering video, etc. */}
          {rightImage && (
            <div className="mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={rightImage.image_url}
                alt={rightImage.alt_text ?? rightImage.caption ?? ""}
                className="mx-auto block h-auto w-full rounded-lg object-contain"
                style={{ maxHeight: "220px", backgroundColor: "#FBF6EC" }}
                loading="lazy"
              />
              {rightImage.caption && (
                <p className="mt-2 text-center text-[11px] font-black text-neutral-800">{rightImage.caption}</p>
              )}
              {rightImage.credit && (
                <p className="mt-0.5 text-center text-[9.5px] font-black uppercase tracking-wider text-neutral-500">{rightImage.credit}</p>
              )}
            </div>
          )}

          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
            Finishes in this trade
          </p>
          <p className="mt-0.5 text-[13px] font-black text-neutral-900">
            Which look do you want?
          </p>

          {finishes.length > 0 ? (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {finishes.map((f) => (
                <li key={f.slug}>
                  <button
                    type="button"
                    onClick={() => setPrimaryIdx(0)}  // future: filter gallery by finish
                    className="inline-flex items-center gap-1 rounded-full border-2 bg-white px-2.5 py-1 text-[11px] font-black text-neutral-800 hover:-translate-y-0.5 transition"
                    style={{ borderColor: "rgba(139,69,19,0.20)" }}
                    title={f.description ?? ""}
                  >
                    {f.display_name}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-[11.5px] text-neutral-500">
              Finish variations coming as more trades upload examples.
            </p>
          )}

          {tradeSlug && (
            <Link
              href={`/trades/${tradeSlug}`}
              className="mt-4 inline-flex h-9 items-center gap-1 rounded-md px-3 text-[10.5px] font-black uppercase tracking-wider text-neutral-900 shadow-sm active:scale-[0.97]"
              style={{ backgroundColor: "#FFB300" }}
            >
              Find a {tradeSlug.replace(/-/g, " ")} <ArrowRight size={11}/>
            </Link>
          )}
        </aside>
      </div>

      {/* Disclaimer — full-width beneath both columns */}
      {disclaimer && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border-2 bg-amber-50 p-3" style={{ borderColor: "#F59E0B" }}>
          <Info size={12} className="mt-0.5 shrink-0 text-amber-700"/>
          <p className="text-[11.5px] leading-relaxed text-amber-900">
            <span className="font-black uppercase tracking-wider text-amber-800">Note · </span>
            {disclaimer}
          </p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <Lightbox
          images={images}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onIndexChange={setLightboxIdx}
        />
      )}
    </section>
  );
}

// ─── Lightbox ────────────────────────────────────────────────────

function Lightbox({
  images, index, onClose, onIndexChange
}: {
  images: GalleryImage[];
  index:  number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
}) {
  const img = images[index];
  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enlarged image"
      onClick={onClose}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 md:p-10"
      style={{ backgroundColor: "rgba(10,10,10,0.94)" }}
    >
      {/* Close */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full text-white shadow-lg hover:scale-105 transition md:right-6 md:top-6"
        style={{ backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
        aria-label="Close"
      >
        <X size={20} strokeWidth={2.6}/>
      </button>

      {/* Prev */}
      {hasPrev && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index - 1); }}
          className="absolute left-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg hover:scale-105 transition md:left-6"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          aria-label="Previous image"
        >
          <ChevronLeft size={22} strokeWidth={2.6}/>
        </button>
      )}

      {/* Next */}
      {hasNext && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onIndexChange(index + 1); }}
          className="absolute right-4 top-1/2 z-10 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white shadow-lg hover:scale-105 transition md:right-6"
          style={{ backgroundColor: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}
          aria-label="Next image"
        >
          <ChevronRight size={22} strokeWidth={2.6}/>
        </button>
      )}

      {/* Image + caption block */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] max-w-[95vw] flex-col items-center gap-3"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.image_url}
          alt={img.alt_text ?? img.caption ?? "Example finish"}
          className="max-h-[80vh] w-auto rounded-lg object-contain shadow-2xl"
        />
        {(img.caption || img.credit) && (
          <div className="max-w-[95vw] text-center">
            {img.caption && (
              <p className="text-[13.5px] font-black text-white">{img.caption}</p>
            )}
            {img.credit && (
              <p className="mt-0.5 text-[10.5px] font-black uppercase tracking-wider" style={{ color: "#FFB300" }}>
                {img.credit}
              </p>
            )}
          </div>
        )}
        {images.length > 1 && (
          <p className="text-[10.5px] font-black uppercase tracking-wider text-white/50">
            {index + 1} / {images.length}
          </p>
        )}
      </div>
    </div>
  );
}
