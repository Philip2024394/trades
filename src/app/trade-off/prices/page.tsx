// /trade-off/prices — public live-price index.
//
// A search-first page that answers "what's the market price for this
// right now?". Types item → sees recent published prices + stats.
// Postcode narrows to nearby merchants first.

import type { Metadata } from "next";
import Link from "next/link";
import { PricesSearch } from "./PricesSearch";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Live construction prices · The Construction Notebook",
  description:
    "Real-time trade + merchant prices for construction materials near you. Published by merchants, updated daily."
};

export default function PublicPricesPage() {
  return (
    <main className="relative min-h-screen bg-[#FBF6EC] text-[#1B1A17]">
      <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-6 md:px-8 md:pt-10">
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#1B1A17]/60 hover:text-[#1B1A17]"
          >
            ← Notebook
          </Link>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
            <span
              aria-hidden
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: "#FFB300" }}
            />
            Live prices
          </span>
        </div>

        <h1 className="text-[30px] font-black leading-tight tracking-tight md:text-[42px]">
          What&apos;s it going for right now?
        </h1>
        <p className="mt-2 max-w-[62ch] text-[14px] leading-[1.55] text-[#1B1A17]/70 md:text-[16px]">
          Every price you see below is published by a live merchant on The
          Construction Notebook — not scraped, not estimated. Rows update the
          moment merchants change them; they auto-expire after 14 days so
          nothing stays stale.
        </p>

        <div className="mt-8">
          <PricesSearch />
        </div>
      </div>
    </main>
  );
}
