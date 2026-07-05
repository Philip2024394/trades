// Chip — small pill for categories, tags, filters, statuses.
//
// Never write `rounded-full bg-neutral-100 px-2 py-0.5 text-[11px]`
// again. Use Chip.

import type { ComponentType, ReactNode } from "react";

export type ChipTone =
  | "neutral"
  | "amber"
  | "emerald"
  | "blue"
  | "red"
  | "dark";
export type ChipSize = "xs" | "sm" | "md";

const TONE_CLASS: Record<ChipTone, string> = {
  neutral: "bg-neutral-100 text-neutral-800",
  amber: "bg-amber-100 text-amber-800",
  emerald: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  red: "bg-red-100 text-red-800",
  dark: "bg-neutral-900 text-white"
};

const SIZE_CLASS: Record<ChipSize, string> = {
  xs: "px-1.5 py-0.5 text-[10px]",
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-[12px]"
};

export type ChipProps = {
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  onClick?: () => void;
  className?: string;
};

export function Chip({
  tone = "neutral",
  size = "sm",
  icon: Icon,
  children,
  onClick,
  className = ""
}: ChipProps) {
  const cls = `inline-flex items-center gap-1 rounded-full font-medium ${TONE_CLASS[tone]} ${SIZE_CLASS[size]} ${className}`.trim();
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {children}
      </button>
    );
  }
  return (
    <span className={cls}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </span>
  );
}
