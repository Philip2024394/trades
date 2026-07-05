// Grid — polymorphic responsive grid with density presets.
//
// This solves the "3-up on mobile / 2-up on desktop" problem across
// the codebase. Every grid uses the same density vocabulary so
// spacing, gap, and breakpoint behaviour are consistent.
//
// Never hand-write `grid grid-cols-N` — use a density preset.

import type { ReactNode } from "react";

export type GridDensity =
  /** Icon shortcuts — 4 per row mobile, 6 desktop. Very tight. */
  | "icons"
  /** Compact info tiles — 3 per row mobile, 3-4 desktop. */
  | "compact"
  /** Standard cards — 2 per row mobile, 3 desktop. */
  | "cards"
  /** Rich cards — 1 per row mobile, 2 desktop. */
  | "rich"
  /** Feature card — 1 across all sizes. */
  | "feature"
  /** KPI grid — 2 per row mobile, 4 desktop. */
  | "kpi"
  /** Small stats — 3 per row all sizes. */
  | "stats-3";

const GRID_CLASS: Record<GridDensity, string> = {
  icons: "grid grid-cols-4 gap-2 md:grid-cols-6 md:gap-3",
  compact: "grid grid-cols-3 gap-2 md:grid-cols-3 md:gap-4 lg:grid-cols-4",
  cards: "grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4",
  rich: "grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6",
  feature: "grid grid-cols-1 gap-4",
  kpi: "grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4",
  "stats-3": "grid grid-cols-3 gap-2 md:gap-3"
};

export type GridProps = {
  density: GridDensity;
  children: ReactNode;
  className?: string;
};

export function Grid({ density, children, className = "" }: GridProps) {
  return (
    <div className={`${GRID_CLASS[density]} ${className}`.trim()}>
      {children}
    </div>
  );
}
