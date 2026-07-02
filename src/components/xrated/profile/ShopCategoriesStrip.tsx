"use client";

// ShopCategoriesStrip — hero-adjacent category rail.
//
// UX brief from merchant:
//   1. Users didn't realise it scrolled → add slow continuous
//      right-to-left drift so the affordance is unmissable
//   2. Cards must NEVER get half-clipped at the edge → generous right
//      padding + no scroll-snap-mandatory (which caused the "half card"
//      look on mobile)
//   3. Mobile touch swipe must work → explicit `touch-action: pan-x`
//      and `-webkit-overflow-scrolling: touch`; drift is CSS animation
//      on an inner track so the outer scroller is fully manual too
//
// Guardrails so the drift doesn't fight the user:
//   - Pauses on hover, focus, or touch. Resumes 2.5s after last touch
//   - Respects prefers-reduced-motion (drift disabled entirely)
//   - Items duplicated once so the loop is seamless
//   - User can manually scroll at any time; drift resumes after idle

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ShopCategory } from "@/lib/supabase";

export function ShopCategoriesStrip({
  slug,
  categories
}: {
  slug: string;
  categories: ShopCategory[];
}) {
  const enabled = (categories ?? [])
    .filter((c) => c.enabled !== false && c.slug && c.label)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const [paused, setPaused] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const resumeTimer = useRef<number | null>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    function pause() {
      setPaused(true);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    }
    function scheduleResume() {
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
      resumeTimer.current = window.setTimeout(() => setPaused(false), 2500);
    }
    el.addEventListener("pointerenter", pause);
    el.addEventListener("pointerleave", scheduleResume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", scheduleResume, { passive: true });
    el.addEventListener("focusin", pause);
    el.addEventListener("focusout", scheduleResume);
    return () => {
      el.removeEventListener("pointerenter", pause);
      el.removeEventListener("pointerleave", scheduleResume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", scheduleResume);
      el.removeEventListener("focusin", pause);
      el.removeEventListener("focusout", scheduleResume);
      if (resumeTimer.current) window.clearTimeout(resumeTimer.current);
    };
  }, []);

  if (enabled.length === 0) return null;

  const cards = enabled.map((cat, idx) => (
    <CategoryCard
      key={`${cat.slug}-${idx}`}
      cat={cat}
      slug={slug}
    />
  ));

  // Duplicate the set once so the marquee can loop without a visible
  // hard reset. The scroller translates 0 → -50% of its content
  // width, at which point the second copy is identical to the first
  // and the animation restarts imperceptibly.
  const doubled = [...cards, ...cards.map((c, i) => (
    <div key={`clone-${i}`} aria-hidden="true">{c}</div>
  ))];

  // Speed: ~50 seconds for a full loop of 19 items = comfortably
  // readable, doesn't feel busy. Scales gracefully with item count via
  // the calc() below (10 items = ~26s, 25 items = ~65s).
  const durationSec = Math.max(20, Math.min(80, enabled.length * 2.6));

  return (
    <nav
      aria-label="Shop by category"
      className="relative border-b border-neutral-100 bg-white"
    >
      <style>{`
        @keyframes shop-cats-drift {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @media (prefers-reduced-motion: reduce) {
          .shop-cats-track { animation: none !important; }
        }
      `}</style>

      {/* Fade masks on left + right — belt-and-braces cue that the strip
       *  continues off-screen. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8"
        style={{ background: "linear-gradient(to right, #fff, transparent)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8"
        style={{ background: "linear-gradient(to left, #fff, transparent)" }}
      />

      {/* Outer scroller — the user's manual touch scroll. Overflow hidden
       *  vertically, auto horizontally. touch-action pan-x makes the
       *  mobile browser hand the horizontal drag over to us reliably. */}
      <div
        ref={scrollerRef}
        className="mx-auto w-full max-w-6xl overflow-x-auto overflow-y-hidden [&::-webkit-scrollbar]:hidden"
        style={{
          scrollbarWidth: "none",
          WebkitOverflowScrolling: "touch",
          touchAction: "pan-x"
        }}
      >
        {/* Inner track — this is what the CSS animation moves. Width is
         *  intrinsic so translateX(-50%) always lines the second copy
         *  up with the origin. */}
        <div
          className="shop-cats-track flex w-max gap-3 py-4 sm:gap-4"
          style={{
            paddingLeft: "16px",
            paddingRight: "48px",
            animation: `shop-cats-drift ${durationSec}s linear infinite`,
            animationPlayState: paused ? "paused" : "running"
          }}
        >
          {doubled}
        </div>
      </div>
    </nav>
  );
}

function CategoryCard({
  cat,
  slug
}: {
  cat: ShopCategory;
  slug: string;
}) {
  return (
    <Link
      href={`/${encodeURIComponent(slug)}/shop?category=${encodeURIComponent(cat.slug)}`}
      className="group flex w-[84px] shrink-0 flex-col items-center gap-1.5 sm:w-[100px]"
    >
      <span
        className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50 transition group-hover:border-[#FFB300] group-hover:bg-white sm:h-[84px] sm:w-[84px]"
        aria-hidden="true"
      >
        {cat.image_url ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={cat.image_url}
            alt=""
            loading="lazy"
            className="h-[56px] w-[56px] object-contain sm:h-[68px] sm:w-[68px]"
            draggable={false}
          />
        ) : (
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
            {cat.label.slice(0, 2).toUpperCase()}
          </span>
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-bold leading-tight text-neutral-800 group-hover:text-[#0A0A0A] sm:text-[12px]">
        {cat.label}
      </span>
    </Link>
  );
}
