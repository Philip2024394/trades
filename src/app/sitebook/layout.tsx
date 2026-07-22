// /sitebook/* — app-shell layout for authed homeowner SiteBook area.
//
// LAYOUT: normal page scroll on all breakpoints. The top nav is
// sticky so it stays in view as the user scrolls the multi-column
// content below. (Previous fixed-viewport frame was clipping child
// content taller than the viewport, causing a black-screen bug when
// the inbox + feed grew past 100vh.)
//
// Redirects to /homeowners if neither a real homeowner session nor
// a guest cookie is present.

import { redirect } from "next/navigation";
import Link from "next/link";
import { BookOpen, HelpCircle } from "lucide-react";
import { getHomeownerFromCookie } from "@/lib/homeowners/auth";
import { getGuestSession } from "@/lib/homeowners/guestSession";
import { UserMenuDropdownMount } from "@/components/UserMenuDropdownMount";
import { AskSiteBookButton } from "@/components/homeowners/AskSiteBookButton";
import { MateWidget } from "@/components/mate/MateWidget";

export const dynamic = "force-dynamic";

const BRAND_YELLOW = "#FFB300";

export default async function SiteBookLayout({ children }: { children: React.ReactNode }) {
  const homeowner = await getHomeownerFromCookie();
  const guest     = await getGuestSession();

  if (!homeowner && !guest) redirect("/homeowners");

  const displayName = homeowner?.house_nickname || guest?.nickname || "SiteBook";
  const isGuest     = !homeowner && !!guest;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      {/* SiteBook shell nav — sticky at the top on all breakpoints */}
      <header className="sticky top-0 z-40 border-b border-neutral-200 backdrop-blur" style={{ backgroundColor: "#FBF6EC" }}>
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/sitebook" className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-900 shadow-sm" style={{ backgroundColor: BRAND_YELLOW }}>
              <BookOpen size={14} strokeWidth={2.4}/>
            </span>
            <span className="font-black text-neutral-900">SiteBook</span>
            <span className="hidden text-[11.5px] font-bold text-neutral-500 sm:inline">·</span>
            <span className="hidden truncate text-[11.5px] font-bold text-neutral-700 sm:inline sm:max-w-[240px]">
              {displayName}
            </span>
          </Link>
          <nav className="flex items-center gap-3 text-[11.5px] font-bold text-neutral-700">
            {isGuest ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-amber-800">
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500"/>
                Preview
              </span>
            ) : (
              <>
                <Link href="/sitebook" className="hover:text-neutral-900">Feed</Link>
                <Link
                  href="/sitebook?guide=1"
                  className="inline-flex items-center gap-1 text-neutral-600 hover:text-neutral-900"
                  title="Open the in-page feature guide"
                >
                  <HelpCircle size={12} strokeWidth={2.5}/> How it works
                </Link>
                {/* Threads / Settings / Log out live inside the
                    avatar dropdown now — canonical cross-context nav. */}
                <UserMenuDropdownMount/>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Normal page flow — children scroll with the document. */}
      <main>{children}</main>

      {/* Authed homeowners get the full Mate agent (memory, threads,
          proactive signals, photo). Guests get the lightweight
          AskSiteBookButton since they've no session to hang memory off. */}
      {homeowner ? <MateWidget surface="homeowner"/> : <AskSiteBookButton/>}
    </div>
  );
}
