"use client";

// Xrated Trades — standalone header for the public Trade Off surface.
// Logo on the left. Right side: hamburger menu, profile, alerts bell.
// 'List your trade' CTA removed per user direction — it lives in the
// landing hero CTAs and the footer 'List your trade (free)' button.

import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BurgerMenu } from "./BurgerMenu";

export function XratedHeader() {
  return (
    <header className="sticky top-0 z-30 bg-black/95 backdrop-blur">
      <div className="mx-auto flex h-[64px] max-w-6xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:gap-4">
        <a
          href="/trade-off"
          aria-label={`${XRATED_BRAND.name} home`}
          className="block shrink-0 p-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={XRATED_BRAND.logoUrl}
            alt={XRATED_BRAND.name}
            className="block h-10 w-auto object-contain sm:h-12"
            style={{ background: "transparent" }}
          />
        </a>

        <div className="flex items-center gap-1 sm:gap-2">
          {/* Alerts bell */}
          <button
            type="button"
            aria-label="Alerts"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
              <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
            </svg>
            <span
              className="absolute right-2 top-2 inline-block h-2 w-2 rounded-full"
              style={{ background: XRATED_BRAND.accent }}
              aria-hidden="true"
            />
          </button>

          {/* Profile avatar — middle of the group */}
          <button
            type="button"
            aria-label="Account"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border-2 border-white/20 bg-white/5 text-white/80 transition hover:border-white/40 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </button>

          {/* Hamburger menu — opens the BurgerMenu slide-down panel
              with the 6 priority nav destinations + Sign in / Start
              free trial CTAs + a secondary grid of all other pages. */}
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
}
