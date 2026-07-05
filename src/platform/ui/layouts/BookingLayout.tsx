// BookingLayout — hotel-style booking flow.
//
// Structure: Hero → Steps progress → main step slot → summary rail
// (visible above the fold on desktop, below the step on mobile) →
// sticky submit.
//
// The main step slot is a page-authored component (calendar,
// customer info form, deposit UI). This layout wraps the shell.

import type { ReactNode } from "react";
import { StepDots } from "../onboarding/StepDots";
import type { StepDotsStep } from "../onboarding/StepDots";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type BookingLayoutProps = Omit<LayoutShellProps, "children"> & {
  /** Optional hero band above the flow. Typically slim. */
  hero?: ReactNode;
  /** Ordered steps for the StepDots indicator. */
  steps: readonly StepDotsStep[];
  activeStep: number;
  /** Main body — the current step's content. */
  main: ReactNode;
  /** Summary rail — visible above the fold on desktop; renders as a
   *  collapsible card below the main on mobile. */
  summary?: ReactNode;
  /** Sticky submit at the bottom. Pass a StickySubmit. */
  stickySubmit?: ReactNode;
};

export function BookingLayout({
  hero,
  steps,
  activeStep,
  main,
  summary,
  stickySubmit,
  ...shellProps
}: BookingLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      {hero}
      <div className={`mx-auto max-w-4xl ${PAGE_PAD_X} ${SECTION_PAD_Y}`}>
        <div className="mb-6 flex justify-center">
          <StepDots
            steps={steps}
            activeIndex={activeStep}
            tone="brand"
          />
        </div>
        <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">{main}</div>
          {summary ? (
            <aside className="min-w-0 md:sticky md:top-20 md:self-start">
              {summary}
            </aside>
          ) : null}
        </div>
        {stickySubmit ? <div className="mt-6">{stickySubmit}</div> : null}
      </div>
    </LayoutShell>
  );
}
