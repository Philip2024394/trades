// Mobile-only horizontal category strip.
//
// Below `md:` the vertical CategoryRail is hidden. This strip replaces
// it — a horizontally-scrolling row of chips at the top of the page
// body. Active chip renders in the brand-yellow / black scheme so the
// current category is clear at a glance.

"use client";

import Link from "next/link";
import { RAIL_CATEGORIES, type RailCategorySlug } from "../data/categoryTaxonomy";

type Props = {
  activeSlug: RailCategorySlug | null;
};

export function MobileCategoryStrip({ activeSlug }: Props) {
  return (
    <nav
      className="-mx-4 mb-4 border-b border-t md:hidden"
      style={{ borderColor: "rgba(139,69,19,0.15)", backgroundColor: "#FBF6EC" }}
      aria-label="Marketplace categories"
    >
      <div className="flex snap-x snap-mandatory gap-1 overflow-x-auto px-4 py-2">
        {RAIL_CATEGORIES.map((c) => {
          const active = c.slug === activeSlug;
          return (
            <Link
              key={c.slug}
              href={`/tc/trade-center/${c.slug}`}
              className="flex flex-shrink-0 snap-start items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-black transition"
              style={{
                borderColor: active ? "#0A0A0A" : "rgba(139,69,19,0.20)",
                backgroundColor: active ? "#0A0A0A" : "#FFFFFF",
                color: active ? "#FFB300" : "#374151"
              }}
            >
              <c.icon size={12} strokeWidth={2} aria-hidden/>
              {c.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
