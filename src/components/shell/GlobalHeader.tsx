// GlobalHeader — the ONE header used across every Thenetworkers
// surface. Four primary section links always visible on md+, brand
// on the left, search icon + avatar drawer on the right. Everything
// else (page sub-nav, category chips, cart badges, notifications)
// lives BELOW this strip in each surface's own chrome.
//
// Wiring:
//   • AppShell inlines this at the top of its bar (yard/edit/sell/etc)
//   • TradeCenterHeader renders it ABOVE its category strip
//   • AudienceGateBright uses it in place of its custom header
//   • Legal/Support/SiteBoard pages sit under a layout that includes it
//
// Mobile behaviour: brand + search icon + hamburger (opens overlay
// with the same 4 links + avatar). Mobile-first — 4 text links won't
// fit under 640px so they collapse behind the hamburger.

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Menu, Search, X } from "lucide-react";

const CREAM = "#FBF6EC";
const YELLOW = "#FFB300";
const HONEY_TEXT = "#B8860B";
const INK = "#1B1A17";

/** The four primary sections. Order matters — reads left-to-right
 *  by importance: community first, then discovery, then commerce. */
export const GLOBAL_NAV_ITEMS: ReadonlyArray<{
  href: string;
  label: string;
  ariaLabel: string;
}> = [
  { href: "/trade-off/yard",             label: "The Yard",       ariaLabel: "The Yard — community feed" },
  { href: "/trade-off/yard/canteens",    label: "Canteen",        ariaLabel: "Canteens — trade groups directory" },
  { href: "/trade-off/search?tab=inspiration", label: "Site Interest", ariaLabel: "Site Interest — image discovery" },
  { href: "/store",                      label: "Store",          ariaLabel: "Site Interest Store — buy AI-generated trade imagery" },
  { href: "/tc/trade-center",            label: "Trade Center",   ariaLabel: "Trade Center — the marketplace" },
  { href: "/apps",                       label: "App Templates",  ariaLabel: "App Templates — the App Warehouse" }
];

/** Right-side slot — parent supplies whatever avatar drawer /
 *  edit-mode pill / sign-in button belongs to that surface. Keeps
 *  GlobalHeader stateless about auth so it renders identically on
 *  server + client (no hydration mismatches). */
export function GlobalHeader({
  rightSlot,
  variant = "sticky"
}: {
  rightSlot?: React.ReactNode;
  /** "sticky" (default) — position: sticky top-0 with cream bg + bottom
   *  border, matches AppShell's current chrome.
   *  "plain" — no positioning / no border, for embedded contexts
   *  (e.g. inside TradeCenterHeader which owns its own frame). */
  variant?: "sticky" | "plain";
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchParams = useSearchParams();

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [mobileOpen]);

  // Suppress the entire header when the page is rendered inside the
  // CanteenMobileAppShowcase iframe (`?embed=1`). The showcase renders
  // the canteen as a phone mockup — a duplicate platform header
  // inside that phone looks like a second app-store chrome and breaks
  // the illusion. Early return AFTER hooks per Rules of Hooks.
  if (searchParams?.get("embed") === "1") return null;

  const outerCls = variant === "sticky"
    ? "sticky top-0 z-40 border-b"
    : "border-b";

  return (
    <>
      <header
        className={outerCls}
        style={{ backgroundColor: CREAM, borderColor: "rgba(27,26,23,0.08)" }}
      >
        <div className="mx-auto flex max-w-[1400px] items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6 sm:py-2.5">
          {/* Brand → landing */}
          <Link
            href="/"
            className="inline-flex shrink-0 items-center gap-1.5"
            aria-label="Thenetworkers — home"
          >
            <span
              aria-hidden
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: YELLOW }}
            />
            <span
              className="hidden text-[12px] font-black uppercase tracking-[0.20em] sm:inline"
              style={{ color: HONEY_TEXT }}
            >
              Thenetworkers
            </span>
          </Link>

          {/* Primary nav — md+ only. Yellow-dot text links. Under md
              they collapse behind the hamburger; the AppShell mobile
              bottom nav covers day-to-day navigation there. */}
          <nav className="hidden items-center gap-2 md:flex" aria-label="Primary">
            {GLOBAL_NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-1.5 py-1 hover:bg-black/[0.04]"
                aria-label={item.ariaLabel}
                title={item.label}
                style={{ color: INK }}
              >
                <span
                  aria-hidden
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: YELLOW }}
                />
                <span className="text-[12px] font-black uppercase tracking-[0.16em]">
                  {item.label}
                </span>
              </Link>
            ))}
          </nav>

          <div className="min-w-0 flex-1"/>

          {/* Search icon — always visible, always routes to the
              search page with the input focused. No inline input
              in the strip (eats horizontal space, kills primary
              nav on tablet). */}
          <Link
            href="/trade-off/search"
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-black/[0.04]"
            aria-label="Search trades and Site Interest"
            title="Search"
          >
            <Search size={16} strokeWidth={2.4}/>
          </Link>

          {/* Right slot — auth-aware content (avatar drawer, sign in
              button, edit-mode pill) supplied by the parent so this
              component stays stateless. */}
          {rightSlot}

          {/* Mobile hamburger — md-hidden. Opens overlay with the
              4 links + right-slot echo. */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-neutral-700 transition hover:bg-black/[0.04] md:hidden"
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={17} strokeWidth={2.4}/>
          </button>
        </div>
      </header>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] md:hidden"
          style={{ backgroundColor: "rgba(10,10,10,0.85)", backdropFilter: "blur(8px)" }}
          onClick={() => setMobileOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute right-0 top-0 h-full w-[280px] max-w-[85vw] p-5"
            style={{ backgroundColor: CREAM }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex items-center gap-1.5">
                <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: YELLOW }}/>
                <span className="text-[12px] font-black uppercase tracking-[0.20em]" style={{ color: HONEY_TEXT }}>
                  Thenetworkers
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-black/[0.04]"
                aria-label="Close menu"
              >
                <X size={17} strokeWidth={2.4}/>
              </button>
            </div>

            <nav className="mt-5 flex flex-col gap-1" aria-label="Primary (mobile)">
              {GLOBAL_NAV_ITEMS.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="inline-flex items-center gap-2.5 rounded-lg px-3 py-3 transition hover:bg-black/[0.04]"
                  style={{ color: INK }}
                >
                  <span aria-hidden className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: YELLOW }}/>
                  <span className="text-[14px] font-black uppercase tracking-[0.14em]">
                    {item.label}
                  </span>
                </Link>
              ))}
              <Link
                href="/trade-off/search"
                onClick={() => setMobileOpen(false)}
                className="mt-3 inline-flex items-center gap-2.5 rounded-lg px-3 py-3 transition hover:bg-black/[0.04]"
                style={{ color: INK }}
              >
                <Search size={14} strokeWidth={2.4}/>
                <span className="text-[14px] font-black uppercase tracking-[0.14em]">
                  Search
                </span>
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
