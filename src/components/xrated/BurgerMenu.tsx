"use client";

// The Network — burger menu overlay. Facebook-style: primary
// destinations as tiles at the top, personal actions in the middle,
// secondary pages buried under a collapsed "More" section so nothing
// important gets diluted by a boring link dump.
//
// Cream theme (matches the platform), yellow-dot brand mark, deep grid
// pattern. Opens from the header hamburger.

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Home, Layers, Sparkles, Newspaper, Wrench, Users, MapPin, Package,
  X, ChevronRight, LogIn, UserPlus, Settings, HelpCircle, ChevronDown
} from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK } from "@/lib/brand/tokens";

const CREAM = "#FBF6EC";
const CARD_BG = "#FFFFFF";

// Primary tiles — the 6 top destinations, Facebook-style icon tiles.
const PRIMARY_TILES: Array<{ href: string; label: string; icon: typeof Home; sub: string }> = [
  { href: "/trade-off",              label: "Home",            icon: Home,     sub: "Latest across the network" },
  { href: "/trade-off/yard",         label: "The Yard",        icon: Users,    sub: "Trades board · hire, chat, deals" },
  { href: "/apps",                   label: "App Warehouse",   icon: Layers,   sub: "Every calculator + quote form" },
  { href: "/studio/editor",          label: "Studio",          icon: Sparkles, sub: "Build your profile" },
  { href: "/trade-off/yard?topic=news", label: "Trade News",   icon: Newspaper, sub: "Construction news + updates" },
  { href: "/trade-off/pricing",      label: "Pricing",         icon: Package,  sub: "Free · Pro · Verified" }
];

// Buried secondary pages — collapsed by default, expanded on tap.
// Kept short-titled and grouped so they surface without dominating.
const BURIED_PAGES: Array<{ section: string; items: Array<{ href: string; label: string }> }> = [
  {
    section: "Explore",
    items: [
      { href: "/showcase", label: "Showcase" },
      { href: "/trade-off/trades", label: "Trade examples" },
      { href: "/trade-off/services", label: "Service cards" },
      { href: "/trade-off/reviews", label: "Customer reviews" }
    ]
  },
  {
    section: "About the platform",
    items: [
      { href: "/trade-off/what", label: "What is it?" },
      { href: "/trade-off/how", label: "How it works" },
      { href: "/trade-off/why", label: "Why use it" },
      { href: "/trade-off/compare", label: "Why choose us" },
      { href: "/trade-off/success", label: "Success stories" }
    ]
  },
  {
    section: "Grow your trade",
    items: [
      { href: "/trade-off/verified", label: "Verified Business" },
      { href: "/trade-off/trust", label: "Trust Score" },
      { href: "/trade-off/add-ons", label: "Add-ons" },
      { href: "/trade-off/tips", label: "Tips for trades" },
      { href: "/trade-off/share", label: "Share anywhere" }
    ]
  },
  {
    section: "Support",
    items: [
      { href: "/trade-off/faq", label: "FAQ" },
      { href: "/trade-off/help", label: "Help centre" },
      { href: "/site-office", label: "The Site Office" }
    ]
  },
  {
    section: "Legal",
    items: [
      { href: "/legal/terms", label: "Terms of Service" },
      { href: "/legal/privacy", label: "Privacy Policy" },
      { href: "/legal/cookies", label: "Cookies" }
    ]
  }
];

