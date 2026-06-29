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
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.4) 45%, rgba(0,0,0,0) 75%)"
              }}
            />
          </div>

          <div
            className="absolute left-4 top-4 transition-opacity sm:left-6 sm:top-6"
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
            <p className="truncate text-base font-extrabold leading-tight text-white sm:text-xl">
              {item.productName}
            </p>
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
            <div className="absolute bottom-3 right-4 flex items-center gap-1.5 sm:right-6">
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
      </a>

      {items.length > 4 && (
        <a
          href={seeAllHref}
          className="mt-3 inline-flex h-11 items-center text-[13px] font-bold text-neutral-500 transition hover:text-[#FFB300]"
        >
          See all {items.length} picks
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="ml-1"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </a>
      )}
    </div>
  );
}
