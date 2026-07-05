// Magic UI · GridPattern
//
// Subtle SVG grid overlay used as a hero background layer. Placed
// behind copy at low opacity, it gives an otherwise-flat hero the
// "designed" feel — the piece that stops generated pages looking
// generated. Zero JS at runtime — pure SVG + Tailwind.
//
// Usage:
//   <div className="relative">
//     <GridPattern className="opacity-20" strokeDasharray="4 2" />
//     <div className="relative z-10">…hero content…</div>
//   </div>

"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type Props = {
  /** Cell size in px. Larger = more airy grid. */
  size?: number;
  /** Grid line thickness. Default 1. */
  strokeWidth?: number;
  /** Optional dash pattern (e.g. "4 2" gives dotted feel). */
  strokeDasharray?: string;
  /** Tailwind classes for positioning + colour. Grid inherits `stroke`
   *  from currentColor so a `text-neutral-900` parent tints it. */
  className?: string;
};

export function GridPattern({
  size = 40,
  strokeWidth = 1,
  strokeDasharray,
  className
}: Props) {
  const id = useId();
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        "text-neutral-900/[0.08]",
        className
      )}
    >
      <defs>
        <pattern
          id={id}
          width={size}
          height={size}
          patternUnits="userSpaceOnUse"
        >
          <path
            d={`M ${size} 0 L 0 0 0 ${size}`}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
