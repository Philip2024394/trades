// StickyBottomActionBar — mobile-only sticky action bar at bottom.
//
// One of the highest-impact conversion patterns for local trade
// sites. Always includes a Call CTA + a primary CTA.

"use client";

import type { ReactNode } from "react";
import { ELEVATION_INVERTED } from "../tokens";

export type StickyBottomActionBarProps = {
  /** Left slot — usually a secondary action (Call). */
  left?: ReactNode;
  /** Right slot — primary CTA. */
  right: ReactNode;
  /** Ratio between left and right — default balances Call vs main CTA. */
  ratio?: "1:1" | "1:1.4" | "1:2";
  /** Set true to hide the bar. */
  hidden?: boolean;
};

const RATIO_CLASS: Record<NonNullable<StickyBottomActionBarProps["ratio"]>, [string, string]> = {
  "1:1": ["flex-1", "flex-1"],
  "1:1.4": ["flex-1", "flex-[1.4]"],
  "1:2": ["flex-1", "flex-[2]"]
};

export function StickyBottomActionBar({
  left,
  right,
  ratio = "1:1.4",
  hidden
}: StickyBottomActionBarProps) {
  if (hidden) return null;
  const [leftFlex, rightFlex] = RATIO_CLASS[ratio];
  return (
    <>
      <div
        className={`fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-neutral-200 bg-white/95 px-3 py-2 backdrop-blur md:hidden ${ELEVATION_INVERTED[3]}`}
      >
        {left ? <div className={leftFlex}>{left}</div> : null}
        <div className={rightFlex}>{right}</div>
      </div>
      {/* Spacer so page content isn't hidden behind the bar. */}
      <div className="h-16 md:hidden" aria-hidden="true" />
    </>
  );
}
