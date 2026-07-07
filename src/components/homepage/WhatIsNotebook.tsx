// Section 2 — What Is The Construction Notebook.
//
// The whole product in 8 steps, connected by a vertical flow line.
// Server component; on-scroll reveal happens via CSS class + IntersectionObserver
// pattern (Tailwind's motion-safe: prefix already gates reduced-motion).

import {
  UserPlus,
  Hammer,
  PenLine,
  Camera,
  ShieldCheck,
  Store,
  BookOpen,
  Sparkles
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { WhatIsStep } from "./types";

const ICON_BY_INDEX: LucideIcon[] = [
  UserPlus,     // Trade joins
  Hammer,       // Completes project
  PenLine,      // Customer signs
  Camera,       // Uploads photos
  ShieldCheck,  // Warranty stored
  Store,        // Merchant linked
  BookOpen,     // Notebook grows
  Sparkles      // Reputation compounds
];

export function WhatIsNotebook({
  overline,
  headline,
  subheadline,
  steps
}: {
  overline: string;
  headline: string;
  subheadline: string;
  steps: WhatIsStep[];
}) {
  return (
    <section className="bg-neutral-50 py-24 md:py-32">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12 lg:px-20">
        <header className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold uppercase tracking-wider text-neutral-700 shadow-sm">
            {overline}
          </div>
          <h2 className="mt-6 text-[36px] font-bold leading-[1.1] tracking-tight text-neutral-900 md:text-[52px]">
            {headline}
          </h2>
          <p className="mt-4 text-[17px] leading-[1.55] text-neutral-600 md:text-[18px]">
            {subheadline}
          </p>
        </header>

        <div className="mx-auto mt-16 max-w-3xl">
          {steps.map((step, i) => {
            const Icon = ICON_BY_INDEX[i] ?? BookOpen;
            const isLast = i === steps.length - 1;
            return (
              <div key={step.n} className="relative flex gap-5">
                {/* Left column — icon + connector line */}
                <div className="flex flex-col items-center">
                  <div className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-amber-400 bg-white text-neutral-900 shadow-sm">
                    <Icon className="h-6 w-6" aria-hidden />
                  </div>
                  {!isLast ? (
                    <div className="w-px flex-1 bg-gradient-to-b from-amber-400 to-neutral-200" />
                  ) : null}
                </div>
                {/* Right column — step content */}
                <div className="min-w-0 flex-1 pb-10">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[13px] font-mono font-semibold text-amber-600">
                      {String(step.n).padStart(2, "0")}
                    </span>
                    <h3 className="text-[19px] font-bold text-neutral-900 md:text-[22px]">
                      {step.label}
                    </h3>
                  </div>
                  {step.detail ? (
                    <p className="mt-1.5 text-[15px] leading-[1.6] text-neutral-600">
                      {step.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
