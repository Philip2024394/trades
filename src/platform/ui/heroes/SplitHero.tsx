// SplitHero — text left, image right. The workhorse hero for
// service-led sites. Mobile: text column + small square image column.
// Desktop: 50/50 split with generous image column.

import type { ComponentType, ReactNode } from "react";
import { Badge } from "../content/Badge";
import { Button } from "../primitives/Button";

export type SplitHeroCta = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export type SplitHeroProps = {
  /** Small chip above the headline — usually location or role. */
  eyebrow?: {
    icon?: ComponentType<{ className?: string }>;
    label: string;
  };
  headline: string;
  subheadline?: string;
  /** Extra fine-print line, hidden below the sm: breakpoint. */
  supportingLine?: string;
  primaryCta: SplitHeroCta;
  secondaryCta?: SplitHeroCta;
  /** Trust chips. Hidden below sm: to keep mobile clean. */
  trustBadges?: readonly string[];
  /** Custom image slot. If not supplied, a subtle placeholder is
   *  used with the hint text (desktop only). */
  imageSlot?: ReactNode;
  imageHint?: string;
  /** Dark background is the default premium look. */
  surface?: "dark" | "brand";
};

export function SplitHero({
  eyebrow,
  headline,
  subheadline,
  supportingLine,
  primaryCta,
  secondaryCta,
  trustBadges,
  imageSlot,
  imageHint,
  surface = "dark"
}: SplitHeroProps) {
  const bgClass =
    surface === "brand"
      ? "bg-gradient-to-br from-neutral-900 via-neutral-900 to-amber-900"
      : "bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800";
  const EyebrowIcon = eyebrow?.icon;
  return (
    <section className={`relative overflow-hidden text-white ${bgClass}`}>
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_theme(colors.amber.500)_0%,_transparent_50%)]" />
      </div>
      <div className="relative mx-auto max-w-6xl px-4 py-12 sm:py-16 md:py-24">
        <div className="grid grid-cols-[1fr_112px] items-center gap-4 sm:grid-cols-[1fr_140px] sm:gap-6 md:grid-cols-2 md:gap-10">
          <div>
            {eyebrow ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-amber-200">
                {EyebrowIcon ? <EyebrowIcon className="h-3 w-3" /> : null}
                {eyebrow.label}
              </div>
            ) : null}
            <h1 className="text-[22px] font-bold leading-[1.15] sm:text-3xl md:text-5xl md:leading-tight">
              {headline}
            </h1>
            {subheadline ? (
              <p className="mt-3 text-[13px] leading-relaxed text-neutral-200 md:mt-4 md:text-[17px]">
                {subheadline}
              </p>
            ) : null}
            {supportingLine ? (
              <p className="mt-2 hidden text-[13px] text-neutral-300 sm:block">
                {supportingLine}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
              <Button
                href={primaryCta.href}
                intent="primary"
                size="lg"
                icon={primaryCta.icon}
              >
                {primaryCta.label}
              </Button>
              {secondaryCta ? (
                <Button
                  href={secondaryCta.href}
                  intent="secondary"
                  size="lg"
                  icon={secondaryCta.icon}
                  className="border-white/30 bg-transparent text-white hover:bg-white/10"
                >
                  {secondaryCta.label}
                </Button>
              ) : null}
            </div>
            {trustBadges?.length ? (
              <div className="mt-5 hidden flex-wrap gap-2 sm:flex">
                {trustBadges.map((badge, i) => (
                  <Badge key={i} tone="neutral">
                    {badge}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
          <div>
            <div className="rounded-2xl border border-white/10 bg-neutral-800/50 p-2 backdrop-blur md:p-4">
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-gradient-to-br from-neutral-700/70 to-neutral-800/60 md:aspect-[4/3]">
                {imageSlot ?? (
                  <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-neutral-400 md:gap-2">
                    <PlaceholderIcon />
                    <div className="hidden text-[11px] md:block">
                      Hero image slot
                    </div>
                    {imageHint ? (
                      <div className="hidden text-center text-[11px] text-neutral-600 md:block">
                        {imageHint}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PlaceholderIcon() {
  return (
    <svg
      className="h-6 w-6 md:h-8 md:w-8"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}
