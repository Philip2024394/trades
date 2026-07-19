// /store — Site Interest B2B storefront.
//
// Standalone layout so the store can be pointed at its own domain
// (e.g. siteinterest.co.uk → /store) without inheriting the platform
// header. Own header + footer, own visual identity, marketing-quality.

import Link from "next/link";
import type { Metadata } from "next";
import { storeAllImages } from "@/lib/storeLibrary.server";
import { CartBadge } from "./CartBadge";
import { MemberBadge } from "./MemberBadge";

export const metadata: Metadata = {
  title:       "Site Interest — UK trade & construction imagery",
  description: "Hand-curated AI imagery for UK trades — rights-clean construction, plumbing, landscaping and finish-trade scenes. Buy a single image, a pack, or unlimited monthly.",
  robots:      { index: true, follow: true }
};

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const total = (await storeAllImages()).length;
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FBF6EC" }}>
      {/* ── Store header (its own, no platform chrome) ─────── */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "rgba(251,246,236,0.95)" }}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/store" className="flex items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
            <span className="text-[14px] font-black tracking-tight text-neutral-900">
              Site Interest
            </span>
            <span className="hidden text-[10px] font-bold uppercase tracking-wider text-neutral-500 sm:inline">
              · Trade imagery
            </span>
          </Link>
          <nav className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider">
            <Link href="/store/browse" className="hidden sm:inline-flex rounded-md px-3 py-1.5 text-neutral-700 transition hover:bg-neutral-100">
              Browse {total}+
            </Link>
            <Link href="/store#pricing" className="hidden sm:inline-flex rounded-md px-3 py-1.5 text-neutral-700 transition hover:bg-neutral-100">
              Pricing
            </Link>
            <MemberBadge/>
            <CartBadge/>
          </nav>
        </div>
      </header>

      {children}

      {/* ── Store footer ────────────────────────────────────── */}
      <footer
        className="mt-16 border-t py-8"
        style={{ borderColor: "rgba(0,0,0,0.08)", backgroundColor: "#F5EFDF" }}
      >
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="flex items-center gap-2 text-[13px] font-black text-neutral-900">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#FFB300" }}/>
              Site Interest
            </div>
            <nav className="flex flex-wrap gap-4 text-[11px] font-bold text-neutral-500">
              <Link href="/store" className="transition hover:text-neutral-900">Home</Link>
              <Link href="/store/browse" className="transition hover:text-neutral-900">Browse</Link>
              <Link href="/store#pricing" className="transition hover:text-neutral-900">Pricing</Link>
              <Link href="/store/membership" className="transition hover:text-neutral-900">Membership</Link>
              <Link href="/store/login" className="transition hover:text-neutral-900">Members sign in</Link>
              <Link href="/legal/image-licence" className="transition hover:text-neutral-900">Licence</Link>
              <Link href="/store#faq" className="transition hover:text-neutral-900">FAQ</Link>
            </nav>
          </div>
          <p className="mt-4 text-[10px] leading-snug text-neutral-500">
            © Thenetworkers Ltd. All images hand-curated AI imagery, owned
            outright by Thenetworkers Ltd. Commercial use permitted under licence —
            no redistribution or resale to third-party stock libraries. See{" "}
            <Link href="/legal/image-licence" className="underline">licence terms</Link>.
          </p>
        </div>
      </footer>
    </div>
  );
}
