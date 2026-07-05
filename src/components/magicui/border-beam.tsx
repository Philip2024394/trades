// Magic UI · BorderBeam
//
// Animated gradient beam that sweeps around the border of a card,
// giving the "premium tier" feel Loveable/Framer AI use on testimonials
// and pricing tiers. Pure CSS animation — no runtime JS. Respects
// prefers-reduced-motion.
//
// Usage: place inside a `relative overflow-hidden` container. The
// beam is an absolutely-positioned pseudo-element that traces the
// container's rounded rectangle border.
//
//   <div className="relative overflow-hidden rounded-xl">
//     <BorderBeam accent="#FFB300" />
//     …card content…
//   </div>

"use client";

import { cn } from "@/lib/utils";

type Props = {
  /** Size of the sweep highlight in px. Default 100. */
  size?: number;
  /** Seconds per full loop. Default 8. */
  durationSec?: number;
  /** Primary colour of the beam. Inherits `color.accent` in practice. */
  accent?: string;
  /** Optional cool colour for the gradient tail. */
  cool?: string;
  /** Delay in seconds before the beam starts (useful for staggered
   *  card grids). Default 0. */
  delaySec?: number;
  className?: string;
};

export function BorderBeam({
  size = 100,
  durationSec = 8,
  accent = "#FFB300",
  cool = "#3B82F6",
  delaySec = 0,
  className
}: Props) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        "[mask-clip:padding-box,border-box] [mask-composite:intersect]",
        "[mask:linear-gradient(transparent,transparent),linear-gradient(#000,#000)]",
        "motion-safe:[animation:border-beam-rotate_var(--beam-duration)_linear_infinite]",
        className
      )}
      style={{
        ["--beam-size" as string]: `${size}px`,
        ["--beam-duration" as string]: `${durationSec}s`,
        ["--beam-delay" as string]: `${delaySec}s`,
        animationDelay: `${delaySec}s`,
        // Rounded gradient trace via conic-gradient offset by --pos.
        background: `conic-gradient(from calc(var(--pos, 0) * 1deg), transparent 0%, ${accent} 3%, ${cool} 6%, transparent 8%)`,
        // Border stripe: only the ring is visible; interior is masked.
        WebkitMaskImage:
          "linear-gradient(transparent, transparent), linear-gradient(#000, #000)",
        WebkitMaskClip: "padding-box, border-box",
        WebkitMaskComposite: "xor",
        maskComposite: "exclude",
        padding: "1.5px"
      }}
    >
      <style jsx>{`
        @property --pos {
          syntax: "<number>";
          initial-value: 0;
          inherits: false;
        }
        @keyframes border-beam-rotate {
          to {
            --pos: 360;
          }
        }
      `}</style>
    </div>
  );
}
