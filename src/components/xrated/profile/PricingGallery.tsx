"use client";

// Xrated Trades — single carousel that replaces the Recent Work gallery.
// Each priced-service card carries up to 3 photos (cover + 2 thumbs),
// a description, the price, and an Enquire button. Tapping any photo
// opens a yellow-rimmed lightbox with prev/next navigation through all
// of the card's photos so the customer can preview the workmanship
// without leaving the page.

import { useEffect, useRef, useState } from "react";
import { EnquireButton } from "./EnquireButton";

export type PricedService = {
  name: string;
  image_url: string | null;
  image_urls?: string[];
  price: number;
  unit: string;
  description?: string | null;
};

// Flatten cover + extras into a deduped image list per service.
function imagesOf(svc: PricedService): string[] {
  const all = [svc.image_url, ...(svc.image_urls ?? [])].filter(
    (u): u is string => !!u
  );
  return Array.from(new Set(all)).slice(0, 3);
}

export function PricingGallery({
  services,
  slug
}: {
  services: PricedService[];
  slug: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    startIndex: number;
    service: PricedService;
  } | null>(null);

  if (services.length === 0) return null;

  function openLightbox(svc: PricedService, startIndex: number) {
    const imgs = imagesOf(svc);
    if (imgs.length === 0) return;
    setLightbox({ images: imgs, startIndex, service: svc });
  }

  return (
    <>
      <div className="mt-1 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? "Collapse pricing" : "Expand pricing grid"}
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

      {!expanded ? (
        <PricingMarquee
          services={services}
          slug={slug}
          onOpenLightbox={openLightbox}
        />
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((svc) => (
            <PricingCard
              key={svc.name}
              service={svc}
              slug={slug}
              onOpenLightbox={openLightbox}
            />
          ))}
        </div>
      )}

      {lightbox && (
        <Lightbox
          images={lightbox.images}
          startIndex={lightbox.startIndex}
          service={lightbox.service}
          slug={slug}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}

function PricingMarquee({
  services,
  slug,
  onOpenLightbox
}: {
  services: PricedService[];
  slug: string;
  onOpenLightbox: (svc: PricedService, startIndex: number) => void;
}) {
  const looped = services.length >= 2 ? [...services, ...services] : services;
  const containerRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || paused || services.length < 2) return;
    let raf = 0;
    let last = performance.now();
    const SPEED_PX_PER_SEC = 22;
    function tick(now: number) {
      const el = containerRef.current;
      if (!el) return;
      const dt = (now - last) / 1000;
      last = now;
      el.scrollLeft += SPEED_PX_PER_SEC * dt;
      const half = el.scrollWidth / 2;
      if (el.scrollLeft >= half) el.scrollLeft -= half;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, services.length]);

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
        {looped.map((svc, i) => (
          <div key={`${svc.name}-${i}`} className="w-72 shrink-0 sm:w-80">
            <PricingCard
              service={svc}
              slug={slug}
              onOpenLightbox={onOpenLightbox}
            />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-white to-transparent" />
      <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent" />
    </div>
  );
}

function PricingCard({
  service: svc,
  slug,
  onOpenLightbox
}: {
  service: PricedService;
  slug: string;
  onOpenLightbox: (svc: PricedService, startIndex: number) => void;
}) {
  const images = imagesOf(svc);
  const cover = images[0];

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {cover && (
        <button
          type="button"
          onClick={() => onOpenLightbox(svc, 0)}
          aria-label={`View ${svc.name} photo`}
          className="group relative aspect-video w-full overflow-hidden"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={svc.name}
            className="h-full w-full object-cover transition group-hover:scale-[1.03]"
          />
          {images.length > 1 && (
            <span
              aria-hidden="true"
              className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-black/65 px-2 py-0.5 text-xs font-bold text-white"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              {images.length}
            </span>
          )}
        </button>
      )}

      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-sm font-extrabold text-neutral-900">{svc.name}</p>
        {svc.description && (
          <p className="text-xs leading-relaxed text-neutral-500">
            {svc.description}
          </p>
        )}

        {/* Thumbnail strip removed — card stays clean. The cover's [N]
            badge still signals multiple photos, and tapping the cover
            opens the lightbox where the customer can flip through every
            shot. */}

        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <div className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold text-neutral-900">
              £{svc.price.toLocaleString("en-GB")}
            </span>
            <span className="text-xs text-neutral-500">{svc.unit}</span>
          </div>
          <EnquireButton
            slug={slug}
            name={svc.name}
            price={svc.price}
            unit={svc.unit}
          />
        </div>
      </div>
    </div>
  );
}

// Lightbox — yellow-rimmed centred modal with prev/next arrows across
// the card's image set. Enquire button at the bottom reuses the
// existing prefill flow (writes to sessionStorage, navigates to
// /contact#contact-panel).
function Lightbox({
  images,
  startIndex,
  service,
  slug,
  onClose
}: {
  images: string[];
  startIndex: number;
  service: PricedService;
  slug: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const safe = Math.min(Math.max(index, 0), images.length - 1);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight")
        setIndex((i) => Math.min(images.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose, images.length]);

  const hasPrev = safe > 0;
  const hasNext = safe < images.length - 1;

  function enquire() {
    try {
      sessionStorage.setItem(
        "xrated_enquiry_service",
        JSON.stringify({
          name: service.name,
          price: service.price,
          unit: service.unit
        })
      );
    } catch {
      // ignore
    }
    window.location.href = `/trade/${slug}/contact#contact-panel`;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${service.name} — photo viewer`}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl border-4 bg-white shadow-2xl"
        style={{ borderColor: "#FFB300" }}
      >
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

        {hasPrev && (
          <button
            type="button"
            onClick={() => setIndex(safe - 1)}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-10 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white transition hover:bg-black/80"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
        )}
        {hasNext && (
          <button
            type="button"
            onClick={() => setIndex(safe + 1)}
            aria-label="Next photo"
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
            src={images[safe]}
            alt={`${service.name} — photo ${safe + 1} of ${images.length}`}
            className="h-full w-full object-contain"
          />
        </div>

        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-base font-extrabold text-neutral-900 sm:text-lg">
              {service.name}
            </p>
            {service.description && (
              <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                {service.description}
              </p>
            )}
            <p className="mt-2 flex items-baseline gap-1">
              <span className="text-xl font-extrabold text-neutral-900">
                £{service.price.toLocaleString("en-GB")}
              </span>
              <span className="text-xs text-neutral-500">{service.unit}</span>
            </p>
            {images.length > 1 && (
              <p className="mt-1 text-xs font-bold text-neutral-400">
                Photo {safe + 1} of {images.length}
              </p>
            )}
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
