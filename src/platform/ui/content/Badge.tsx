// Badge — icon + text, tighter than Chip. Used for status indicators
// on cards (Featured, Verified, Live) and trust signals.

import type { ComponentType, ReactNode } from "react";

export type BadgeTone =
  | "neutral"
  | "amber"
  | "emerald"
  | "blue"
  | "red"
  | "dark";

const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "bg-white/10 text-white",
  amber: "bg-amber-400 text-neutral-900",
  emerald: "bg-emerald-500 text-white",
  blue: "bg-blue-500 text-white",
  red: "bg-red-500 text-white",
  dark: "bg-neutral-900 text-white"
};

export type BadgeProps = {
  icon?: ComponentType<{ className?: string }>;
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
};

export function Badge({
  icon: Icon,
  tone = "amber",
  children,
  className = ""
}: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_CLASS[tone]} ${className}`.trim()}
    >
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}
