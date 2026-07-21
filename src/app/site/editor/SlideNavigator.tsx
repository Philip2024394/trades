// SlideNavigator — horizontal strip below the canvas showing a
// numbered chip for every slide in a multi-slide (Instagram-style
// carousel) composition. Tap to switch active slide. Also renders
// the Add-Slide chip (up to CAROUSEL_MAX_SLIDES) and a Delete-Slide
// button when more than one slide exists.
//
// Kept intentionally small and unstyled beyond the platform tokens
// so it can drop directly under the canvas without disturbing the
// tool rail below it. When a composition is single-slide the parent
// hides this component entirely — no visual noise for merchants who
// aren't building a carousel.

"use client";

import type { ReactElement } from "react";
import { Plus, Trash2 } from "lucide-react";

export const CAROUSEL_MAX_SLIDES = 10;

export type SlideNavigatorProps = {
  slideCount:       number;
  activeSlideIndex: number;
  onSelect:         (index: number) => void;
  onAdd:            () => void;
  onRemove:         (index: number) => void;
};

export function SlideNavigator({
  slideCount,
  activeSlideIndex,
  onSelect,
  onAdd,
  onRemove
}: SlideNavigatorProps): ReactElement | null {
  // The strip stays visible even at slideCount === 1 so the
  // "Add slide" chip is discoverable — the parent already hides
  // us on frames that don't support carousels. Only bail on a
  // clearly-broken state (nothing to show, or beyond the cap).
  if (slideCount < 1 || slideCount > CAROUSEL_MAX_SLIDES) return null;

  const canAdd    = slideCount < CAROUSEL_MAX_SLIDES;
  const canRemove = slideCount > 1;

  return (
    <div
      className="flex w-full items-center gap-1.5 overflow-x-auto py-1"
      role="tablist"
      aria-label="Carousel slides"
    >
      {Array.from({ length: slideCount }).map((_, i) => {
        const isActive = i === activeSlideIndex;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={`Slide ${i + 1}`}
            onClick={() => onSelect(i)}
            className={`h-10 min-w-10 shrink-0 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
              isActive
                ? "border-[#166534] bg-[#166534] text-white"
                : "border-black/10 bg-white text-neutral-800 hover:border-black/30"
            }`}
          >
            {i + 1}
          </button>
        );
      })}

      {canRemove && (
        <button
          type="button"
          aria-label="Delete current slide"
          onClick={() => onRemove(activeSlideIndex)}
          className="ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-red-200 bg-white text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14}/>
        </button>
      )}

      {canAdd && (
        <button
          type="button"
          aria-label="Add slide"
          onClick={onAdd}
          className="ml-auto flex h-10 shrink-0 items-center gap-1 rounded-md border border-[#FFB300] bg-[#FFB300] px-3 text-xs font-semibold text-black hover:bg-[#e69f00]"
        >
          <Plus size={14}/>
          Add slide
        </button>
      )}
    </div>
  );
}
