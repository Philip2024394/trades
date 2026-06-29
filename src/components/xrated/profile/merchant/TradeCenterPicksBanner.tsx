"use client";

// Public profile — Trade Center Picks landscape banner (client).
//
// One wide cinematic banner (16:7 mobile, 16:6 desktop) showing the
// pick's product image full-bleed with a dark gradient at the bottom
// for legible overlay text. Status chip pinned top-left; product name
// + note + arrival + CTA pinned bottom-left on a single column
// (product name is forced to one line via `truncate` — never wraps).
//
// When more than one pick is active the banner rotates through them
// every 5s with a 350ms cross-fade. Rotation pauses on hover or focus,
// and freezes entirely when the user prefers reduced motion. Small
// pill indicators bottom-right show position in the carousel. Whole
// banner is one big anchor — tap or click opens the PDP.

import { useEffect, useState } from "react";
import {
  TradeCenterPickStatusChip,
  type TradeCenterPickStatusKey
} from "./TradeCenterPickStatusChip";

const INTERVAL_MS = 5000;
const FADE_MS = 350;

export type BannerItem = {
  id: string;
  status: TradeCenterPickStatusKey;
  note: string | null;
  arrival_at: string | null;
  productName: string;
  productSlug: string | null;
  productCover: string | null;
};

function formatArrival(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

// Trade products often follow a "Brand/Type - Spec" pattern (e.g.
// "Timber Garden Shed - Treated 8' x 6'"). Split on the first " - "
// so the headline reads tight and the spec sits as a subtitle.
function splitName(name: string): { main: string; subtitle: string | null } {
  const idx = name.indexOf(" - ");
  if (idx === -1) return { main: name, subtitle: null };
  return {
    main: name.slice(0, idx).trim(),
    subtitle: name.slice(idx + 3).trim() || null
  };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function TradeCenterPicksBanner({
  items,
  listingSlug,
  seeAllHref
}: {
  items: BannerItem[];
  listingSlug: string;
  seeAllHref: string;
}) {
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (items.length <= 1 || paused || reducedMotion) return;
    const interval = setInterval(() => {
      setFading(true);
      const t = setTimeout(() => {
        setIndex((i) => (i + 1) % items.length);
        setFading(false);
      }, FADE_MS);
      return () => clearTimeout(t);
    }, INTERVAL_MS);
    return () => clearInterval(interval);
  }, [items.length, paused, reducedMotion]);

  if (items.length === 0) return null;
  const item = items[index];
  const arrival = formatArrival(item.arrival_at);
  const showArrival =
    arrival && (item.status === "pre_order" || item.status === "new_arrival");
  // Banner clicks land on the dedicated pick detail page so the
  // commercial context (status, long description, price card, WhatsApp
  // CTA primed with the pick's status + product name) survives the
  // jump — instead of dropping the visitor on the generic PDP.
  const href = `/${listingSlug}/picks/${item.id}`;

  return (
    <div
      className="mt-3 w-full"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <a
        href={href}
        className="group relative block overflow-hidden rounded-2xl bg-neutral-900 transition"
      >
        <div className="relative aspect-[2/1] w-full">
          <div
            className="absolute inset-0 transition-opacity"
            style={{
              opacity: fading ? 0 : 1,
              transitionDuration: `${FADE_MS}ms`
            }}
          >
            {item.productCover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={item.productCover}
                alt={item.productName}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.02]"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-neutral-100 text-[13px] text-neutral-400">
                No image
              </div>
            )}
            <div
              className="pointer-events-none absolute inset-0 transition-opacity"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0) 75%)",
                opacity: overlayVisible ? 1 : 0,
                transitionDuration: `${FADE_MS}ms`
              }}
            />
          </div>

          {/* Overlay group — status chip + product info block + position
              dots. Toggled together via the eye button bottom-right. */}
          <div
            className="pointer-events-none absolute inset-0 transition-opacity"
            style={{
              opacity: overlayVisible ? 1 : 0,
              transitionDuration: `${FADE_MS}ms`
            }}
            aria-hidden={!overlayVisible}
          >
            <div
              className="absolute right-4 top-4 transition-opacity sm:right-6 sm:top-6"
              style={{
                opacity: fading ? 0 : 1,
                transitionDuration: `${FADE_MS}ms`
              }}
            >
              <TradeCenterPickStatusChip status={item.status} />
            </div>

            <div
              className="absolute inset-x-4 bottom-4 transition-opacity sm:inset-x-6 sm:bottom-6"
              style={{
                opacity: fading ? 0 : 1,
                transitionDuration: `${FADE_MS}ms`
              }}
            >
              {(() => {
                const { main, subtitle } = splitName(item.productName);
                return (
                  <>
                    <p className="truncate text-base font-extrabold leading-tight text-white sm:text-xl">
                      {main}
                    </p>
                    {subtitle && (
                      <p className="truncate text-[13px] font-semibold text-white/80 sm:text-sm">
                        {subtitle}
                      </p>
                    )}
                  </>
                );
              })()}
              {(item.note || showArrival) && (
                <p className="mt-1 truncate text-[13px] text-white/85 sm:text-sm">
                  {showArrival && (
                    <span className="font-bold text-white">
                      Arrives {arrival}
                    </span>
                  )}
                  {showArrival && item.note && (
                    <span className="mx-1.5 text-white/60">·</span>
                  )}
                  {item.note}
                </p>
              )}
              <span
                className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-lg px-4 text-[13px] font-extrabold text-neutral-900 shadow-md transition group-hover:opacity-90 sm:text-sm"
                style={{ background: "#FFB300" }}
              >
                See offer
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="transition group-hover:translate-x-0.5"
                >
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </span>
            </div>

            {items.length > 1 && (
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
                {items.map((_, i) => (
                  <span
                    key={i}
                    className="h-1.5 rounded-full transition-all"
                    style={{
                      background:
                        i === index ? "#FFB300" : "rgba(255,255,255,0.45)",
                      width: i === index ? "18px" : "6px",
                      transitionDuration: `${FADE_MS}ms`
                    }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            )}
          </div>

          {/* Overlay toggle — always visible, bottom-right corner. Stops
              propagation so tapping the eye doesn't navigate to the pick. */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOverlayVisible((v) => !v);
            }}
            className="absolute bottom-3 right-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-900 shadow-md transition hover:opacity-90 sm:right-4"
            style={{ background: "#FFB300" }}
            aria-label={overlayVisible ? "Hide overlay text" : "Show overlay text"}
            aria-pressed={!overlayVisible}
          >
            {overlayVisible ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.6 18.6 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </a>
    </div>
  );
}
