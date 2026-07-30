"use client";

// PlatformHero — global platform hero. Composited from two layers:
//   1. Background — warm staircase-environment photo that fades to
//      cream on the left, tells the story of what NEX is for.
//   2. Character overlay — transparent NEX Woman in black T-shirt,
//      positioned on the right on top of the background.
// Text stack (headline + subtitle + FreeChatCard) sits on the left
// on top of both, constrained to the cream-safe left portion.

import Image from "next/image";
import { Bell } from "lucide-react";
import { FreeChatCard } from "./FreeChatCard";
import { PlatformAskBar } from "./PlatformAskBar";

export function PlatformHero() {
  return (
    <section
      className="relative mt-0 min-h-[294px] px-5 pb-3"
      style={{ background: "var(--nex-cream)" }}
    >
      {/* Background layer — staircase environment. Scaled to 70% of the
          hero area (width + height) and right/bottom anchored. Radial
          mask anchored at bottom-right so BOTH the top edge AND the
          left edge fade into the cream page background — no visible
          image edges anywhere. */}
      <div
        className="pointer-events-none absolute right-0 bottom-0"
        style={{
          width:  "83%",
          height: "73%",
          WebkitMaskImage: "radial-gradient(ellipse 100% 100% at 90% 100%, black 0%, black 78%, transparent 100%)",
          maskImage:       "radial-gradient(ellipse 100% 100% at 90% 100%, black 0%, black 78%, transparent 100%)"
        }}
      >
        <Image
          src="/nex-app/general/hero-nex-platform.png"
          alt=""
          fill
          priority
          sizes="(max-width: 640px) 70vw, 314px"
          className="object-cover object-right"
        />
      </div>

      {/* Character overlay — transparent PNG, right-anchored */}
      <div
        className="pointer-events-none absolute right-0 bottom-0"
        style={{ top: 40, width: "49%" }}
      >
        <Image
          src="/nex-app/general/hero-nex-overlay.png"
          alt="Nex — your construction intelligence"
          fill
          priority
          sizes="(max-width: 640px) 60vw, 260px"
          className="object-contain object-bottom"
        />
      </div>

      {/* Top row — NEX logo left · bell right */}
      <div className="relative z-10 flex items-start justify-between pt-2">
        <div className="flex flex-col">
          <div className="h-14 w-[160px] overflow-hidden" aria-label="NEX">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/staircase-images/nex-logo.png"
              alt="NEX"
              className="h-full w-full"
              style={{ objectFit: "cover", objectPosition: "center" }}
            />
          </div>
          <span
            className="mt-1 text-[11px] font-semibold uppercase"
            style={{ color: "var(--nex-neutral-700)", letterSpacing: "0.3em" }}
          >
            All in One Place
          </span>
        </div>
        <button
          type="button"
          aria-label="Notifications"
          className="relative grid h-9 w-9 place-items-center rounded-full transition-colors"
          style={{ color: "var(--nex-neutral-700)" }}
        >
          <Bell size={20} strokeWidth={1.75} />
          <span
            aria-hidden
            className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full"
            style={{ background: "var(--nex-accent-500)", border: "1.5px solid var(--nex-cream)" }}
          />
        </button>
      </div>

      {/* Headline + subtitle + Free Chat card — constrained to left column */}
      <div className="relative z-10 mt-2 flex max-w-[62%] flex-col">
        <h1
          className="text-[26px] font-black leading-[1.08] tracking-tight"
          style={{ color: "var(--nex-neutral-900)" }}
        >
          One App.
        </h1>
        <h2
          className="text-[26px] font-black leading-[1.08] tracking-tight"
          style={{ color: "var(--nex-accent-500)" }}
        >
          Endless Possibilities.
        </h2>
        <div className="mt-3">
          <FreeChatCard />
        </div>
      </div>

      {/* Ask NEX search bar — full width, tight to the Free Chat card
          above. Same gap here as the MainGrid uses below the hero so
          Free Chat → Ask NEX → Grid form a visually equal-spaced stack. */}
      <div className="relative z-10 mt-2">
        <PlatformAskBar />
      </div>
    </section>
  );
}
