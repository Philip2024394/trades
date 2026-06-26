"use client";

// Xrated Trades — premium-tier priced services horizontal carousel.
// Cards: image (4:3), service name, price + unit. Tapping a card opens a
// modal popup with the image, name, price, description, and two buttons:
// Enquire (pre-fills the inline contact form via sessionStorage + opens
// the contact panel by navigating to #contact-panel) and Close.
//
// Auto-scrolls slowly to the LEFT (continuous marquee). The cards list is
// duplicated once so the translate loops seamlessly. Pause on hover (desktop),
// pause-on-touch (mobile), and pause while the modal is open.

import { useEffect, useRef, useState } from "react";

type PricedService = {
  name: string;
  image_url: string | null;
  price: number;
  unit: string;
  description?: string | null;
};

function formatPrice(price: number, unit: string): string {
  const amount = `£${price.toLocaleString("en-GB")}`;
  if (!unit) return amount;
  const u = unit.trim();
  if (u.toLowerCase() === "from") return `From ${amount}`;
  return `${amount} ${u}`;
}

export function PricedServicesCarousel({
  services,
  themeColor
}: {
  services: PricedService[];
  themeColor: string;
}) {
  const [paused, setPaused] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const animationId = useRef(`xrated-marquee-${Math.random().toString(36).slice(2, 8)}`).current;

  // Tune the scroll speed by total cards — more cards, longer cycle so the
  // velocity per card stays roughly constant. ~12s per card feels right.
  const durationSeconds = Math.max(20, services.length * 12);

  useEffect(() => {
    // Make sure the user can read again shortly after their finger lifts.
    // Don't auto-resume if the modal is open.
    if (!paused || selected !== null) return;
    const t = window.setTimeout(() => setPaused(false), 2000);
    return () => window.clearTimeout(t);
  }, [paused, selected]);

  // ESC closes modal.
  useEffect(() => {
    if (selected === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  // Lock body scroll while modal is open.
  useEffect(() => {
    if (selected === null) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [selected]);

  if (!services || services.length === 0) return null;

  function handleEnquire(svc: PricedService) {
    try {
      sessionStorage.setItem(
        "xrated_enquiry_service",
        JSON.stringify({ name: svc.name, price: svc.price, unit: svc.unit })
      );
    } catch {
      // sessionStorage might be unavailable (private mode); ignore.
    }
    setSelected(null);
    // Force the contact panel open. Setting the hash to the same value
    // won't fire hashchange, so clear first.
    if (window.location.hash === "#contact-panel") {
      window.location.hash = "";
    }
    window.location.hash = "#contact-panel";
  }

  // Render the list twice in sequence. The keyframe translates the entire
  // track by exactly -50% so when the second copy lands where the first
  // started, the loop restarts invisibly.
  const cards = [...services, ...services];
  const marqueePaused = paused || selected !== null;
  const sel = selected !== null ? services[selected % services.length] : null;

  return (
    <section className="mx-auto max-w-6xl px-4 pb-2 pt-8">
      <div>
        <h2
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: themeColor }}
        >
          Priced services
        </h2>
        <p className="mt-1 text-xs text-brand-muted">
          Auto-scrolls — hover or tap a card to pause and read. Tap a card to see details and enquire.
        </p>
      </div>

      <div
        className="relative mt-4 overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
      >
        <ul
          className={`flex w-max gap-4 pb-3`}
          style={{
            animation: `${animationId} ${durationSeconds}s linear infinite`,
            animationPlayState: marqueePaused ? "paused" : "running"
          }}
        >
          {cards.map((svc, i) => {
            const realIndex = i % services.length;
            return (
              <li
                key={`${svc.name}-${i}`}
                className="w-[85vw] shrink-0 sm:w-[360px] lg:w-[320px]"
              >
                <button
                  type="button"
                  onClick={() => setSelected(realIndex)}
                  className="block h-full w-full text-left"
                  aria-label={`View details for ${svc.name}`}
                >
                  <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface/40 transition hover:border-brand-accent">
                    <div className="relative aspect-[4/3] w-full bg-black">
                      {svc.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={svc.image_url}
                          alt={svc.name}
                          loading="lazy"
                          decoding="async"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
                          No photo
                        </div>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col gap-2 p-4">
                      <h3 className="text-[13px] font-bold text-brand-text">{svc.name}</h3>
                      <p className="text-[13px] font-bold" style={{ color: themeColor }}>
                        {formatPrice(svc.price, svc.unit)}
                      </p>
                      <span
                        className="mt-auto inline-flex h-11 items-center justify-center gap-1 rounded-lg border border-brand-line bg-neutral-100 px-3 text-[13px] font-bold text-brand-text"
                      >
                        View details
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </span>
                    </div>
                  </article>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <style>{`
        @keyframes ${animationId} {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="${animationId}"] {
            animation: none !important;
          }
        }
      `}</style>

      {/* Modal popup */}
      {sel && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${sel.name} details`}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setSelected(null)}
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
          />
          <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-brand-line bg-brand-surface shadow-2xl">
            <div className="relative aspect-[4/3] w-full shrink-0 bg-black">
              {sel.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sel.image_url}
                  alt={sel.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs text-brand-muted">
                  No photo
                </div>
              )}
              <button
                type="button"
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur-sm transition hover:bg-black/90"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
              <h3 className="text-base font-bold leading-tight text-brand-text">
                {sel.name}
              </h3>
              <p className="text-[15px] font-bold" style={{ color: themeColor }}>
                {formatPrice(sel.price, sel.unit)}
              </p>
              {sel.description && sel.description.trim().length > 0 && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-brand-text">
                  {sel.description}
                </p>
              )}
              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => handleEnquire(sel)}
                  className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-bold transition active:scale-[0.97]"
                  style={{ background: themeColor, color: "#000" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M19.05 4.91A10 10 0 0 0 12 2a10 10 0 0 0-8.94 14.5L2 22l5.62-1.47A10 10 0 1 0 19.05 4.91Zm-7.05 15.4a8.36 8.36 0 0 1-4.27-1.17l-.3-.18-3.34.87.89-3.26-.2-.33A8.32 8.32 0 1 1 12 20.31Z" />
                  </svg>
                  Enquire
                </button>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="inline-flex h-11 flex-1 items-center justify-center rounded-lg border border-brand-line bg-brand-bg px-4 text-[13px] font-bold text-brand-text transition hover:border-brand-accent hover:text-brand-accent"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default PricedServicesCarousel;
