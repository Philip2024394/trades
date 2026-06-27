"use client";

// Xrated Trades — burger menu overlay. Opens from the header button
// (XratedHeader). Renders a full-screen slide-down with the 6 priority
// destinations + a quick "Sign in" + "Start free trial" CTA. The
// underlying header button stays an aria-controls anchor for a11y.

import { useEffect, useState } from "react";
import { XRATED_BRAND } from "@/lib/xratedTrades";

const MENU_ITEMS = [
  { href: "/trade-off/what", label: "What is XRatedTrade?", sub: "Start here" },
  { href: "/trade-off/how", label: "How it works", sub: "5 minutes from claim to live" },
  { href: "/trade-off/pricing", label: "Pricing", sub: "Free · £14.99/mo · £19.99/mo Verified" },
  { href: "/trade-off/add-ons", label: "Add-ons", sub: "Shop · Services · Job Diary · 5 more" },
  { href: "/trade-off/yard", label: "The Yard", sub: "Private trades-only board — hire, available, chat" },
  { href: "/trade-off/verified", label: "Verified Business", sub: "Backed by company-registration check" },
  { href: "/trade-off/trust", label: "Trust Score", sub: "Build customer confidence" },
  { href: "/trade-off/trades", label: "Trade examples", sub: "See profiles for your trade" }
];

export function BurgerMenu() {
  const [open, setOpen] = useState(false);

  // Close on Escape; restore body scroll when closed.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="xrated-burger-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      {/* Dim backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* Slide-down panel */}
      <aside
        id="xrated-burger-panel"
        role="dialog"
        aria-label="Site navigation"
        className={`fixed inset-x-0 top-0 z-50 origin-top transform overflow-y-auto bg-neutral-950 text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ maxHeight: "calc(100vh - 0px)" }}
      >
        <div className="mx-auto max-w-6xl px-5 pb-10 pt-[80px] sm:px-8 sm:pt-[88px]">
          <div className="flex items-center justify-between">
            <p
              className="text-[10px] font-extrabold uppercase tracking-[0.28em]"
              style={{ color: XRATED_BRAND.accent }}
            >
              Menu
            </p>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold uppercase tracking-wider text-white/70 transition hover:text-white"
            >
              Close
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <ul className="mt-6 flex flex-col gap-2 sm:gap-3">
            {MENU_ITEMS.map((it) => (
              <li key={it.href}>
                <a
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-4 transition hover:border-[color:var(--accent)] hover:bg-white/10 sm:px-5"
                  style={{ ["--accent" as never]: XRATED_BRAND.accent }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-extrabold text-white sm:text-lg">
                      {it.label}
                    </span>
                    <span className="block text-xs text-white/60 sm:text-sm">
                      {it.sub}
                    </span>
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="shrink-0 text-white/40 transition group-hover:translate-x-1 group-hover:text-white">
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </a>
              </li>
            ))}
          </ul>

          {/* Quick-access CTAs */}
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
            <a
              href="/trade-off/signin"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-transparent px-4 text-xs font-bold uppercase tracking-wider text-white transition hover:bg-white/10 sm:text-sm"
            >
              Sign in
            </a>
            <a
              href="/trade-off/signup"
              onClick={() => setOpen(false)}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-extrabold uppercase tracking-wider text-neutral-900 shadow-lg transition active:scale-[0.98] sm:text-sm"
              style={{ background: XRATED_BRAND.accent, boxShadow: `0 8px 24px ${XRATED_BRAND.accent}55` }}
            >
              Start free trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </a>
          </div>

          {/* Secondary destinations */}
          <div className="mt-8 grid grid-cols-2 gap-x-6 gap-y-2 text-xs text-white/60 sm:grid-cols-3">
            {[
              { href: "/trade-off/why", label: "Why use it" },
              { href: "/trade-off/compare", label: "Why choose us" },
              { href: "/trade-off/services", label: "Service cards" },
              { href: "/trade-off/reviews", label: "Customer reviews" },
              { href: "/trade-off/share", label: "Share anywhere" },
              { href: "/trade-off/trades", label: "Trade examples" },
              { href: "/trade-off/success", label: "Success stories" },
              { href: "/trade-off/tips", label: "Tips for trades" },
              { href: "/trade-off/faq", label: "FAQ" },
              { href: "/trade-off/help", label: "Help centre" }
            ].map((it) => (
              <a
                key={it.href}
                href={it.href}
                onClick={() => setOpen(false)}
                className="py-1 transition hover:text-white"
              >
                {it.label}
              </a>
            ))}
          </div>

          <p className="mt-8 text-[11px] text-white/40">
            Xrated Trades — the shareable trade profile for tradies anywhere.
          </p>
        </div>
      </aside>
    </>
  );
}
