"use client";

// PlantHireCategoryScroller — auto-scrolling horizontal marquee of the
// merchant's enabled plant categories. Slow leftward drift, seamless
// loop by duplicating the tile list, pauses on hover + touch and
// resumes ~2s after the interaction ends.

import Link from "next/link";
import { useEffect, useRef } from "react";

type Cat = {
  slug: string;
  label: string;
  emoji: string;
  image_url: string;
  price_day_pence: number | null;
};

export function PlantHireCategoryScroller({
  merchantSlug,
  categories
}: {
  merchantSlug: string;
  categories: Cat[];
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const halfWidthRef = useRef(0);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;

    // The DOM contains two copies of the tile list back-to-back so we
    // can loop seamlessly by snapping back one full copy width when
    // the customer has drifted past the first copy.
    const measure = () => {
      halfWidthRef.current = el.scrollWidth / 2;
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);

    let paused = false;
    let resumeTimer = 0;
    let raf = 0;

    const pause = () => {
      paused = true;
      window.clearTimeout(resumeTimer);
    };
    const scheduleResume = () => {
      window.clearTimeout(resumeTimer);
      resumeTimer = window.setTimeout(() => {
        paused = false;
      }, 1500);
    };
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", scheduleResume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", scheduleResume, { passive: true });

    const step = () => {
      if (!paused && halfWidthRef.current > 0) {
        el.scrollLeft += 0.12;
        if (el.scrollLeft >= halfWidthRef.current) {
          el.scrollLeft -= halfWidthRef.current;
        }
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resumeTimer);
      ro.disconnect();
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", scheduleResume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", scheduleResume);
    };
  }, []);

  const doubled = [...categories, ...categories];

  return (
    <section className="relative">
      <div
        ref={scrollerRef}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {doubled.map((cat, i) => (
          <Link
            key={`${cat.slug}-${i}`}
            href={`/${encodeURIComponent(merchantSlug)}/plant-hire`}
            className="group flex w-28 shrink-0 flex-col items-center gap-1 rounded-xl border border-transparent p-2 transition hover:border-[#FFB300] sm:w-32"
            aria-hidden={i >= categories.length ? "true" : undefined}
            tabIndex={i >= categories.length ? -1 : undefined}
          >
            <span className="grid h-20 w-24 place-items-center sm:h-24 sm:w-28">
              {cat.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={cat.image_url}
                  alt=""
                  className={
                    // Tall / upright machines (trench rammer, plate
                    // compactor, breaker) render smaller so they don't
                    // dwarf the wider ones next to them.
                    cat.slug === "trench_rammer" ||
                    cat.slug === "plate_compactor" ||
                    cat.slug === "breaker"
                      ? "max-h-[65%] w-auto object-contain transition group-hover:scale-110"
                      : "h-full w-full object-contain transition group-hover:scale-110"
                  }
                  loading="lazy"
                />
              ) : (
                <span className="text-[26px]">{cat.emoji}</span>
              )}
            </span>
            <p className="line-clamp-2 min-h-[24px] text-center text-[10px] font-extrabold leading-tight text-neutral-800 sm:text-[11px]">
              {cat.label}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
