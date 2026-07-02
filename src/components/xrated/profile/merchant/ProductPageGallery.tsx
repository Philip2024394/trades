"use client";

/**
 * @fileoverview MERCHANT-ONLY component.
 * @merchantOnly Only renders when isStorefrontOn(listing) === true.
 * Importing this from a service-trade context is a code smell — use
 * the service/ siblings instead.
 */


// Per-product PDP image gallery — cover + thumbnail strip. Tapping a
// thumbnail swaps the cover. No fancy zoom or lightbox — the existing
// ProductModal handles that on the profile; on the PDP the customer
// already has a dedicated full-bleed view.
//
// Layout: main image full-width, with the horizontal yellow/gray
// progress bars (one segment per image) sitting directly under the
// cover — those are the canonical active-image indicator. The
// thumbnail row IMMEDIATELY beneath gets ZERO yellow highlight; the
// only cue is a darker neutral-900 border on the active thumb so the
// row reads as a chooser, not a marketing surface.
//
// Top-right share button is the yellow ProductShareButton popup.

import { useMemo, useState } from "react";
import type { HammerexXratedProduct } from "@/lib/supabase";
import { ProductShareButton } from "./ProductShareButton";
import { DistanceBadge } from "../DistanceBadge";

export function ProductPageGallery({
  product,
  listingLat = null,
  listingLng = null,
  listingCity,
  refCode
}: {
  product: HammerexXratedProduct;
  listingLat?: number | null;
  listingLng?: number | null;
  listingCity?: string;
  /** Customer-facing Ref code — overlays the cover image at the
   *  lower-right. Moved here from the BuyColumnDetails tab row so the
   *  Ref space could host the calculator-open button. */
  refCode?: string;
}) {
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
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
        style={{ aspectRatio: "1 / 1" }}
      >
        {cover ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cover}
            alt={`${product.name} — photo ${active + 1}`}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-neutral-400">
            No image yet
          </div>
        )}
        <ProductShareButton title={product.name} />
        {listingCity && (
          <DistanceBadge
            listingLat={listingLat}
            listingLng={listingLng}
            city={listingCity}
          />
        )}
        {refCode && (
          <span
            className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-neutral-900/85 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white backdrop-blur-sm"
            aria-label={`Reference ${refCode}`}
          >
            <span className="text-[#FFB300]">Ref</span>
            <span className="font-mono normal-case tracking-normal text-white">
              {refCode}
            </span>
          </span>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-2 flex gap-1.5">
          {images.map((src, i) => {
            const isActive = i === active;
            return (
              <button
                key={`bar-${src}`}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={isActive}
                className="h-1 flex-1 rounded-sm transition"
                style={{ background: isActive ? "#FFB300" : "#E5E5E5" }}
              />
            );
          })}
        </div>
      )}
      {images.length > 1 && (
        <div className="flex items-start gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {images.map((src, i) => {
            const isActive = i === active;
            return (
              // Active thumb gets a darker neutral-900 border so the row
              // reads as a chooser. The yellow active-bar AND yellow ring
              // are intentionally gone — the progress bars above the
              // cover image are the only active-image indicator now.
              <button
                key={src}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-pressed={isActive}
                className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition sm:h-20 sm:w-20 ${
                  isActive
                    ? "border-neutral-900"
                    : "border-neutral-200 opacity-90 hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
