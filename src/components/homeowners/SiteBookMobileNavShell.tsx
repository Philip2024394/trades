"use client";

// SiteBookMobileNavShell — the top-level mobile chrome for /sitebook
// pages. Owns the sheet state and renders the bottom nav plus the
// pull-up sheets. Rails on the page stay hidden on mobile via
// `hidden md:block`; their content is passed here for the sheets.
//
// The default `moreContent` is a link list to App Store, How it works,
// Trade directory, Settings, Log out. Pages can override via prop.

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, HelpCircle, Users, Settings, LogOut, ChevronRight } from "lucide-react";
import { SiteBookMobileNav, type MobileSheetKey } from "./SiteBookMobileNav";

const BRAND_YELLOW = "#FFB300";

export function SiteBookMobileNavShell({
  tradesContent,
  photosContent,
  moreContent
}: {
  tradesContent: React.ReactNode;
  photosContent: React.ReactNode;
  /** Custom More-sheet content. Defaults to the standard link list. */
  moreContent?:  React.ReactNode;
}) {
  const [openSheet, setOpenSheet] = useState<MobileSheetKey>(null);

  function scrollToComposer() {
    const el = document.querySelector("[data-tour='composer'], [data-composer='true']");
    if (el instanceof HTMLElement) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
        input?.focus();
      }, 350);
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  return (
    <SiteBookMobileNav
      openSheet={openSheet}
      onSheetChange={setOpenSheet}
      onComposeFocus={scrollToComposer}
      tradesContent={tradesContent}
      photosContent={photosContent}
      moreContent={moreContent ?? <DefaultMoreSheet onNavigate={() => setOpenSheet(null)}/>}
    />
  );
}

function DefaultMoreSheet({ onNavigate }: { onNavigate: () => void }) {
  const links: { href: string; icon: typeof LayoutGrid; label: string; caption: string; danger?: boolean }[] = [
    { href: "?view=apps",                     icon: LayoutGrid,  label: "App Store",       caption: "Install tiles onto your SiteBook" },
    { href: "?guide=1",                       icon: HelpCircle,  label: "How it works",    caption: "3-step walkthrough" },
    { href: "/trade-off/yard/canteens",       icon: Users,       label: "Trades directory",caption: "Browse trades to invite" },
    { href: "/homeowners/settings",           icon: Settings,    label: "Settings",        caption: "Profile, password, banner" },
    { href: "/api/homeowner/logout",          icon: LogOut,      label: "Log out",         caption: "Sign out of this device",     danger: true }
  ];
  return (
    <ul className="space-y-1.5">
      {links.map((l) => {
        const Icon = l.icon;
        return (
          <li key={l.href}>
            <Link
              href={l.href}
              scroll={false}
              onClick={onNavigate}
              className="flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              style={{ borderColor: "rgba(0,0,0,0.08)" }}
            >
              <span
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  backgroundColor: l.danger ? "rgba(220,38,38,0.10)" : "rgba(255,179,0,0.15)",
                  color:           l.danger ? "#B91C1C" : "#7A4E00"
                }}
              >
                <Icon size={18} strokeWidth={2.3}/>
              </span>
              <div className="min-w-0 flex-1">
                <p className={"text-[13px] font-black " + (l.danger ? "text-red-800" : "text-neutral-900")}>{l.label}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{l.caption}</p>
              </div>
              <ChevronRight size={14} className="text-neutral-400" strokeWidth={2.5}/>
            </Link>
          </li>
        );
      })}
      <span className="hidden" style={{ color: BRAND_YELLOW }}/>
    </ul>
  );
}
