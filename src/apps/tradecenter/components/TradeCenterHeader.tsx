// Marketplace top bar — matches the landing mock.
//
// Sticky, off-white, thin. Yellow dot + wordmark on the left; universal
// search in the middle (`/` shortcut); on the right, two different
// treatments:
//   GUEST  — [Sign in] text + [Sign up free] yellow pill + [☰] burger
//   AUTHED — Messages / Orders / Favourites / Basket / Bell / Chip
//            plus the same burger for account/help.
//
// Auth state comes from useCurrentTrade(); its cached-first strategy
// means returning users don't see a guest flash.

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  UserPlus,
  HelpCircle
} from "lucide-react";
import { GlobalIdentityChip } from "@/apps/social/components/GlobalIdentityChip";
import { UnifiedInboxBell } from "./UnifiedInboxBell";
import { useCurrentTrade } from "@/lib/useCurrentTrade";
import { GlobalHeader } from "@/components/shell/GlobalHeader";
import type { RailCategorySlug } from "../data/categoryTaxonomy";

export type TradeCenterHeaderProps = {
  /** Unread messages count. */
  messagesBadge?: number;
  /** Basket item count. */
  basketCount?: number;
  /** Basket total in GBP. */
  basketTotalGbp?: number;
  /** Currently active category — highlights inside the mobile drawer. */
  activeCategorySlug?: RailCategorySlug | null;
  /** Left-side wordmark. Defaults to "TRADE CENTER". Canteen surfaces
   *  pass "CANTEEN" so the header identifies the current surface. */
  wordmark?: string;
  /** Where the wordmark link routes. Defaults to Hub / Trade Center
   *  based on viewer role. Canteen surfaces pass "/canteen". */
  homeHref?: string;
};

export function TradeCenterHeader({
  messagesBadge = 3,
  basketCount: basketCountProp,
  basketTotalGbp: basketTotalGbpProp,
  activeCategorySlug: _activeCategorySlug = null,
  wordmark,
  homeHref
}: TradeCenterHeaderProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  // Seed from ?q= so the search input reflects the current query
  // after a search-page render. Otherwise starts empty.
  const initialQuery = searchParams?.get("q") ?? "";
  const [query, setQuery] = useState(initialQuery);
  const { trade } = useCurrentTrade();
  const pathname = usePathname() ?? "/tc/trade-center";
  const nextParam = encodeURIComponent(pathname);
  // Hydration guard — useCurrentTrade() returns null on server (no
  // cookies) but cached data on client, which used to swap
  // <Help link> for <UnifiedInboxBell> mid-hydration and blow up
  // React with a mismatch. Force the guest cluster on first paint,
  // then flip to authed after mount if the cache has a trade.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setHydrated(true); }, []);
  const isGuest = !hydrated || trade === null;

  // Keep the input in sync when the URL changes (e.g. back/forward).
  useEffect(() => {
    setQuery(searchParams?.get("q") ?? "");
  }, [searchParams]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    // Empty submit clears the search — route to base trade-center.
    if (!q) {
      router.push("/tc/trade-center");
      return;
    }
    router.push(`/tc/trade-center?q=${encodeURIComponent(q)}`);
  }
  // basketCount / basketTotalGbp / messagesBadge props kept in the
  // signature for backwards compat with callers, but no longer
  // consumed here — the cart pill has moved into the category toolbar
  // and the UnifiedInboxBell computes its own unread counts. Silently
  // ignored props are cheaper than a breaking rename right now.
  void basketCountProp;
  void basketTotalGbpProp;
  void messagesBadge;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        e.key === "/" &&
        target &&
        target.tagName !== "INPUT" &&
        target.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {/* Global escape hatches — same 4-link strip that lives on
          every other Thenetworkers surface, sits ABOVE the TC-
          specific header so users can always jump to Yard /
          Canteen / Site Interest / Trade Center in one tap. */}
      <GlobalHeader/>
    <header
      className="sticky top-0 z-30 border-b bg-[#FBF6EC]/95 backdrop-blur"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <div className="flex w-full items-center gap-4 px-4 py-3">
        {/* Left: brand wordmark. Trades land on the Hub dashboard;
            DIY viewers go direct to /tc/trade-center since Hub is a
            trade-only surface per the constitutional rule. Tagline
            dropped — it was trade-only messaging that doesn't fit the
            DIY audience. Cleaner wordmark is more professional. */}
        <Link
          href={homeHref ?? (trade?.viewerRole === "diy" ? "/tc/trade-center" : "/tc/hub")}
          className="flex flex-shrink-0 items-center gap-2"
        >
          <span
            className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-full"
            style={{ backgroundColor: "#FFB300" }}
            aria-hidden
          />
          <div className="text-[14px] font-black tracking-tight text-neutral-900">
            {wordmark ?? "TRADE CENTER"}
          </div>
        </Link>

        {/* Center: search. Submits to /tc/trade-center?q=<query>; the
            category page picks it up and filters the fixture data.
            Enter = submit; the `/` global shortcut focuses the input. */}
        <form
          onSubmit={handleSearch}
          role="search"
          className="relative min-w-0 flex-1 max-w-2xl"
        >
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400"/>
          <input
            ref={searchRef}
            type="search"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products, brands, sellers…"
            className="w-full rounded-full border bg-white py-2 pl-9 pr-14 text-[13px] text-neutral-800 shadow-sm focus:border-yellow-400 focus:outline-none"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
            aria-label="Search Trade Center"
          />
          <kbd
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded border bg-white px-1.5 py-0.5 text-[10px] font-mono text-neutral-500"
            style={{ borderColor: "rgba(139,69,19,0.15)" }}
          >
            /
          </kbd>
          {/* Hidden submit — Enter still triggers submit via the form.
              Explicit for accessibility (some screen readers announce). */}
          <button type="submit" className="sr-only">Search</button>
        </form>

        {/* Right: guest vs authed rendering */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {isGuest ? (
            <>
              {/* Cart pill removed from header — cart lives in the
                  category toolbar (right of the Trade Quotes pill for
                  trades, or standalone for DIY/guest). One cart button
                  only, no duplication. */}
              <Link
                href="/tc/help"
                aria-label="Help & guides"
                title="Help"
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 transition hover:bg-neutral-200/50"
              >
                <HelpCircle size={16}/>
              </Link>
              <Link
                href={`/tc/sign-in?next=${nextParam}`}
                className="hidden rounded-full px-3 py-1.5 text-[12px] font-bold text-neutral-800 transition hover:bg-neutral-200/50 sm:inline-flex"
              >
                Sign in
              </Link>
              <Link
                href={`/tc/sign-in?next=${nextParam}&signup=1`}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-[12px] font-black uppercase tracking-wider shadow-sm transition hover:brightness-105"
                style={{ backgroundColor: "#FFB300", color: "#0A0A0A" }}
              >
                <UserPlus size={13} strokeWidth={2.2}/>
                <span>Sign up free</span>
              </Link>
            </>
          ) : (
            <>
              {/* Authed cluster — two items now, on the far right:
                    1. UnifiedInboxBell  (messages + notifications)
                    2. GlobalIdentityChip  (icon-only, dropdown holds
                       the account menu)
                  Basket cart pill removed from header — cart lives in
                  the category toolbar (right of the Trade Quotes pill)
                  as a single non-duplicated affordance. */}
              <UnifiedInboxBell/>
              <GlobalIdentityChip/>
            </>
          )}
        </nav>
      </div>
    </header>
    </>
  );
}

