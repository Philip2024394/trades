// HeroSwapSlot — the merchant-facing "hero with a change chip on it"
// component. Drop this into any page hero and the merchant gets the
// full swap flow for free.

"use client";

import { useState } from "react";
import { ChangeImageChip } from "./shared/ChangeImageChip";
import { HeroPreview } from "./shared/HeroPreview";
import { HeroSwapSheet } from "./shared/HeroSwapSheet";
import { useHeroSwap } from "./useHeroSwap";
import type { UseHeroSwapOptions } from "./useHeroSwap";

export type HeroSwapSlotProps = UseHeroSwapOptions & {
  headline?: string;
  subhead?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  editable?: boolean;
};

export function HeroSwapSlot({
  headline,
  subhead,
  ctaLabel,
  onCtaClick,
  editable = true,
  ...calcOptions
}: HeroSwapSlotProps) {
  const [open, setOpen] = useState(false);
  const calc = useHeroSwap(calcOptions);

  if (calc.isLoadingLibrary && !calc.image) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl bg-gradient-to-br from-neutral-200 to-neutral-300">
        <div className="text-[12px] font-medium text-neutral-600">
          Loading your hero library…
        </div>
      </div>
    );
  }
  if (!calc.image) {
    return (
      <div className="flex aspect-[16/9] w-full items-center justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 text-center text-neutral-500">
        <div>
          <div className="text-[13px] font-semibold">No matching hero image</div>
          <div className="mt-1 text-[11px]">
            Check your trade keywords or upload one from Studio.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative">
        <HeroPreview
          image={calc.image}
          preset={calc.preset}
          edits={calc.edits}
          uploadUrl={calc.uploadUrl}
          headline={headline}
          subhead={subhead}
          ctaLabel={ctaLabel}
          onCtaClick={onCtaClick}
        />
        {editable ? (
          <ChangeImageChip
            matchedCount={calc.matchedImages.length}
            onClick={() => setOpen(true)}
          />
        ) : null}
      </div>
      <HeroSwapSheet
        open={open}
        onClose={() => setOpen(false)}
        calc={calc}
      />
    </>
  );
}
