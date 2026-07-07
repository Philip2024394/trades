// /xrated-trades-images — public marketplace index.
//
// Server-rendered, SEO-optimised. Groups images by trade (from strict
// keywords) so search engines pick up the UK trade taxonomy. Each
// card is a link to /xrated-trades-images/[imageId].

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { allHeroImages } from "@/lib/hero-swap/library";

export const metadata: Metadata = {
  title: "UK trade image library — licence from £39 · xrated trades",
  description:
    "Curated, tagged, UK-specific trade photography for tradespeople + platforms. Licence individual images from £39, lock a region from £29/mo, or buy an image outright.",
  openGraph: {
    title: "UK trade image library — xrated trades",
    description:
      "Curated, tagged, UK-specific trade photography — licence from £39."
  }
};

export default function MarketplaceIndex() {
  const images = allHeroImages();
  const grouped = groupByPrimaryKeyword(images);

  return (
    <main className="min-h-screen bg-neutral-50">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-amber-900">
            <Sparkles className="h-3.5 w-3.5" />
            xrated trades · image library
          </div>
          <h1 className="mt-2 text-3xl font-bold text-neutral-900 md:text-4xl">
            UK trade photography, tagged + licenced
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] text-neutral-700">
            Every image is trade-specific and keyword-matched — no
            generic stock. Licence for your business from £39, lock it
            to your postcode area from £29/mo, or own it outright
            from £299.
          </p>
        </div>

        {Object.entries(grouped).map(([keyword, imgs]) => (
          <section key={keyword} className="mt-8">
            <h2 className="mb-3 text-[15px] font-bold text-neutral-900">
              {titleCase(keyword)} ({imgs.length})
            </h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {imgs.slice(0, 8).map((img) => (
                <Link
                  key={img.id}
                  href={`/xrated-trades-images/${img.id}`}
                  className="group overflow-hidden rounded-xl border border-neutral-200 bg-white transition hover:border-neutral-300"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/api/image/serve/${encodeURIComponent(img.id)}`}
                    alt={img.subject}
                    className="aspect-video w-full object-cover"
                    loading="lazy"
                  />
                  <div className="p-2">
                    <div className="line-clamp-2 text-[12px] font-medium text-neutral-800">
                      {img.subject}
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-neutral-900">
                        from £39
                      </span>
                      <ArrowRight className="h-3 w-3 text-neutral-500 transition group-hover:translate-x-0.5" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}

function groupByPrimaryKeyword(
  images: ReturnType<typeof allHeroImages>
): Record<string, typeof images> {
  const groups: Record<string, typeof images> = {};
  for (const img of images) {
    const key = (img.keywords_strict[0] ?? "other").toLowerCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(img);
  }
  return groups;
}

function titleCase(s: string): string {
  return s.replace(/(^|\s)\S/g, (t) => t.toUpperCase());
}
