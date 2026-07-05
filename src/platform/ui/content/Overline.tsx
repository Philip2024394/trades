// Overline — small uppercase label above a heading.
//
// Used everywhere a section wants to name its role — "SERVICES",
// "OUR APPROACH", "BUSINESS COACH". Consistent tracking + colour.

import type { ComponentType, ReactNode } from "react";

export type OverlineTone = "neutral" | "amber" | "emerald" | "blue" | "red";

const TONE_CLASS: Record<OverlineTone, string> = {
  neutral: "text-neutral-500",
  amber: "text-amber-700",
  emerald: "text-emerald-700",
  blue: "text-blue-700",
  red: "text-red-700"
};

export type OverlineProps = {
  icon?: ComponentType<{ className?: string }>;
  tone?: OverlineTone;
  children: ReactNode;
  className?: string;
};

export function Overline({
  icon: Icon,
  tone = "neutral",
  children,
  className = ""
}: OverlineProps) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      <span>{children}</span>
    </div>
  );
}
