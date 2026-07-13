"use client";

// Mobile signup-page top strip — condenses NetworkPulse into a single
// horizontal marquee that sits above the form on narrow viewports.
// Continuous scroll, pause on tap, prefers-reduced-motion respected.
//
// Sits directly under the hero on mobile so the ecosystem-buzz signal
// lands even without the sticky sidebar (which desktop shows).

import { useEffect, useState } from "react";
import { Zap, Rocket, TrendingUp, Flame } from "lucide-react";
import { BRAND_YELLOW, BRAND_BLACK, BRAND_GREEN_DARK } from "@/lib/brand/tokens";

const MARQUEE_CSS = `
@keyframes signup-pulse-marquee {
  0%   { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}
.signup-pulse-track {
  animation: signup-pulse-marquee 45s linear infinite;
  will-change: transform;
}
.signup-pulse-shell:active .signup-pulse-track {
  animation-play-state: paused;
}
@media (prefers-reduced-motion: reduce) {
  .signup-pulse-track { animation: none; }
}
`;

type StripChip = {
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number | string }>;
  primary: string;
  secondary?: string;
  tone: "live" | "founding" | "hot" | "neutral";
};

const STRIP_CHIPS: StripChip[] = [
  { icon: Zap,         primary: "127 tradies",        secondary: "joined 24h",             tone: "live" },
  { icon: Rocket,      primary: "43 slots left",       secondary: "Founding 100",          tone: "founding" },
  { icon: Flame,       primary: "£320 day",           secondary: "NW sparks · Trade Chat", tone: "hot" },
  { icon: TrendingUp,  primary: "🇬🇧 2,847 · 🇮🇪 341", secondary: "worldwide",             tone: "neutral" },
  { icon: Rocket,      primary: "Marcus Thorne",       secondary: "Bricklayer · live 4h",   tone: "live" },
  { icon: Zap,         primary: "Craig McDermott",     secondary: "Sparks · went live 18m", tone: "live" },
  { icon: Flame,       primary: "UK Kitchen Fitters",  secondary: "hit 128 members",       tone: "hot" },
  { icon: Rocket,      primary: "Priya Menon",         secondary: "Interior · live 6h",     tone: "live" }
];

export function SignupPulseStrip() {
  const [tone] = useState<"live" | "founding" | "hot" | "neutral">("live");
  useEffect(() => { void tone; }, [tone]);

  return (
    <div
      className="signup-pulse-shell relative overflow-hidden border-y bg-white lg:hidden"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <style>{MARQUEE_CSS}</style>
      <div
        className="relative overflow-hidden py-2"
        style={{
          maskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
        }}
      >
        <div className="signup-pulse-track flex w-max gap-2 px-3">
          {[...STRIP_CHIPS, ...STRIP_CHIPS].map((chip, i) => (
            <Chip key={`${chip.primary}-${i}`} chip={chip}/>
          ))}
        </div>
      </div>
    </div>
  );
}

function Chip({ chip }: { chip: StripChip }) {
  const Icon = chip.icon;
  const isLive = chip.tone === "live";
  const isFounding = chip.tone === "founding";
  const isHot = chip.tone === "hot";
  const dotColor = isLive ? BRAND_GREEN_DARK : isFounding ? BRAND_YELLOW : isHot ? "#DC2626" : "#737373";
  return (
    <div
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-full border bg-white px-2.5 py-1 shadow-sm"
      style={{ borderColor: "rgba(139,69,19,0.15)" }}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isLive && (
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
            style={{ backgroundColor: dotColor }}
          />
        )}
        <span
          className="relative inline-flex h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: dotColor }}
        />
      </span>
      <Icon size={10} color={BRAND_BLACK} strokeWidth={2.5}/>
      <span className="text-[11px] font-black text-neutral-900">{chip.primary}</span>
      {chip.secondary && (
        <span className="text-[10px] font-bold text-neutral-500">· {chip.secondary}</span>
      )}
    </div>
  );
}
