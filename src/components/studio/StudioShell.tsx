"use client";

// Studio workspace shell — left sidebar navigation + top bar +
// content slot. Loaded once by the gated /studio/(app)/layout.tsx.
// Every module inside the shell renders as children.
//
// Design: minimal, dark-on-light, yellow accent for the active state.
// Beginner-safe icons + labels. Mobile: sidebar collapses into a
// bottom sheet; desktop: sidebar is always visible.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { StudioBrand, StudioMerchant } from "@/lib/studio/session";
import { OfflineBanner } from "./OfflineBanner";
import { StudioToaster } from "./Toaster";

const YELLOW = "#FFB300";
const BLACK = "#0A0A0A";

type NavItem = {
  href: string;
  label: string;
  icon: ReactNode;
  group: "workspace" | "content" | "system";
  /** If set, clicking the row expands an inline accordion of shortcuts
   *  instead of navigating. The label falls back to a full navigate on
   *  clicking the small "See all" chevron on the right of the row. */
  children?: { href: string; label: string }[];
};

// Section library shortcuts — exposed inline when merchant clicks
// Sections in the sidebar so they can jump straight to a category.
// The label is a static list matching the SectionLibrary union in
// sectionTypes.ts; the query-param picks up on the /studio/sections
// page via `?cat=hero` etc.
const SECTION_SHORTCUTS: { href: string; label: string }[] = [
  { href: "/studio/sections?cat=hero", label: "Hero" },
  { href: "/studio/sections?cat=faq", label: "FAQ" },
  { href: "/studio/sections?cat=testimonials", label: "Testimonials" },
  { href: "/studio/sections?cat=statistics", label: "Statistics" },
  { href: "/studio/sections?cat=features", label: "Features" },
  { href: "/studio/sections?cat=services", label: "Services" },
  { href: "/studio/sections?cat=pricing", label: "Pricing" },
  { href: "/studio/sections?cat=cta", label: "CTA" }
];

const NAV: NavItem[] = [
  {
    href: "/studio/home",
    label: "Home",
    group: "workspace",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m3 12 9-9 9 9" />
        <path d="M5 10v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V10" />
      </svg>
    )
  },
  {
    href: "/studio/pages",
    label: "Pages",
    group: "workspace",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    )
  },
  {
    href: "/studio/buttons",
    label: "Buttons",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="8" rx="4" />
      </svg>
    ),
    children: [
      { href: "/studio/buttons?cat=basic", label: "Basic" },
      { href: "/studio/buttons?cat=marketing", label: "Marketing" },
      { href: "/studio/buttons?cat=ecommerce", label: "Ecommerce" },
      { href: "/studio/buttons?cat=navigation", label: "Navigation" },
      { href: "/studio/buttons?cat=social", label: "Social" },
      { href: "/studio/buttons?cat=utility", label: "Utility" },
      { href: "/studio/buttons?cat=floating", label: "Floating" },
      { href: "/studio/buttons/global", label: "Global buttons" }
    ]
  },
  {
    href: "/studio/sections",
    label: "Sections",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="4" rx="1" />
        <rect x="3" y="10" width="18" height="4" rx="1" />
        <rect x="3" y="16" width="18" height="4" rx="1" />
      </svg>
    ),
    children: SECTION_SHORTCUTS
  },
  {
    href: "/studio/templates",
    label: "Templates",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    )
  },
  {
    href: "/studio/components",
    label: "Components",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
        <line x1="16" y1="8" x2="2" y2="22" />
        <line x1="17.5" y1="15" x2="9" y2="15" />
      </svg>
    )
  },
  {
    href: "/studio/media",
    label: "Media",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  },
  {
    href: "/studio/payments",
    label: "Payments",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/>
      </svg>
    ),
    children: [
      { href: "/studio/payments", label: "Providers" },
      { href: "/studio/payments/orders", label: "Orders" }
    ]
  },
  {
    href: "/studio/presets",
    label: "Presets",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="10.5" r="2.5" />
        <circle cx="6.5" cy="10.5" r="2.5" />
        <path d="M12 22a10 10 0 1 0 0-20" />
      </svg>
    )
  },
  {
    href: "/studio/brands",
    label: "Brands",
    group: "content",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  },
  {
    href: "/studio/settings",
    label: "Settings",
    group: "system",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    )
  }
];

