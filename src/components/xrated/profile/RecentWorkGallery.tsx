"use client";

// Xrated Trades — Recent Work gallery with grid expand + image lightbox.
//
// Default view: 4 thumbnails in a row + a yellow grid-icon button on the
// right. Tapping the grid button expands a full grid below showing every
// project image with its service-type label + location overlay. Tapping
// an image opens a yellow-rimmed lightbox with Close + Enquire buttons —
// Enquire stashes the project subject in sessionStorage and navigates to
// the dedicated contact page, where the form prefills automatically.

import { useEffect, useRef, useState } from "react";

const ENQUIRY_KEY = "xrated_enquiry_service";

export type GalleryItem = {
  url: string;
  serviceType: string;
  location: string;
};

export function RecentWorkGallery({
  items,
  listingSlug,
  listingDisplayName
}: {
  items: GalleryItem[];
  listingSlug: string;
  listingDisplayName: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  if (items.length === 0) return null;

  const hasMore = items.length > 4;

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Recent Work
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Projects completed — for specific finishing, contact us.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse gallery" : "Expand gallery"}
          aria-expanded={expanded}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition active:scale-[0.97]"
          style={{ background: "#FFB300" }}
        >
          {expanded ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          )}
        </button>
      </div>

      {!expanded && (
        <MarqueeRow
          items={items}
          listingDisplayName={listingDisplayName}
          onItemClick={(i) => setOpenIndex(i)}
        />
      )}

      {expanded && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
          {items.map((p, i) => (
            <GalleryThumb
              key={`${p.url}-${i}`}
              item={p}
              displayName={listingDisplayName}
              onClick={() => setOpenIndex(i)}
              labelled
            />
          ))}
        </div>
      )}

      {!expanded && hasMore && (
        <p className="mt-3 text-xs text-neutral-500">
          Auto-scrolling — hover or swipe to pause, tap the grid icon to see all {items.length} projects.
        </p>
      )}

      {openIndex !== null && (
        <Lightbox
          item={items[openIndex]}
          displayName={listingDisplayName}
          listingSlug={listingSlug}
          onClose={() => setOpenIndex(null)}
          onPrev={
            openIndex > 0 ? () => setOpenIndex(openIndex - 1) : undefined
          }
          onNext={
            openIndex < items.length - 1
              ? () => setOpenIndex(openIndex + 1)
              : undefined
          }
        />
      )}
    </section>
  );
}

function MarqueeRow({
  items,
  listingDisplayName,
  onItemClick
}: {
  items: GalleryItem[];
  listingDisplayName: string;
  onItemClick: (index: number) => void;
}) {
  // Duplicate the items so the strip can loop seamlessly. The user's
  // index is calculated modulo the original list length.
  const looped = items.length >= 2 ? [...items, ...items] : items;
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // Auto-scroll loop. Uses scrollLeft to play nicely with native swipe —
  // tapping/dragging the strip pauses momentarily and the loop resumes
  // when the user lifts their finger.
  useEffect(() => {
    const el = containerRef.current;
    if (!el || paused) return;
    let raf = 0;
    let last = performance.now();
    const SPEED_PX_PER_SEC = 24; // gentle drift; ~24px / second
    function tick(now: number) {
      const el = containerRef.current;
      if (!el) return;
      const dt = (now - last) / 1000;
      last = now;
      el.scrollLeft += SPEED_PX_PER_SEC * dt;
      // Half the scrollWidth is the original set; loop back to start
      // once we cross that boundary so the duplicated set hides the seam.
      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) {
        el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, items.length]);

  // Pause on hover (desktop) and on touch (mobile). Touch resume is
  // debounced — user gets ~1.5s of stillness after the last drag before
  // the loop restarts so they can actually look at what they swiped to.
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function pauseNow() {
    if (resumeTimer.current) {
      clearTimeout(resumeTimer.current);
      resumeTimer.current = null;
    }
    setPaused(true);
  }
  function scheduleResume(delayMs: number) {
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => setPaused(false), delayMs);
  }

  return (
    <div
      className="relative mt-4 overflow-hidden"
      onMouseEnter={pauseNow}
      onMouseLeave={() => scheduleResume(300)}
    >
      <div
        ref={containerRef}
        className="flex gap-3 overflow-x-auto scroll-smooth pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        onTouchStart={pauseNow}
        onTouchEnd={() => scheduleResume(1500)}
      >
        {looped.map((p, i) => (
          <div key={`${p.url}-${i}`} className="shrink-0 w-44 sm:w-56">
            <GalleryThumb
              item={p}
              displayName={listingDisplayName}
              onClick={() => onItemClick(i % items.length)}
              labelled
            />
          </div>
        ))}
      </div>
      {/* Gradient fades so the strip looks cleanly clipped at both edges. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
      />
    </div>
  );
}

function GalleryThumb({
  item,
  displayName,
  onClick,
  labelled
}: {
  item: GalleryItem;
  displayName: string;
  onClick: () => void;
  labelled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${item.serviceType} in ${item.location} — open in lightbox`}
      className="group relative aspect-square overflow-hidden rounded-xl bg-neutral-200 ring-1 ring-black/5 transition hover:ring-[#FFB300]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.url}
        alt={`${displayName} — ${item.serviceType}`}
        className="h-full w-full object-cover transition group-hover:scale-105"
      />
      {labelled && (
        <span
          className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 text-left"
          aria-hidden="true"
        >
          <span className="block text-xs font-extrabold leading-tight text-white">
            {item.serviceType}
          </span>
          <span className="mt-0.5 flex items-center gap-1 text-xs text-white/85">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {item.location}
          </span>
        </span>
      )}
    </button>
  );
}

function Lightbox({
  item,
  displayName,
  listingSlug,
  onClose,
  onPrev,
  onNext
}: {
  item: GalleryItem;
  displayName: string;
  listingSlug: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, onPrev, onNext]);

  function enquire() {
    try {
      sessionStorage.setItem(
        ENQUIRY_KEY,
        JSON.stringify({
          name: `the ${item.serviceType} project in ${item.location}`,
          price: 0,
          unit: ""
        })
      );
    } catch {
      // ignore
    }
    window.location.href = `/trade/${listingSlug}/contact#contact-panel`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${item.serviceType} in ${item.location}`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-4 bg-white shadow-2xl"
        style={{ borderColor: "#FFB300" }}
      >
        {/* Close — top right */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Prev / Next arrows */}
        {onPrev && (
          <button
            type="button"
            onClick={onPrev}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            aria-label="Next image"
            className="absolute right-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        )}

        <div className="aspect-video w-full bg-black">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.url}
            alt={`${displayName} — ${item.serviceType}`}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-neutral-900 sm:text-lg">
              {item.serviceType}
            </p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-neutral-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFB300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {item.location}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border-2 border-neutral-300 bg-white px-4 text-xs font-bold text-neutral-700 transition hover:border-neutral-500"
            >
              Close
            </button>
            <button
              type="button"
              onClick={enquire}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg px-4 text-xs font-extrabold text-neutral-900 shadow-sm transition active:scale-[0.97]"
              style={{ background: "#FFB300" }}
            >
              Enquire about this
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
