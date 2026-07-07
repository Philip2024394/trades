// LibraryCarousel — horizontal strip of thumbnails, one per matched
// image. Merchant taps a thumbnail → the hero swaps live. Current
// image is highlighted so the merchant can tell what they're on.
//
// Each thumbnail shows the 5-colour extracted palette as small dots
// under the thumb, so merchant can preview which image gives which
// brand theme without swapping.

"use client";

import { Check } from "lucide-react";
import { watermarkedUrl } from "@/lib/watermark/urls";
import { useEditModeOptional } from "@/apps/live-edit/EditModeContext";
import type { HeroImage } from "@/lib/hero-swap/types";

export type LibraryCarouselProps = {
  images: HeroImage[];
  currentImageId: string | undefined;
  onSelect: (id: string) => void;
};

export function LibraryCarousel({
  images,
  currentImageId,
  onSelect
}: LibraryCarouselProps) {
  const editCtx = useEditModeOptional();
  if (images.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-200 bg-neutral-50 p-6 text-center">
        <div className="text-[13px] font-semibold text-neutral-900">
          No matching images yet
        </div>
        <div className="mt-1 text-[11px] text-neutral-600">
          Upload your own below, or check the trade keywords in your profile.
        </div>
      </div>
    );
  }
  return (
    <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
      {images.map((image) => {
        const isCurrent = image.id === currentImageId;
        return (
          <button
            key={image.id}
            type="button"
            onClick={() => onSelect(image.id)}
            className={`group relative shrink-0 snap-start overflow-hidden rounded-xl border-2 bg-white text-left transition ${
              isCurrent
                ? "border-amber-400 shadow-sm"
                : "border-neutral-200 hover:border-neutral-300"
            }`}
            style={{ width: 200 }}
          >
            <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
              <img
                src={watermarkedUrl(image.id, {
                  fallback: image.image_url,
                  merchantId: editCtx?.merchantId
                })}
                alt={image.subject}
                className="h-full w-full object-cover"
                loading="lazy"
              />
              {isCurrent ? (
                <div className="absolute right-1 top-1 rounded-full bg-amber-400 p-1 text-white">
                  <Check className="h-3 w-3" />
                </div>
              ) : null}
            </div>
            <div className="p-2">
              <div className="line-clamp-2 text-[11px] font-medium text-neutral-800">
                {image.vibe}
              </div>
              <div className="mt-1.5 flex gap-1">
                {[
                  image.theme_palette.primary,
                  image.theme_palette.secondary,
                  image.theme_palette.surface_warm,
                  image.theme_palette.surface_deep,
                  image.theme_palette.accent
                ].map((c, i) => (
                  <div
                    key={i}
                    className="h-3 w-3 rounded-full border border-white shadow-sm"
                    style={{ backgroundColor: c }}
                    aria-hidden
                  />
                ))}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