const GROUP_LABEL: Record<NavItem["group"], string> = {
  workspace: "Workspace",
  content: "Content",
  system: "System"
};

export function StudioShell({
  merchant,
  brand,
  children
}: {
  merchant: StudioMerchant;
  brand: StudioBrand;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Nav rows with `children` expand inline. Track which rows are open
  // by their href (unique per row). Auto-expand a row when the user is
  // already inside its route so the shortcuts they'd expect stay
  // visible on refresh.
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  function toggleExpanded(href: string) {
    setExpanded((prev) => ({ ...prev, [href]: !prev[href] }));
  }

  const groups: NavItem["group"][] = ["workspace", "content", "system"];

  return (
    <StudioToaster>
    <div className="flex min-h-screen bg-neutral-50 text-neutral-900">
      {/* Sticky top banner surfaces offline / reconnect state above
          every Studio route. */}
      <OfflineBanner />
      {/* ─── Sidebar (desktop) ─────────────────────────────────── */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white sm:flex">
        <div className="flex items-center gap-2 px-5 py-5">
          <span
            className="grid h-9 w-9 place-items-center rounded-xl text-[13px] font-extrabold text-neutral-900"
            style={{ background: YELLOW }}
          >
            X
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-neutral-900">
              Studio
            </p>
            <p className="truncate text-[10px] font-bold uppercase tracking-widest text-neutral-500">
              {brand.name}
            </p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((g) => (
            <div key={g} className="mt-3">
              <p className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                {GROUP_LABEL[g]}
              </p>
              <ul className="space-y-0.5">
                {NAV.filter((n) => n.group === g).map((n) => {
                  const active =
                    pathname === n.href || pathname.startsWith(n.href + "/");
                  const hasChildren = !!n.children && n.children.length > 0;
                  const isOpen = hasChildren
                    ? (expanded[n.href] ?? active)
                    : false;

                  if (hasChildren) {
                    return (
                      <li key={n.href}>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(n.href)}
                          aria-expanded={isOpen}
                          className="flex h-10 w-full items-center gap-3 rounded-lg px-2 text-[13px] font-bold transition"
                          style={{
                            background: active ? YELLOW : "transparent",
                            color: active ? BLACK : "#404040"
                          }}
                        >
                          <span className="grid h-6 w-6 place-items-center">
                            {n.icon}
                          </span>
                          <span className="flex-1 truncate text-left">
                            {n.label}
                          </span>
                          <span
                            className="grid h-5 w-5 place-items-center transition-transform"
                            style={{
                              transform: isOpen
                                ? "rotate(180deg)"
                                : "rotate(0deg)"
                            }}
                            aria-hidden="true"
                          >
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="m6 9 6 6 6-6" />
                            </svg>
                          </span>
                        </button>
                        {/* Sliding accordion. Grid-rows trick: rows go
                            from 0fr → 1fr with a CSS transition, so the
                            child height animates smoothly without
                            hard-coding a max-height that breaks when
                            more shortcuts are added later. */}
                        <div
                          className="grid transition-[grid-template-rows] duration-200 ease-out"
                          style={{
                            gridTemplateRows: isOpen ? "1fr" : "0fr"
                          }}
                        >
                          <div className="overflow-hidden">
                            <ul className="ml-8 mt-1 flex flex-col gap-0.5 border-l border-neutral-200 pl-2">
                              {n.children!.map((c) => {
                                const childActive =
                                  pathname + (typeof window !== "undefined"
                                    ? window.location.search
                                    : "") === c.href;
                                return (
                                  <li key={c.href}>
                                    <Link
                                      href={c.href}
                                      className="block truncate rounded-md px-2 py-1.5 text-[12px] font-bold transition"
                                      style={{
                                        background: childActive
                                          ? "#F5F5F5"
                                          : "transparent",
                                        color: childActive ? BLACK : "#525252"
                                      }}
                                    >
                                      {c.label}
                                    </Link>
                                  </li>
                                );
                              })}
                              <li>
                                <Link
                                  href={n.href}
                                  className="block truncate rounded-md px-2 py-1.5 text-[11px] font-extrabold uppercase tracking-widest transition hover:bg-neutral-100"
                                  style={{ color: "#737373" }}
                                >
                                  See all →
                                </Link>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </li>
                    );
                  }

                  return (
                    <li key={n.href}>
                      <Link
                        href={n.href}
                        className="flex h-10 items-center gap-3 rounded-lg px-2 text-[13px] font-bold transition"
                        style={{
                          background: active ? YELLOW : "transparent",
                          color: active ? BLACK : "#404040"
                        }}
                      >
                        <span className="grid h-6 w-6 place-items-center">
                          {n.icon}
                        </span>
                        <span className="flex-1 truncate">{n.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <MerchantChip merchant={merchant} />
      </aside>

      {/* ─── Main column ────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
            className="grid h-9 w-9 place-items-center rounded-lg border border-neutral-200 sm:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <p className="hidden truncate text-[13px] font-bold text-neutral-500 sm:block">
            {merchant.display_name} · {brand.name}
          </p>
          <div className="flex-1" />
          <Link
            href="/studio/publish"
            className="inline-flex h-10 items-center rounded-xl px-4 text-[12px] font-extrabold uppercase tracking-widest transition hover:brightness-95"
            style={{ background: BLACK, color: "#FFFFFF" }}
          >
            Publish →
          </Link>
          <form action="/api/studio/exit" method="post">
            <button
              type="submit"
              className="inline-flex h-10 items-center rounded-lg border border-neutral-200 px-3 text-[11px] font-extrabold uppercase tracking-widest text-neutral-600 transition hover:border-neutral-300 hover:bg-neutral-50"
              title="Sign out of Studio"
            >
              Exit
            </button>
          </form>
        </header>

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {/* ─── Sidebar (mobile drawer) ────────────────────────────── */}
      {mobileNavOpen && (
        <div
          className="fixed inset-0 z-40 sm:hidden"
          onClick={() => setMobileNavOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute inset-y-0 left-0 w-64 overflow-y-auto bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-4">
              <p className="text-[13px] font-extrabold text-neutral-900">Studio</p>
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setMobileNavOpen(false)}
                className="grid h-8 w-8 place-items-center rounded-lg text-neutral-500 hover:bg-neutral-100"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {groups.map((g) => (
              <div key={g} className="px-3 pb-3">
                <p className="px-2 py-1 text-[9px] font-extrabold uppercase tracking-widest text-neutral-400">
                  {GROUP_LABEL[g]}
                </p>
                <ul className="space-y-0.5">
                  {NAV.filter((n) => n.group === g).map((n) => {
                    const active =
                      pathname === n.href || pathname.startsWith(n.href + "/");
                    return (
                      <li key={n.href}>
                        <Link
                          href={n.href}
                          onClick={() => setMobileNavOpen(false)}
                          className="flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-bold"
                          style={{
                            background: active ? YELLOW : "transparent",
                            color: active ? BLACK : "#404040"
                          }}
                        >
                          <span className="grid h-6 w-6 place-items-center">
                            {n.icon}
                          </span>
                          {n.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
    </StudioToaster>
  );
}

function MerchantChip({ merchant }: { merchant: StudioMerchant }) {
  return (
    <div className="border-t border-neutral-200 p-3">
      <div className="flex items-center gap-2 rounded-lg bg-neutral-50 p-2">
        {merchant.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={merchant.avatar_url}
            alt=""
            className="h-8 w-8 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold"
            style={{ background: YELLOW, color: BLACK }}
          >
            {merchant.display_name.slice(0, 2).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-[12px] font-extrabold text-neutral-900">
            {merchant.display_name}
          </p>
          <p className="truncate text-[10px] text-neutral-500">
            {merchant.city}
          </p>
        </div>
      </div>
    </div>
  );
}
