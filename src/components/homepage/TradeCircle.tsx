// Section 5 — Trade Circle.
//
// The peer-endorsement moat, visualised. Center node = a merchant.
// Orbiting nodes = other trades who back them. SVG lines connect.
// CSS animations only (no JS): gentle idle drift + line pulse.

import { Users } from "lucide-react";
import type { TradeCircleContent } from "./types";

export function TradeCircle({
  overline,
  headline,
  subheadline,
  content
}: {
  overline: string;
  headline: string;
  subheadline: string;
  content: TradeCircleContent;
}) {
  return (
    <section className="bg-white py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <div className="grid gap-12 md:grid-cols-2 md:gap-16 md:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-neutral-100 px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {overline}
            </div>
            <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[52px]">
              {headline}
            </h2>
            <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
              {subheadline}
            </p>
            <ul className="mt-8 space-y-3 text-[15px] text-neutral-700">
              <li className="flex items-start gap-2">
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  aria-hidden
                />
                Every recommendation is public — and can be looked up.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  aria-hidden
                />
                Mutual recommendations earn the Trade Circle badge.
              </li>
              <li className="flex items-start gap-2">
                <span
                  className="mt-2 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
                  aria-hidden
                />
                Every job you complete together strengthens the circle.
              </li>
            </ul>
          </div>

          <div className="relative">
            <CircleDiagram content={content} />
          </div>
        </div>
      </div>
    </section>
  );
}

function CircleDiagram({ content }: { content: TradeCircleContent }) {
  return (
    <div className="relative mx-auto aspect-square max-w-[500px]">
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 500 500"
        aria-hidden
      >
        <defs>
          <radialGradient id="ring" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255,179,0,0.10)" />
            <stop offset="100%" stopColor="rgba(255,179,0,0)" />
          </radialGradient>
        </defs>
        <circle cx="250" cy="250" r="220" fill="url(#ring)" />
        <circle
          cx="250"
          cy="250"
          r="220"
          fill="none"
          stroke="#fbbf24"
          strokeWidth="1"
          strokeDasharray="4 6"
          opacity="0.4"
        />
        {/* Connection lines */}
        {content.members.map((m, i) => (
          <line
            key={i}
            x1="250"
            y1="250"
            x2={(m.x / 100) * 500}
            y2={(m.y / 100) * 500}
            stroke="#fbbf24"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.4"
            className="motion-safe:animate-pulse"
            style={{ animationDelay: `${i * 300}ms` }}
          />
        ))}
      </svg>

      {/* Center node */}
      <div
        className="absolute left-1/2 top-1/2 z-10 flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-4 border-white bg-neutral-900 text-white shadow-xl md:h-28 md:w-28"
        style={{ boxShadow: "0 12px 40px rgba(15,15,15,0.25)" }}
      >
        <div className="text-[15px] font-black leading-tight">
          {content.center.name}
        </div>
        <div className="mt-0.5 text-[13px] text-white/70">
          {content.center.trade}
        </div>
      </div>

      {/* Orbit nodes */}
      {content.members.map((m, i) => (
        <div
          key={i}
          className="absolute -translate-x-1/2 -translate-y-1/2 motion-safe:animate-[float_5s_ease-in-out_infinite]"
          style={{
            left: `${m.x}%`,
            top: `${m.y}%`,
            animationDelay: `${i * 400}ms`
          }}
        >
          <div className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-2 shadow-md">
            <div
              className={`h-6 w-6 shrink-0 rounded-full ${dotColor(i)} flex items-center justify-center text-[13px] font-bold text-white`}
              aria-hidden
            >
              {m.name[0]}
            </div>
            <div className="min-w-0">
              <div className="text-[13px] font-bold leading-tight text-neutral-900">
                {m.name}
              </div>
              <div className="text-[11px] leading-tight text-neutral-500">
                {m.trade}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function dotColor(i: number): string {
  const colors = [
    "bg-blue-500",
    "bg-emerald-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-orange-500",
    "bg-cyan-500",
    "bg-red-500",
    "bg-indigo-500"
  ];
  return colors[i % colors.length];
}
