// SwipeGallery — mobile-first horizontal snap scroller with progress dots.
//
// Renders as a scroll-snap carousel on mobile; grows to a grid on
// desktop where more items fit. The Grid density prop determines
// the desktop layout.

"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

export type SwipeGalleryProps = {
  items: ReactNode[];
  /** Desktop layout — decides how many items per row from md up. */
  desktopColumns?: 2 | 3 | 4;
  /** Optional heading. */
  heading?: string;
  /** ARIA label. */
  ariaLabel?: string;
};

const DESKTOP_COLS: Record<2 | 3 | 4, string> = {
  2: "md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:snap-none",
  3: "md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:snap-none",
  4: "md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:snap-none"
};

export function SwipeGallery({
  items,
  desktopColumns = 3,
  heading,
  ariaLabel = "Gallery"
}: SwipeGalleryProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const width = el.clientWidth;
        // Snap items are 85% viewport width by design (see item classes).
        const itemWidth = width * 0.85;
        const idx = Math.round(el.scrollLeft / itemWidth);
        setActiveIndex(Math.max(0, Math.min(items.length - 1, idx)));
        ticking = false;
      });
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, [items.length]);

  return (
    <div aria-label={ariaLabel}>
      {heading ? (
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[15px] font-semibold text-neutral-900">
            {heading}
          </h3>
          <span className="text-[11px] text-neutral-500 md:hidden">
            {activeIndex + 1} / {items.length}
          </span>
        </div>
      ) : null}
      <div
        ref={scrollRef}
        className={`-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 ${DESKTOP_COLS[desktopColumns]}`}
        style={{ scrollbarWidth: "none" }}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className="w-[85%] shrink-0 snap-start md:w-auto md:shrink"
          >
            {item}
          </div>
        ))}
      </div>
      {/* Progress dots — mobile only. */}
      <div className="mt-2 flex justify-center gap-1.5 md:hidden">
        {items.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all ${
              i === activeIndex
                ? "w-6 bg-neutral-900"
                : "w-1.5 bg-neutral-300"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
