"use client";

// The Network — public header. Rebranded 2026-07-10 from the old dark
// XratedHeader. Light cream backdrop matching the Yard + Warehouse,
// plain text links, no dark chrome. Kept as an `XratedHeader` export
// so every existing import continues to work.

import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BurgerMenu } from "./BurgerMenu";
import { NotebookBell } from "./NotebookBell";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

export function XratedHeader() {
  const brand = XRATED_BRAND.name;
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur"
      style={{
        backgroundColor: "rgba(251,246,236,0.96)",
        borderBottom: "1px solid rgba(139,69,19,0.15)"
      }}
    >
      <div className="mx-auto flex h-[60px] max-w-6xl items-center justify-between gap-3 px-4 sm:h-[68px] sm:gap-4">
        {/* Wordmark — canonical: yellow dot before "The Network" text.
            Rule: this exact pattern is the platform logo everywhere. */}
        <a
          href="/trade-off"
          aria-label={`${brand} home`}
          className="flex shrink-0 items-center gap-2"
        >
          <span
            className="block h-3 w-3 flex-shrink-0 rounded-full shadow-sm sm:h-3.5 sm:w-3.5"
            style={{ backgroundColor: BRAND_YELLOW }}
            aria-hidden="true"
          />
          <span
            className="text-[16px] font-black tracking-tight sm:text-[18px]"
            style={{ color: BRAND_BLACK }}
          >
            {brand}
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <a
            href="/trade-off/yard"
            className="hidden items-center text-[12px] font-bold tracking-wide text-neutral-700 transition hover:text-neutral-900 md:inline-flex"
          >
            The Yard
          </a>
          <a
            href="/apps"
            className="hidden items-center text-[12px] font-bold tracking-wide text-neutral-700 transition hover:text-neutral-900 md:inline-flex"
          >
            App Warehouse
          </a>
          <a
            href="/trade-off/yard?topic=news"
            className="hidden items-center text-[12px] font-bold tracking-wide text-neutral-700 transition hover:text-neutral-900 md:inline-flex"
          >
            Trade News
          </a>

          {/* Notebook bell — silent for logged-out visitors, red-dot
              badge when the signed-in merchant has action-required
              events. Renders nothing at all when there's no session. */}
          <NotebookBell/>

          {/* Log in — routes to the login page. Kept prominent on
              every public page so a tradesperson can find their way
              back to their dashboard without hunting through the
              burger menu. */}
          <a
            href="/trade-off/login"
            className="inline-flex h-9 items-center rounded-full px-3 text-[12px] font-black uppercase tracking-wider transition active:scale-[0.97]"
            style={{ backgroundColor: BRAND_YELLOW, color: BRAND_BLACK }}
          >
            Log in
          </a>

          {/* Hamburger menu — slide-down panel with priority nav
              destinations + secondary grid of all pages. */}
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
}
