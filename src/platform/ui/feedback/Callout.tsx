// Callout — highlighted content block for important-but-not-urgent
// content. Bigger than Alert, quieter than a hero. Used for tips,
// asides, editorial notes.

import type { ComponentType, ReactNode } from "react";
import { CARD_RADIUS } from "../tokens";

export type CalloutTone = "neutral" | "amber" | "emerald" | "blue" | "editorial";

const TONE_CLASS: Record<CalloutTone, string> = {
  neutral: "bg-neutral-50 border-l-4 border-neutral-400",
  amber: "bg-amber-50 border-l-4 border-amber-400",
  emerald: "bg-emerald-50 border-l-4 border-emerald-500",
  blue: "bg-blue-50 border-l-4 border-blue-500",
  editorial: "bg-neutral-900 text-white"
};

export type CalloutProps = {
  tone?: CalloutTone;
  icon?: ComponentType<{ className?: string }>;
  title?: string;
  children: ReactNode;
};

export function Callout({
  tone = "neutral",
  icon: Icon,
  title,
  children
}: CalloutProps) {
  const radius = tone === "editorial" ? CARD_RADIUS : "rounded-r-xl";
  return (
    <div className={`p-4 md:p-5 ${radius} ${TONE_CLASS[tone]}`}>
      {(Icon || title) ? (
        <div className="mb-1.5 flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {title ? (
            <div className={`text-[14px] font-semibold ${tone === "editorial" ? "text-white" : "text-neutral-900"}`}>
              {title}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={`text-[13px] leading-relaxed ${tone === "editorial" ? "text-neutral-200" : "text-neutral-700"}`}>
        {children}
      </div>
    </div>
  );
}
