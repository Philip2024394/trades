"use client";

// CategoriesRow — Explore Categories per canonical mockup. Full photo
// cards with dark gradient overlay + category name + subtitle. Not
// chips — proper visual browsing cards.

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

type Category = {
  slug:     string;
  label:    string;
  subtitle: string;
  imageUrl: string;
};

const CATEGORIES: Category[] = [
  {
    slug:     "construction",
    label:    "Construction",
    subtitle: "Build & Renovate",
    imageUrl: "https://images.unsplash.com/photo-1541888946425-d81bb19240f5?w=400&q=80"
  },
  {
    slug:     "home",
    label:    "Home & Living",
    subtitle: "Improve your home",
    imageUrl: "https://images.unsplash.com/photo-1567016376408-0226e4d0c1ea?w=400&q=80"
  },
  {
    slug:     "business",
    label:    "Business",
    subtitle: "Tools for growth",
    imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&q=80"
  },
  {
    slug:     "marketing",
    label:    "Marketing",
    subtitle: "Promote & grow",
    imageUrl: "https://images.unsplash.com/photo-1611926653458-09294b3142bf?w=400&q=80"
  },
  {
    slug:     "design",
    label:    "Design",
    subtitle: "Create & inspire",
    imageUrl: "https://images.unsplash.com/photo-1626785774573-4b799315345d?w=400&q=80"
  }
];

export function CategoriesRow() {
  const router = useRouter();
  return (
    <section className="mt-3">
      <header className="mx-5 mb-2 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: "var(--nex-neutral-900)" }}>
          Explore Categories
        </h3>
        <button type="button"
                className="flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold"
                style={{ color: "var(--nex-accent-500)" }}>
          View All <ArrowRight size={12} strokeWidth={2.25} />
        </button>
      </header>

      <div className="scrollbar-none flex gap-2.5 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            type="button"
            onClick={() => router.push(`/nex-app/categories/${c.slug}`)}
            className="relative flex-none overflow-hidden rounded-2xl transition-transform active:scale-[0.98]"
            style={{
              width: 116,
              height: 132,
              boxShadow: "var(--nex-shadow-sm)"
            }}
            aria-label={`${c.label} — ${c.subtitle}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.imageUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
            <div
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-[62%]"
              style={{
                background: "linear-gradient(to top, rgba(15, 17, 21, 0.72) 15%, transparent 100%)"
              }}
            />
            <div className="absolute inset-x-0 bottom-0 px-2.5 py-2 text-left"
                 style={{ color: "var(--nex-neutral-0)" }}>
              <div className="flex items-center gap-1 text-[11.5px] font-black leading-tight">
                <span aria-hidden style={{ color: "var(--nex-accent-500)" }}>●</span>
                {c.label}
              </div>
              <div className="mt-0.5 text-[10px] leading-tight" style={{ color: "rgba(255,255,255,0.85)" }}>
                {c.subtitle}
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