export function BurgerMenu() {
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [merchantSlug, setMerchantSlug] = useState<string | null>(null);

  useEffect(() => {
    // Detect signed-in state by hitting the session check endpoint —
    // works with the HMAC-signed cookie without exposing its value.
    fetch("/api/trade-off/session", { cache: "no-store" })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.ok && data.slug) {
          setSignedIn(true);
          setMerchantSlug(data.slug);
        }
      })
      .catch(() => {
        // Session check endpoint may not exist yet — silent fallback.
      });
  }, []);

  const doLogout = async () => {
    await fetch("/api/trade-off/logout", { method: "POST" });
    setSignedIn(false);
    setMerchantSlug(null);
    setOpen(false);
    window.location.href = "/";
  };

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
        aria-controls="network-burger-panel"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-800 transition hover:bg-neutral-900/5"
      >
        {open ? (
          <X size={20} strokeWidth={2.25}/>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity ${
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        id="network-burger-panel"
        role="dialog"
        aria-label="Site navigation"
        className={`fixed inset-x-0 top-0 z-50 origin-top transform overflow-y-auto shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "-translate-y-full"
        }`}
        style={{ maxHeight: "100vh", backgroundColor: CREAM }}
      >
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 sm:pt-5">
          {/* Header row — brand mark + close */}
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="block h-3 w-3 rounded-full"
                style={{ backgroundColor: BRAND_YELLOW }}
                aria-hidden="true"
              />
              <span
                className="text-[16px] font-black tracking-tight"
                style={{ color: BRAND_BLACK }}
              >
                The Network
              </span>
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-700 transition hover:bg-neutral-900/5"
            >
              <X size={18} strokeWidth={2.5}/>
            </button>
          </div>

          {/* Primary tiles — Facebook-style icon grid */}
          <div>
            <div className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-neutral-500">
              Go to
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PRIMARY_TILES.map((t) => {
                const I = t.icon;
                return (
                  <Link
                    key={t.href}
                    href={t.href}
                    onClick={() => setOpen(false)}
                    className="group flex items-start gap-3 rounded-xl border p-3 transition hover:-translate-y-0.5 hover:shadow-md sm:p-4"
                    style={{ backgroundColor: CARD_BG, borderColor: "rgba(139,69,19,0.12)" }}
                  >
                    <div
                      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: BRAND_BLACK }}
                    >
                      <I size={18} color={BRAND_YELLOW} strokeWidth={2}/>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[14px] font-black leading-tight text-neutral-900">
                        {t.label}
                      </div>
                      <div className="mt-0.5 text-[11px] leading-snug text-neutral-500">
                        {t.sub}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Sign in / Join CTAs — swap to signed-in view when a
              trade session is active. */}
          {signedIn ? (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                href={merchantSlug ? `/trade-off/notebook/${merchantSlug}` : "/trade-off/edit"}
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <UserPlus size={14} strokeWidth={2.5}/>
                My Notebook
              </Link>
              <button
                type="button"
                onClick={doLogout}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-neutral-900/15 bg-white text-[13px] font-black uppercase tracking-wider text-neutral-900 transition hover:bg-neutral-50"
              >
                <LogIn size={14} strokeWidth={2.5} className="scale-x-[-1]"/>
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Link
                href="/trade-off/login"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full border border-neutral-900/15 bg-white text-[13px] font-black uppercase tracking-wider text-neutral-900 transition hover:bg-neutral-50"
              >
                <LogIn size={14} strokeWidth={2.5}/>
                Log in
              </Link>
              <Link
                href="/trade-off/signup"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-full text-[13px] font-black uppercase tracking-wider text-neutral-900 shadow-md transition active:scale-[0.97]"
                style={{ backgroundColor: BRAND_YELLOW }}
              >
                <UserPlus size={14} strokeWidth={2.5}/>
                Join Free
              </Link>
            </div>
          )}

          {/* Buried More — collapsed by default, opens the deep grid */}
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-lg border border-neutral-900/10 bg-white/60 px-3 py-2.5 text-left transition hover:bg-white"
              aria-expanded={moreOpen}
            >
              <span className="flex items-center gap-2">
                <Wrench size={13} className="text-neutral-500"/>
                <span className="text-[12px] font-black uppercase tracking-wider text-neutral-700">
                  More on The Network
                </span>
              </span>
              <ChevronDown
                size={16}
                className="text-neutral-500 transition-transform"
                style={{ transform: moreOpen ? "rotate(180deg)" : "rotate(0deg)" }}
              />
            </button>

            {moreOpen && (
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {BURIED_PAGES.map((group) => (
                  <div key={group.section} className="rounded-lg border border-neutral-900/8 bg-white/60 p-3">
                    <div className="mb-1.5 text-[10px] font-black uppercase tracking-[0.18em] text-neutral-500">
                      {group.section}
                    </div>
                    <ul className="flex flex-col">
                      {group.items.map((it) => (
                        <li key={it.href}>
                          <Link
                            href={it.href}
                            onClick={() => setOpen(false)}
                            className="flex items-center justify-between rounded px-1 py-1.5 text-[12px] text-neutral-700 transition hover:bg-neutral-100 hover:text-neutral-900"
                          >
                            {it.label}
                            <ChevronRight size={12} className="text-neutral-400"/>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer strip — Settings + help + small brand caption */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-neutral-900/10 pt-4">
            <div className="flex gap-3">
              <Link
                href="/trade-off/help"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition hover:text-neutral-800"
              >
                <HelpCircle size={12}/>
                Help
              </Link>
              <Link
                href="/trade-off/faq"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition hover:text-neutral-800"
              >
                <Settings size={12}/>
                FAQ
              </Link>
              <Link
                href="/apps"
                onClick={() => setOpen(false)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-neutral-500 transition hover:text-neutral-800"
              >
                <MapPin size={12}/>
                Site map
              </Link>
            </div>
            <p className="text-[10px] leading-snug text-neutral-500">
              The Network — Of The Construction Trades.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
