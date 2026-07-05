// ProcessBand — numbered 3-4 step process ("How we work").
//
// One of the most under-used trust patterns. Every service business
// should have one. Numbers + short descriptions + optional icons.

import type { ComponentType } from "react";
import { Overline } from "../content/Overline";

export type ProcessStep = {
  title: string;
  description: string;
  icon?: ComponentType<{ className?: string }>;
};

export type ProcessBandProps = {
  overline?: string;
  heading: string;
  subheading?: string;
  steps: readonly ProcessStep[];
  surface?: "light" | "muted" | "dark";
};

export function ProcessBand({
  overline,
  heading,
  subheading,
  steps,
  surface = "light"
}: ProcessBandProps) {
  const bg =
    surface === "dark"
      ? "bg-neutral-900 text-white"
      : surface === "muted"
      ? "bg-neutral-50"
      : "bg-white";
  const headingColor =
    surface === "dark" ? "text-white" : "text-neutral-900";
  const subColor =
    surface === "dark" ? "text-neutral-300" : "text-neutral-700";
  const stepBorder =
    surface === "dark" ? "border-neutral-800" : "border-neutral-200";
  const stepBg = surface === "dark" ? "bg-neutral-800/50" : "bg-white";
  const stepText = surface === "dark" ? "text-neutral-300" : "text-neutral-700";
  return (
    <section className={`${bg} py-12 md:py-16`}>
      <div className="mx-auto max-w-6xl px-4">
        {(overline || heading) ? (
          <div className="mb-8 flex flex-col gap-1.5">
            {overline ? (
              <Overline tone={surface === "dark" ? "amber" : "neutral"}>
                {overline}
              </Overline>
            ) : null}
            <h2 className={`text-xl font-bold md:text-2xl ${headingColor}`}>
              {heading}
            </h2>
            {subheading ? (
              <p className={`max-w-2xl text-[14px] leading-relaxed md:text-[15px] ${subColor}`}>
                {subheading}
              </p>
            ) : null}
          </div>
        ) : null}
        <ol
          className={`grid gap-3 md:gap-4 ${
            steps.length === 2
              ? "grid-cols-2"
              : steps.length === 3
              ? "grid-cols-1 md:grid-cols-3"
              : "grid-cols-2 md:grid-cols-4"
          }`}
        >
          {steps.map((step, i) => {
            const Icon = step.icon;
            return (
              <li
                key={i}
                className={`relative rounded-xl border p-4 md:rounded-2xl md:p-5 ${stepBorder} ${stepBg}`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400 text-[14px] font-bold text-neutral-900">
                    {i + 1}
                  </div>
                  {Icon ? (
                    <Icon
                      className={`h-4 w-4 ${surface === "dark" ? "text-amber-300" : "text-neutral-500"}`}
                    />
                  ) : null}
                </div>
                <h3 className={`text-[14px] font-semibold ${headingColor} md:text-[15px]`}>
                  {step.title}
                </h3>
                <p className={`mt-1 text-[12px] leading-relaxed md:text-[13px] ${stepText}`}>
                  {step.description}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
