// Tooltip — hover / focus tooltip for icon buttons and short hints.
//
// CSS-only (no JS state) — uses group-hover + group-focus. That means
// no dependency on tab order tracking + no measurable performance
// cost. Trade-off: no click-to-open on touch — for touch surfaces
// use Popover or a label chip instead.

import type { ReactNode } from "react";

export type TooltipSide = "top" | "bottom" | "left" | "right";

const SIDE_CLASS: Record<TooltipSide, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2"
};

export type TooltipProps = {
  label: string;
  side?: TooltipSide;
  children: ReactNode;
};

export function Tooltip({ label, side = "top", children }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${SIDE_CLASS[side]}`}
      >
        {label}
      </span>
    </span>
  );
}
