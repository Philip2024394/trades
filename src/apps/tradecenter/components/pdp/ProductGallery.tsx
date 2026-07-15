// Product Gallery — main image + thumbnail rail.
// Left-column half of the top of the PDP.

"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import type { ProductGalleryMedia } from "../../data/productDetails";

type Props = {
  media: ProductGalleryMedia[];
  fallbackImageUrl?: string;
  productName: string;
};

export function ProductGallery({ media, fallbackImageUrl, productName }: Props) {
  const items = media.length > 0
    ? media
    : fallbackImageUrl
      ? [{ id: "fb", kind: "image" as const, url: fallbackImageUrl, alt: productName }]
      : [];

  const [activeId, setActiveId] = useState<string | undefined>(items[0]?.id);
  const active = items.find((i) => i.id === activeId) ?? items[0];

  return (
    <div className="flex flex-col gap-3">
      {/* Main image */}
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl border bg-white"
        style={{ borderColor: "rgba(139,69,19,0.15)" }}
      >
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={active.url}
            alt={active.alt ?? productName}
            className="absolute inset-0 h-full w-full object-contain p-4"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[64px] text-neutral-300">
            <Package strokeWidth={1.5}/>
          </div>
        )}
      </div>

      {/* Thumbnail rail */}
      {items.length > 1 && (
        <ul className="grid grid-cols-5 gap-2">
          {items.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => setActiveId(m.id)}
                aria-pressed={m.id === active?.id}
                aria-label={m.alt ?? productName}
                className="relative aspect-square w-full overflow-hidden rounded-md border-2 bg-white transition"
                style={{
                  borderColor: m.id === active?.id ? "#0A0A0A" : "rgba(139,69,19,0.15)"
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-contain p-1"
                />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
