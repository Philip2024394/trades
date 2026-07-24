"use client";

// LivePlatformCard — social-proof row. Tuned for mobile: 4 tightly
// stacked avatars, counter text that truncates, and a compact
// arrow-only chip on the right so the row never overflows on a
// 360px screen. V1 stock avatars; V2 wires realtime presence.

import { ArrowRight } from "lucide-react";

const ONLINE_AVATARS = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&q=80",
  "https://images.unsplash.com/photo-1580489944761-15a19d654956?w=80&q=80",
  "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=80&q=80"
];

export function LivePlatformCard() {
  return (
    <section className="mt-3 px-5">
      <button
        type="button"
        aria-label="See who's online"
        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-transform active:scale-[0.99]"
        style={{
          background: "#0A0A0F",
          border: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "0 8px 24px -14px rgba(0,0,0,0.55)"
        }}
      >
        {/* Stacked avatars */}
        <div className="flex flex-shrink-0 items-center">
          {ONLINE_AVATARS.map((src, i) => (
            <span
              key={i}
              className="grid h-7 w-7 place-items-center overflow-hidden rounded-full"
              style={{
                marginLeft: i === 0 ? 0 : -9,
                border: "2px solid #0A0A0F",
                zIndex: ONLINE_AVATARS.length - i
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
            </span>
          ))}
        </div>

        {/* Counter — truncates to protect the layout on narrow screens */}
        <div className="min-w-0 flex-1">
          <div
            className="flex items-baseline gap-1.5 truncate text-[12.5px] font-black"
            style={{ color: "#F5F5FA" }}
          >
            <span
              aria-hidden
              className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
              style={{
                background: "#22C55E",
                boxShadow: "0 0 0 3px rgba(34,197,94,0.22)"
              }}
            />
            28,452 online
          </div>
          <div
            className="truncate text-[10px] leading-tight"
            style={{ color: "#8E8E9E" }}
          >
            Chat, connect and grow together
          </div>
        </div>

        {/* Compact arrow chip — orange on black reads as premium */}
        <span
          className="grid h-8 w-8 flex-shrink-0 place-items-center rounded-full"
          style={{
            background: "rgba(245,158,11,0.14)",
            color: "var(--nex-accent-500)",
            border: "1px solid rgba(245,158,11,0.32)"
          }}
          aria-hidden
        >
          <ArrowRight size={14} strokeWidth={2.25} />
        </span>
      </button>
    </section>
  );
}
