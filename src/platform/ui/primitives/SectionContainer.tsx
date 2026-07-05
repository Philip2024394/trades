// SectionContainer — consistent page-section shell.
//
// Every section on every page uses this. Enforces:
//   • max-width cap
//   • horizontal padding
//   • vertical padding scaled mobile → desktop
//   • optional background surface
//   • optional dark mode

import type { ReactNode } from "react";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type SectionSurface = "default" | "muted" | "elevated" | "dark";

const SURFACE_CLASS: Record<SectionSurface, string> = {
  default: "bg-white",
  muted: "bg-neutral-50",
  elevated: "bg-white",
  dark: "bg-neutral-900 text-white"
};

const MAX_WIDTH_CLASS = {
  content: "max-w-3xl",
  wide: "max-w-6xl",
  full: "max-w-none"
} as const;

export type SectionContainerProps = {
  id?: string;
  surface?: SectionSurface;
  width?: keyof typeof MAX_WIDTH_CLASS;
  children: ReactNode;
  /** Override vertical padding — defaults to the SECTION_PAD_Y token. */
  padY?: string;
  className?: string;
};

export function SectionContainer({
  id,
  surface = "default",
  width = "wide",
  children,
  padY = SECTION_PAD_Y,
  className = ""
}: SectionContainerProps) {
  return (
    <section id={id} className={`${SURFACE_CLASS[surface]} ${padY} ${className}`.trim()}>
      <div className={`mx-auto ${MAX_WIDTH_CLASS[width]} ${PAGE_PAD_X}`}>
        {children}
      </div>
    </section>
  );
}
