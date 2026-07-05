// MinimalHero — centered headline + CTA, no image column.
//
// Perfect for internal tools, dashboards, and pages where an image
// would compete with a data-heavy body.

import type { ComponentType } from "react";
import { Button } from "../primitives/Button";

export type MinimalHeroCta = {
  label: string;
  href: string;
  icon?: ComponentType<{ className?: string }>;
};

export type MinimalHeroProps = {
  eyebrow?: {
    icon?: ComponentType<{ className?: string }>;
    label: string;
  };
  headline: string;
  subheadline?: string;
  primaryCta?: MinimalHeroCta;
  secondaryCta?: MinimalHeroCta;
  surface?: "light" | "dark" | "muted";
};

export function MinimalHero({
  eyebrow,
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  surface = "light"
}: MinimalHeroProps) {
  const bg =
    surface === "dark"
      ? "bg-neutral-900 text-white"
      : surface === "muted"
      ? "bg-neutral-50 text-neutral-900"
      : "bg-white text-neutral-900";
  const subTone =
    surface === "dark" ? "text-neutral-300" : "text-neutral-700";
  const eyebrowTone =
    surface === "dark"
      ? "bg-white/10 text-amber-200"
      : "bg-amber-100 text-amber-800";
  const EyebrowIcon = eyebrow?.icon;
  return (
    <section className={bg}>
      <div className="mx-auto max-w-3xl px-4 py-12 text-center md:py-20">
        {eyebrow ? (
          <div
            className={`mb-3 inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[11px] font-medium ${eyebrowTone}`}
          >
            {EyebrowIcon ? <EyebrowIcon className="h-3 w-3" /> : null}
            {eyebrow.label}
          </div>
        ) : null}
        <h1 className="text-[26px] font-bold leading-tight sm:text-4xl md:text-5xl">
          {headline}
        </h1>
        {subheadline ? (
          <p
            className={`mx-auto mt-3 max-w-2xl text-[14px] leading-relaxed md:mt-4 md:text-[17px] ${subTone}`}
          >
            {subheadline}
          </p>
        ) : null}
        {(primaryCta || secondaryCta) ? (
          <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
            {primaryCta ? (
              <Button
                href={primaryCta.href}
                intent="primary"
                size="lg"
                icon={primaryCta.icon}
              >
                {primaryCta.label}
              </Button>
            ) : null}
            {secondaryCta ? (
              <Button
                href={secondaryCta.href}
                intent="secondary"
                size="lg"
                icon={secondaryCta.icon}
                className={surface === "dark" ? "border-white/30 bg-transparent text-white hover:bg-white/10" : ""}
              >
                {secondaryCta.label}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
