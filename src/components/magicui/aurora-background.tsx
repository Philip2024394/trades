// Magic UI · AuroraBackground
//
// Slow-drifting conic-gradient behind the hero content. Uses CSS-only
// animation — no runtime JS — so it costs nothing on the main thread.
// The gradient inherits from theme accent + a cool complementary hue.
//
// Usage:
//   <div className="relative isolate overflow-hidden">
//     <AuroraBackground accent="#FFB300" />
//     <div className="relative z-10">…hero content…</div>
//   </div>

"use client";

import { cn } from "@/lib/utils";

type Props = {
  accent?: string;
  /** Optional cool second colour. Defaults to a deep blue that reads
   *  well behind most brand palettes. */
  cool?: string;
  className?: string;
};

export function AuroraBackground({
  accent = "#FFB300",
  cool = "#1E3A8A",
  className
}: Props) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className
      )}
    >
      {/* Two soft blurred gradient blobs drifting on independent tempos.
          motion-safe: respects prefers-reduced-motion. */}
      <div
        className="absolute -top-1/4 left-0 h-[80vh] w-[80vw] rounded-full opacity-40 blur-3xl motion-safe:animate-[aurora-drift-a_18s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(circle at 30% 30%, ${accent}66, transparent 60%)`
        }}
      />
      <div
        className="absolute -bottom-1/4 right-0 h-[80vh] w-[80vw] rounded-full opacity-30 blur-3xl motion-safe:animate-[aurora-drift-b_22s_ease-in-out_infinite]"
        style={{
          background: `radial-gradient(circle at 70% 70%, ${cool}55, transparent 60%)`
        }}
      />
      <style jsx>{`
        @keyframes aurora-drift-a {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(6vw, 4vh) scale(1.1);
          }
        }
        @keyframes aurora-drift-b {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-5vw, -3vh) scale(1.15);
          }
        }
      `}</style>
    </div>
  );
}
