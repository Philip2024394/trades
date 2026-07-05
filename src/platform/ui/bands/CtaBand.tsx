// CtaBand — full-width call-to-action section, typically the
// second-to-last section before the footer.
//
// Buttons stack vertically on mobile, side-by-side from sm: up.

import type { ComponentType } from "react";
import { Button } from "../primitives/Button";

export type CtaBandCta = {
  label: string;
  /** Provide either href OR onClick. */
  href?: string;
  onClick?: () => void;
  icon?: ComponentType<{ className?: string }>;
};

export type CtaBandProps = {
  overline?: string;
  headline: string;
  subheadline?: string;
  primaryCta: CtaBandCta;
  secondaryCta?: CtaBandCta;
  variant?: "dark" | "light" | "muted" | "brand";
};

export function CtaBand({
  overline,
  headline,
  subheadline,
  primaryCta,
  secondaryCta,
  variant = "dark"
}: CtaBandProps) {
  const surface =
    variant === "dark"
      ? "bg-neutral-900 text-white"
      : variant === "brand"
      ? "bg-gradient-to-br from-amber-400 to-amber-500 text-neutral-900"
      : variant === "muted"
      ? "bg-neutral-50 text-neutral-900"
      : "bg-white text-neutral-900";
  const subTone =
    variant === "dark"
      ? "text-neutral-300"
      : variant === "brand"
      ? "text-neutral-800"
      : "text-neutral-700";
  const overlineTone =
    variant === "dark"
      ? "text-amber-300"
      : variant === "brand"
      ? "text-neutral-900"
      : "text-neutral-500";
  return (
    <section className={`${surface} py-12 md:py-16`}>
      <div className="mx-auto max-w-3xl px-4 text-center">
        {overline ? (
          <div
            className={`mb-2 text-[11px] font-semibold uppercase tracking-wide ${overlineTone}`}
          >
            {overline}
          </div>
        ) : null}
        <h2 className="text-2xl font-bold leading-tight md:text-3xl">
          {headline}
        </h2>
        {subheadline ? (
          <p
            className={`mx-auto mt-3 max-w-lg text-[14px] leading-relaxed md:text-[15px] ${subTone}`}
          >
            {subheadline}
          </p>
        ) : null}
        <div className="mx-auto mt-6 flex max-w-md flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button
            href={primaryCta.href}
            onClick={primaryCta.onClick}
            intent={variant === "brand" ? "secondary" : "primary"}
            size="lg"
            icon={primaryCta.icon}
            className={variant === "brand" ? "!bg-neutral-900 !text-white hover:!bg-neutral-800" : ""}
          >
            {primaryCta.label}
          </Button>
          {secondaryCta ? (
            <Button
              href={secondaryCta.href}
              onClick={secondaryCta.onClick}
              intent="secondary"
              size="lg"
              icon={secondaryCta.icon}
              className={
                variant === "dark"
                  ? "border-white/30 bg-transparent text-white hover:bg-white/10"
                  : ""
              }
            >
              {secondaryCta.label}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
