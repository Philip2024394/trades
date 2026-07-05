// CoachLayout — Business Operating Coach recipe.
//
// Overall score header + priority-action band + scorecard grid +
// activity feed. Consumers pass typed props; layout arranges.
//
// Kept slot-driven — the CoachPanel + scorecard rendering itself
// live in src/platform/coach/. This layout is the shell around
// them.

import type { ReactNode } from "react";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type CoachLayoutProps = Omit<LayoutShellProps, "children"> & {
  /** Big header content — usually the score number + title copy. */
  scoreHeader: ReactNode;
  /** Priority action list — typically the top 3 backlog items. */
  priorityActions?: ReactNode;
  /** The main scorecard / backlog panel. */
  scorecard: ReactNode;
  /** Optional side rail on desktop — coach messages, tips. */
  sideRail?: ReactNode;
};

export function CoachLayout({
  scoreHeader,
  priorityActions,
  scorecard,
  sideRail,
  ...shellProps
}: CoachLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      <div className={`mx-auto max-w-6xl ${PAGE_PAD_X} ${SECTION_PAD_Y}`}>
        <header>{scoreHeader}</header>
        {priorityActions ? (
          <div className="mt-6">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
              This week
            </div>
            {priorityActions}
          </div>
        ) : null}
        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">{scorecard}</div>
          {sideRail ? <aside className="min-w-0">{sideRail}</aside> : null}
        </div>
      </div>
    </LayoutShell>
  );
}
