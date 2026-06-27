"use client";

// Per-product PDP image gallery — cover + thumbnail strip. Tapping a
// thumbnail swaps the cover. No fancy zoom or lightbox — the existing
// ProductModal handles that on the profile; on the PDP the customer
// already has a dedicated full-bleed view.

import { useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";

export function ProductPageGallery({ product }: { product: HammerexXratedProduct }) {
  const images = useMemo(() => {
    const all = [product.cover_url, ...(product.gallery_urls ?? [])].filter(
      (u): u is string => typeof u === "string" && u.length > 0
    );
    return Array.from(new Set(all)).slice(0, 4);
  }, [product]);
  const [active, setActive] = useState(0);
  const cover = images[active] ?? null;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100" style={{ aspectRatio: "1 / 1" }}>
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt={`${product.name} — photo ${active + 1}`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[13px] text-neutral-400">
            No image yet
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Show photo ${i + 1}`}
              aria-pressed={i === active}
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition ${
                i === active ? "border-[#FFB300]" : "border-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
