// SectionHeader — the workhorse header for every section on every page.
//
// Structure:
//   [Overline]
//   Title            [Trailing action / meta]
//   Subtitle
//
// Aligns left by default, centered variant for hero-style sections.

import type { ComponentType, ReactNode } from "react";
import { Overline } from "../content/Overline";
import type { OverlineTone } from "../content/Overline";

export type SectionHeaderAlign = "left" | "center";

export type SectionHeaderProps = {
  overline?: string;
  overlineIcon?: ComponentType<{ className?: string }>;
  overlineTone?: OverlineTone;
  title: string;
  subtitle?: string;
  align?: SectionHeaderAlign;
  /** Trailing meta / action shown to the right of the title on wide
   *  screens, below the subtitle on mobile. */
  trailing?: ReactNode;
  className?: string;
};

export function SectionHeader({
  overline,
  overlineIcon,
  overlineTone,
  title,
  subtitle,
  align = "left",
  trailing,
  className = ""
}: SectionHeaderProps) {
  const alignCls = align === "center" ? "text-center items-center" : "";
  return (
    <div className={`flex flex-col gap-1.5 ${alignCls} ${className}`.trim()}>
      {overline ? (
        <Overline icon={overlineIcon} tone={overlineTone}>
          {overline}
        </Overline>
      ) : null}
      <div
        className={`flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between md:gap-6 ${align === "center" ? "md:flex-col md:items-center" : ""}`}
      >
        <h2 className="text-xl font-bold text-neutral-900 md:text-2xl">
          {title}
        </h2>
        {trailing ? (
          <div className="shrink-0 text-[13px] text-neutral-500">
            {trailing}
          </div>
        ) : null}
      </div>
      {subtitle ? (
        <p className={`max-w-2xl text-[14px] leading-relaxed text-neutral-700 md:text-[15px] ${align === "center" ? "mx-auto" : ""}`}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}
