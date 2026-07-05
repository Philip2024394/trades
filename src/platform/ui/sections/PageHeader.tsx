// PageHeader — larger, page-level heading. One per page at most.
//
// Structure:
//   [Breadcrumbs / back link]
//   [Overline]
//   Title              [Actions]
//   Subtitle

import type { ComponentType, ReactNode } from "react";
import { Overline } from "../content/Overline";
import type { OverlineTone } from "../content/Overline";

export type PageHeaderProps = {
  overline?: string;
  overlineIcon?: ComponentType<{ className?: string }>;
  overlineTone?: OverlineTone;
  title: string;
  subtitle?: string;
  /** Optional back-link / breadcrumb slot rendered above overline. */
  breadcrumbs?: ReactNode;
  /** Actions rendered to the right on desktop, wrapped on mobile. */
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  overline,
  overlineIcon,
  overlineTone,
  title,
  subtitle,
  breadcrumbs,
  actions,
  className = ""
}: PageHeaderProps) {
  return (
    <header className={`flex flex-col gap-2 ${className}`.trim()}>
      {breadcrumbs ? (
        <div className="text-[12px] text-neutral-500">{breadcrumbs}</div>
      ) : null}
      {overline ? (
        <Overline icon={overlineIcon} tone={overlineTone}>
          {overline}
        </Overline>
      ) : null}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between md:gap-6">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight text-neutral-900 md:text-3xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-neutral-700 md:text-[15px]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
