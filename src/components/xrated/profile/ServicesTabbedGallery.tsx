"use client";

// Xrated Trades — Services-as-tabs gallery.
//
// Replaces the old standalone "Our Services" icon row + "Pricing"
// carousel. Each service becomes a tab; clicking a tab swaps the
// content card below to that service's images + description +
// optional price + Enquire button. Cover image opens a lightbox with
// every photo for that service.
//
// Data source: priced_services rows when populated (they carry image
// / description / price). When a tradesperson only has services_offered
// (string labels), we still render text-only tabs with a "Contact for
// a quote" card so the section never looks empty.

import { useCallback, useEffect, useRef, useState } from "react";
import { EnquireButton } from "./EnquireButton";
import { ViewCardModal } from "./ViewCardModal";

export type PricedService = {
  name: string;
  image_url: string | null;
  image_urls?: string[];
  /** Optional "before" image — shown in the View-card popup tabs
   *  alongside the After image_url. When set, the View popup adds an
   *  "Before" tab so customers can see the transformation. */
  before_image_url?: string | null;
  /** Optional CSS object-position value (e.g. "center top", "50% 30%")
   *  used to frame the cover image when the tradesperson picks a
   *  non-default focal point via the dashboard image-positioner. Falls
   *  back to "top" so AI-generated art with bottom-edge text/branding
   *  shows the headline of the image, not the watermark. */
  image_position?: string | null;
  price: number;
  unit: string;
  description?: string | null;
};

function imagesOf(svc: PricedService): string[] {
  const all = [svc.image_url, ...(svc.image_urls ?? [])].filter(
    (u): u is string => !!u
  );
  return Array.from(new Set(all)).slice(0, 3);
}

type ServiceRatingReview = {
  service_name: string | null;
  overall_rating: number;
  status?: "live" | "disputed" | string;
};

/** Per-service star rating — only returns a number when there are at
 *  least 3 live reviews tied to this service name. Below the threshold
 *  the badge stays hidden so a single grumpy review doesn't tank the
 *  card. Reviews on disputed status are excluded from the count. */
const RATING_BADGE_MIN = 3;
function getServiceRating(
  serviceName: string,
  reviews: ServiceRatingReview[] | undefined
): { avg: number; count: number } | null {
  if (!reviews || reviews.length === 0) return null;
  const target = serviceName.trim().toLowerCase();
  if (!target) return null;
  const matching = reviews.filter(
    (r) =>
      (r.status === "live" || r.status === undefined) &&
      typeof r.service_name === "string" &&
      r.service_name.trim().toLowerCase() === target &&
      typeof r.overall_rating === "number" &&
      r.overall_rating > 0
  );
  if (matching.length < RATING_BADGE_MIN) return null;
  const sum = matching.reduce((acc, r) => acc + r.overall_rating, 0);
  return { avg: sum / matching.length, count: matching.length };
}

type Tab = {
  name: string;
  service: PricedService | null;
};

