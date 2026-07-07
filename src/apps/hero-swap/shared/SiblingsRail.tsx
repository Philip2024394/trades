// SiblingsRail — appears when the merchant picks an image that belongs
// to a sibling group. Shows the other images in the series so the
// merchant can license the whole set, or pick a different member of
// the group without leaving the sheet.
//
// The "Apply series across your site" button is the killer feature:
// one tap gives the merchant a coherent visual brand across landing,
// about, service pages, etc.

"use client";

import { Sparkles } from "lucide-react";
import { watermarkedUrl } from "@/lib/watermark/urls";
import { useEditModeOptional } from "@/apps/live-edit/EditModeContext";
import type { HeroImage } from "@/lib/hero-swap/types";

export type SiblingsRailProps = {
  currentImage: HeroImage;
  siblings: HeroImage[];
  onSelectSibling: (id: string) => void;
  onApplyAcrossSite?: () => void;
};

export function SiblingsRail({
  currentImage,
  siblings,
  onSelectSibling,
  onApplyAcrossSite
}: SiblingsRailProps) {
  const editCtx = useEditModeOptional();
  if (siblings.length === 0) return null;
  const groupId = currentImage.sibling_group_id;
  if (!groupId) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-blue-600" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-blue-900">
              Part of a series
            </span>
          </div>
          <div className="mt-0.5 text-[11px] text-blue-800">
            This image is 1 of {siblings.length + 1} shot together. Same
            person, same lighting, same brand.
          </div>
        </div>
        {onApplyAcrossSite ? (
          <button
            type="button"
            onClick={onApplyAcrossSite}
            className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-blue-700"
          >
            Use series across site
          </button>
        ) : null}
      </div>
      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {siblings.map((sib) => (
          <button
            key={sib.id}
            type="button"
            onClick={() => onSelectSibling(sib.id)}
            className="group relative shrink-0 snap-start overflow-hidden rounded-lg border-2 border-transparent bg-white transition hover:border-blue-300"
            style={{ width: 120 }}
          >
            <div className="aspect-[16/9] w-full overflow-hidden bg-neutral-100">
              <img
                src={watermarkedUrl(sib.id, {
                  fallback: sib.image_url,
                  merchantId: editCtx?.merchantId
                })}
                alt={sib.subject}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            </div>
            <div className="px-1.5 py-1 text-left">
              <div className="line-clamp-2 text-[10px] font-medium text-neutral-800">
                {sib.vibe.split("/")[0].trim()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
