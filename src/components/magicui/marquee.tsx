// Magic UI · Marquee
//
// Horizontal scrolling row used for partner logos, review strips, and
// credential chips. CSS-only infinite scroll — no JS. Duplicates the
// children once so the loop is seamless. Respects prefers-reduced-motion
// (freezes at frame 0).
//
// Usage:
//   <Marquee pauseOnHover>
//     {logos.map(l => <img key={l.id} src={l.src} alt={l.name} />)}
//   </Marquee>

"use client";

import type { ReactNode } from "react";
import { Children } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Seconds per full loop. Default 30 (calm). */
  durationSec?: number;
  /** true → pause when the user hovers. Good UX for logo strips so
   *  visitors can read each name. */
  pauseOnHover?: boolean;
  /** true → reverse direction. */
  reverse?: boolean;
  /** Gap between items in Tailwind units (e.g. "gap-8"). */
  gapClassName?: string;
  className?: string;
};

export function Marquee({
  children,
  durationSec = 30,
  pauseOnHover = false,
  reverse = false,
  gapClassName = "gap-10",
  className
}: Props) {
  // We render the same children twice so the animation loops seamlessly
  // once the first copy has scrolled fully off screen.
  const items = Children.toArray(children);
  return (
    <div
      className={cn(
        "group relative flex w-full overflow-hidden",
        className
      )}
      style={{
        maskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, black 8%, black 92%, transparent)"
      }}
    >
      <div
        className={cn(
          "flex shrink-0 items-center motion-safe:animate-[marquee-scroll_var(--marquee-duration)_linear_infinite]",
          reverse && "[animation-direction:reverse]",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
          gapClassName
        )}
        style={{ ["--marquee-duration" as string]: `${durationSec}s` }}
      >
        {items.map((c, i) => (
          <div key={`a-${i}`} className="shrink-0">
            {c}
          </div>
        ))}
        {items.map((c, i) => (
          <div key={`b-${i}`} aria-hidden="true" className="shrink-0">
            {c}
          </div>
        ))}
      </div>
      <style jsx>{`
        @keyframes marquee-scroll {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </div>
  );
}
