"use client";

// Thenetworkers — public header. Rebranded 2026-07-10 from the old dark
// XratedHeader. Light cream backdrop matching the Yard + Warehouse,
// plain text links, no dark chrome. Kept as an `XratedHeader` export
// so every existing import continues to work.
//
// Auth-aware CTA: reads /api/trade-off/session on mount. Shows a
// prominent "Log in" pill for signed-out visitors, swaps to a "Sign
// out" pill (routing to /api/trade-off/logout) for signed-in
// merchants. Cookie is httpOnly so the JS side must go through the
// API endpoint — no direct document.cookie access is possible.

import { XRATED_BRAND } from "@/lib/xratedTrades";
import { BurgerMenu } from "./BurgerMenu";
import { NotebookBell } from "./NotebookBell";
import { UserMenuDropdownClient } from "@/components/UserMenuDropdownClient";
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
        {/* Wordmark — canonical: yellow dot before "Thenetworkers" text.
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

          {/* Facebook-style avatar dropdown — primary auth surface.
              Anonymous → Sign in / Sign up pills. Signed-in →
              avatar + chevron opening a menu with home link +
              secondary nav + Log out. Client-fetches its own
              context via /api/user-menu-context. */}
          <UserMenuDropdownClient/>

          {/* Hamburger menu — slide-down panel with priority nav
              destinations + secondary grid of all pages. */}
          <BurgerMenu />
        </div>
      </div>
    </header>
  );
}
