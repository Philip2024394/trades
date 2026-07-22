// /logo — Networkers Logo Studio.
//
// First-class section of the platform with its own visual identity.
// Not gated (guests can browse and buy). Domain-pointable later via a
// Next middleware rewrite. Shares Stripe + auth + canteen linking
// engines with the rest of The Networkers.

import Link from "next/link";
import { Sparkles } from "lucide-react";

export const metadata = {
  title:       "Logo Studio — The Networkers",
  description: "Trade-native logo builder. Pick a style, name your business, download a logo built for vans, workwear and directory listings."
};

const BRAND_YELLOW = "#FFB300";
const BRAND_BLACK  = "#0A0A0A";
const BG_CREAM     = "#FBF6EC";

export default function LogoStudioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: BG_CREAM, color: BRAND_BLACK }}>
      {/* Slim brand header — Networkers wordmark + section label. */}
      <header className="sticky top-0 z-30 border-b border-neutral-200 backdrop-blur" style={{ backgroundColor: `${BG_CREAM}f2` }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <Link href="/logo" className="flex items-center gap-2.5">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full" style={{ backgroundColor: BRAND_YELLOW }}>
              <Sparkles size={14} strokeWidth={2.6} color={BRAND_BLACK}/>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-black">The Networkers</span>
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-neutral-500">Logo Studio</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-4 text-[12px] font-semibold text-neutral-700 sm:flex">
            <Link href="/logo" className="hover:text-neutral-900">Home</Link>
            <Link href="/logo/build" className="hover:text-neutral-900">Build a logo</Link>
            <Link href="/logo/van" className="hover:text-neutral-900">Van preview</Link>
            <Link href="/logo#pricing" className="hover:text-neutral-900">Pricing</Link>
            <Link
              href="/logo/build"
              className="rounded-full px-3 py-1.5 font-black transition hover:brightness-95"
              style={{ backgroundColor: BRAND_BLACK, color: BRAND_YELLOW }}
            >
              Start
            </Link>
          </nav>
        </div>
      </header>

      <main>{children}</main>

      {/* Slim marketing footer — part of The Networkers, links home. */}
      <footer className="mt-16 border-t border-neutral-200 py-6 text-center text-[11px] text-neutral-500">
        <div className="mx-auto max-w-6xl px-4">
          Part of <Link href="/" className="font-black text-neutral-800 hover:underline">The Networkers</Link>. Built for UK trades.
        </div>
      </footer>
    </div>
  );
}