export function ServicesTabbedGallery({
  slug,
  pricedServices,
  servicesOffered,
  reviews,
  stripped = false,
  acceptingJobs = false,
  operatingHours = null
}: {
  slug: string;
  pricedServices: PricedService[];
  servicesOffered: string[];
  /** Live reviews used for the per-service star badge. When omitted,
   *  no badge renders — same as having zero reviews. Each review must
   *  carry `service_name` for it to count toward a service's rating. */
  reviews?: ServiceRatingReview[];
  /** Free-tier strip-down — when true, every card shows just the image
   *  + service name; price, description and the Enquire button are
   *  hidden. The lightbox stays unavailable so customers can't tap
   *  through to a paid-only contact flow. */
  stripped?: boolean;
  /** Drives the AvailabilityPill in the per-service modal — customer
   *  sees whether the tradesperson is reachable now or at a later
   *  time before tapping WhatsApp. */
  acceptingJobs?: boolean;
  operatingHours?: import("@/lib/availabilityStatus").OperatingHours | null;
}) {
  // Build the tab list — priced rows first (richer), then any text-only
  // services_offered that aren't already represented by a priced row.
  const tabs: Tab[] = (() => {
    const pricedByName = new Map(
      pricedServices.map((p) => [p.name.toLowerCase(), p])
    );
    const out: Tab[] = pricedServices.map((p) => ({
      name: p.name,
      service: p
    }));
    for (const name of servicesOffered) {
      if (!pricedByName.has(name.toLowerCase())) {
        out.push({ name, service: null });
      }
    }
    return out;
  })();

  const [active, setActive] = useState(0);
  const [gridMode, setGridMode] = useState(false);
  const [lightbox, setLightbox] = useState<{
    images: string[];
    startIndex: number;
    service: PricedService;
  } | null>(null);

  if (tabs.length === 0) return null;
  const safeActive = Math.min(active, tabs.length - 1);
  const current = tabs[safeActive];

  function openLightbox(svc: PricedService, startIndex: number) {
    const imgs = imagesOf(svc);
    if (imgs.length === 0) return;
    setLightbox({ images: imgs, startIndex, service: svc });
  }

  return (
    <section className="w-full px-4 pt-8 sm:px-6">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-extrabold text-neutral-900 sm:text-2xl">
            Our Services
          </h2>
          <p className="mt-1 text-xs text-neutral-500">
            Example of projects and finishes we offer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setGridMode((v) => !v)}
          aria-label={gridMode ? "Show tabs" : "Compare all services"}
          aria-expanded={gridMode}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-sm transition active:scale-[0.97]"
          style={{ background: "#FFB300" }}
        >
          {gridMode ? (
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

      {/* Tab row removed — section heading subtitle ("Example of
          projects and finishes we offer") now sets the context, and
          the cards auto-scroll continuously on the marquee below. */}

      {/* Body */}
      {gridMode ? (
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tabs.map((t) => (
            <ServiceCard
              key={t.name}
              tab={t}
              slug={slug}
              onOpenLightbox={openLightbox}
              stripped={stripped}
              rating={getServiceRating(t.name, reviews)}
              acceptingJobs={acceptingJobs}
              operatingHours={operatingHours}
            />
          ))}
        </div>
      ) : (
        <ServiceCarousel
          tabs={tabs}
          activeIndex={safeActive}
          onActiveChange={setActive}
          slug={slug}
          onOpenLightbox={openLightbox}
          stripped={stripped}
          reviews={reviews}
          acceptingJobs={acceptingJobs}
          operatingHours={operatingHours}
        />
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
    </section>
  );
}

// Horizontal carousel of every service card. Clicking a tab scrolls
// the carousel so the picked card sits centered on screen; swiping
// updates the active tab to whichever card is closest to centre.
function ServiceCarousel({
  tabs,
  activeIndex,
  onActiveChange,
  slug,
  onOpenLightbox,
  stripped = false,
  reviews,
  acceptingJobs = false,
  operatingHours = null
}: {
  tabs: Tab[];
  activeIndex: number;
  onActiveChange: (i: number) => void;
  slug: string;
  onOpenLightbox: (svc: PricedService, startIndex: number) => void;
  stripped?: boolean;
  reviews?: ServiceRatingReview[];
  acceptingJobs?: boolean;
  operatingHours?: import("@/lib/availabilityStatus").OperatingHours | null;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const programmaticScroll = useRef(false);
  const [paused, setPaused] = useState(false);

  // Cards are rendered twice so the auto-scroll can loop seamlessly —
  // when scrollLeft passes half the width we snap back by the same
  // amount and the duplicated set hides the seam.
  const looped = tabs.length >= 2 ? [...tabs, ...tabs] : tabs;

  // Tab-driven scroll: centre the picked card (first copy only).
  const scrollToActive = useCallback(() => {
    const scroller = scrollerRef.current;
    const target = cardRefs.current[activeIndex];
    if (!scroller || !target) return;
    const cardCenter = target.offsetLeft + target.offsetWidth / 2;
    const scrollerCenter = scroller.clientWidth / 2;
    const next = cardCenter - scrollerCenter;
    programmaticScroll.current = true;
    scroller.scrollTo({ left: Math.max(0, next), behavior: "smooth" });
    window.setTimeout(() => {
      programmaticScroll.current = false;
    }, 600);
  }, [activeIndex]);

  useEffect(() => {
    scrollToActive();
  }, [scrollToActive]);

  // Auto-scroll left at a gentle pace — like the Recent Work and
  // Pricing marquees. Pauses on hover (desktop) and on touch (mobile,
  // 1.5s resume after lift). Skipped entirely if there's only one
  // card, since loop has nothing to chase.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || paused || tabs.length < 2) return;
    let raf = 0;
    let last = performance.now();
    const SPEED_PX_PER_SEC = 22;
    function tick(now: number) {
      const el = scrollerRef.current;
      if (!el) return;
      // Skip frames during programmatic tab-scroll so the two don't
      // fight each other; the smooth-scroll runs for ~600ms.
      if (!programmaticScroll.current) {
        const dt = (now - last) / 1000;
        el.scrollLeft += SPEED_PX_PER_SEC * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      last = now;
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, tabs.length]);

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

  // While the user drags by hand, sync the active tab to whichever
  // first-copy card sits closest to centre. We skip during programmatic
  // scrolls (tab clicks) so they don't ping-pong the active state.
  function onScroll() {
    if (programmaticScroll.current) return;
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let closest = activeIndex;
    let bestDist = Infinity;
    cardRefs.current.forEach((node, i) => {
      if (!node) return;
      const cardCenter = node.offsetLeft + node.offsetWidth / 2;
      const dist = Math.abs(cardCenter - center);
      if (dist < bestDist) {
        bestDist = dist;
        closest = i;
      }
    });
    if (closest !== activeIndex) onActiveChange(closest);
  }

  return (
    <div
      className="relative mt-5"
      onMouseEnter={pauseNow}
      onMouseLeave={() => scheduleResume(300)}
    >
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        onTouchStart={pauseNow}
        onTouchEnd={() => scheduleResume(1500)}
        className="flex gap-4 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Lead + trail spacers removed — the tab row that needed
            centering is gone, so the first card now sits flush to the
            scroller's left edge (which itself has the section's
            px-4/sm:px-6 breathing room from the phone edge). */}
        {looped.map((t, i) => {
          // Only store the ref + bind the active-large state to the
          // FIRST copy of each tab. Onscreen there are two copies (so
          // the loop is seamless), but the cardRefs array stays length
          // tabs.length.
          const firstCopyIndex = i;
          const isFirstCopy = i < tabs.length;
          const tabIndex = i % tabs.length;
          return (
            <div
              key={`${t.name}-${i}`}
              ref={(node) => {
                if (isFirstCopy) cardRefs.current[firstCopyIndex] = node;
              }}
              className="w-[78%] shrink-0 sm:w-[60%] lg:w-[44%]"
            >
              <ServiceCard
                tab={t}
                slug={slug}
                onOpenLightbox={onOpenLightbox}
                large={tabIndex === activeIndex}
                stripped={stripped}
                rating={getServiceRating(t.name, reviews)}
                acceptingJobs={acceptingJobs}
                operatingHours={operatingHours}
              />
            </div>
          );
        })}
      </div>
      {/* Edge fade gradients removed — cards run clean to the screen
          edge with no white wash at either end. */}
    </div>
  );
}

function ServiceCard({
  tab,
  slug,
  onOpenLightbox,
  large,
  stripped = false,
  rating,
  acceptingJobs = false,
  operatingHours = null
}: {
  tab: Tab;
  slug: string;
  onOpenLightbox: (svc: PricedService, startIndex: number) => void;
  large?: boolean;
  /** Free-tier card — image + service name only. No description, no
   *  price, no Enquire button. Photo still opens the lightbox so the
   *  customer can see the work full-size. */
  stripped?: boolean;
  /** Per-service rating badge — only rendered when ≥3 live reviews
   *  are tied to this service. null means the badge stays hidden. */
  rating?: { avg: number; count: number } | null;
  /** Threaded through to ViewCardModal so the AvailabilityPill knows
   *  whether the tradesperson is reachable right now. */
  acceptingJobs?: boolean;
  operatingHours?: import("@/lib/availabilityStatus").OperatingHours | null;
}) {
  const { name, service: svc } = tab;

  // Text-only service (no priced row): minimal CTA card.
  if (!svc) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <p className="text-sm font-extrabold text-neutral-900">{name}</p>
        {!stripped && (
          <>
            <p className="text-xs text-neutral-500">
              No fixed price published — every job is quoted on site after a
              quick chat about scope, materials, and access.
            </p>
            <EnquireButton slug={slug} name={name} price={0} unit="" />
          </>
        )}
      </div>
    );
  }

  const images = imagesOf(svc);
  const cover = images[0];
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      {cover && (
        <button
          type="button"
          onClick={() => onOpenLightbox(svc, 0)}
          aria-label={`View ${svc.name} photo`}
          className={`group relative w-full overflow-hidden ${large ? "aspect-[16/9]" : "aspect-video"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cover}
            alt={svc.name}
            className="h-full w-full object-cover object-top transition group-hover:scale-[1.03]"
            style={svc.image_position ? { objectPosition: svc.image_position } : undefined}
          />
          {/* Per-service star badge — top-right of the cover image.
              Only renders when the service has ≥3 live reviews tied to
              it, so sparse-data services stay quiet. Yellow brand pill
              with star + average + review count. */}
          {rating && rating.count >= 3 && (
            <span
              className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-extrabold text-neutral-900 shadow-md"
              style={{ background: "#FFB300", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}
              aria-label={`${rating.avg.toFixed(1)} stars from ${rating.count} reviews`}
              title={`${rating.avg.toFixed(1)} from ${rating.count} reviews`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="m12 2 3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.56 5.82 22 7 14.14l-5-4.87 6.91-1.01L12 2z" />
              </svg>
              {rating.avg.toFixed(1)}
              <span className="text-[10px] font-bold text-neutral-900/65">
                ({rating.count})
              </span>
            </span>
          )}
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

      <div className="flex flex-1 flex-col gap-1 p-4 sm:p-5">
        <p className={`font-extrabold text-neutral-900 ${large ? "text-base sm:text-lg" : "text-sm"}`}>
          {svc.name}
        </p>
        {!stripped && svc.description && (
          <p className="text-xs leading-relaxed text-neutral-500">
            {svc.description}
          </p>
        )}

        {!stripped && (
          <div className="mt-auto flex items-end justify-between gap-2 pt-3">
            <div className="flex items-baseline gap-1">
              <span className={`font-extrabold text-neutral-900 ${large ? "text-2xl" : "text-lg"}`}>
                £{svc.price.toLocaleString("en-GB")}
              </span>
              <span className="text-xs text-neutral-500">{svc.unit}</span>
            </div>
            {/* View opens the lightbox with description, price, image
                (with Before tab when before_image_url is set on the
                service), and the WhatsApp enquire CTA inside. Replaces
                the inline Enquire button so customers always read the
                detail card before they message. */}
            <ViewCardModal
              svc={svc}
              slug={slug}
              acceptingJobs={acceptingJobs}
              operatingHours={operatingHours}
            />
          </div>
        )}
      </div>
    </div>
  );
}

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
