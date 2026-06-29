"use client";

// Xrated Trades — standalone header for the public Trade Off surface.
// Logo on the left. Right side: profile avatar + hamburger menu.
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
          {/* Showcase — hub page surfacing the 6 lead case studies as
              live, indexable Trade Off profiles. Sits next to News so
              readers exploring the brand can browse real worked
              examples in one click. */}
          <a
            href="/showcase"
            className="hidden h-9 items-center px-2 text-[12px] font-bold uppercase tracking-widest text-white/80 transition hover:text-white md:inline-flex"
          >
            Showcase
          </a>

          {/* News — public-facing newsroom (/news). Visible site-wide
              so readers can find it without opening the burger menu.
              Hidden on the smallest viewports to keep header compact;
              still available from the BurgerMenu on mobile. */}
          <a
            href="/news"
            className="hidden h-9 items-center px-2 text-[12px] font-bold uppercase tracking-widest text-white/80 transition hover:text-white md:inline-flex"
          >
            News
          </a>

          {/* Log in — routes to /trade-off/login for the phone+password
              auth flow. Visible on every public page so a tradesperson
              can find their way back into their dashboard without
              hunting through the burger menu. */}
          <a
            href="/trade-off/login"
            className="hidden h-9 items-center rounded-full border border-white/20 px-3 text-[12px] font-bold uppercase tracking-widest text-white/80 transition hover:border-white/40 hover:text-white sm:inline-flex"
          >
            Log in
          </a>
          <a
            href="/trade-off/login"
            className="inline-flex h-9 items-center px-2 text-[12px] font-bold text-white/80 underline-offset-2 transition hover:text-white hover:underline sm:hidden"
          >
            Log in
          </a>

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
