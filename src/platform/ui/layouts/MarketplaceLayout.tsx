// MarketplaceLayout — directory / marketplace listing recipe.
//
// Structure: PageHeader → sticky filter chip row → result grid slot
// → optional featured band → pagination footer slot.
//
// Result grid is a slot — consumers pass the ProductCard / ProjectTile
// grid that matches their entity (services list, projects directory,
// trades directory).

import type { ComponentType, ReactNode } from "react";
import { Overline } from "../content/Overline";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type MarketplaceLayoutProps = Omit<LayoutShellProps, "children"> & {
  overline?: string;
  overlineIcon?: ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  /** Right-side actions in the page header (Sort / New listing). */
  headerActions?: ReactNode;
  /** Sticky filter chip strip — usually FilterChipRow when built. */
  filters?: ReactNode;
  /** Main result grid — consumers pass their own composition. */
  results: ReactNode;
  /** Optional featured band above the results. */
  featured?: ReactNode;
  /** Pagination controls below the results. */
  pagination?: ReactNode;
  /** Empty state slot — shown when `results` is falsy. */
  empty?: ReactNode;
};

export function MarketplaceLayout({
  overline,
  overlineIcon: OverlineIcon,
  title,
  subtitle,
  headerActions,
  filters,
  results,
  featured,
  pagination,
  empty,
  ...shellProps
}: MarketplaceLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      <div className={`mx-auto max-w-6xl ${PAGE_PAD_X} ${SECTION_PAD_Y}`}>
        <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            {overline ? (
              <Overline icon={OverlineIcon}>{overline}</Overline>
            ) : null}
            <h1 className="mt-1 text-2xl font-bold text-neutral-900 md:text-3xl">
              {title}
            </h1>
            {subtitle ? (
              <p className="mt-1 max-w-2xl text-[14px] text-neutral-700 md:text-[15px]">
                {subtitle}
              </p>
            ) : null}
          </div>
          {headerActions ? <div>{headerActions}</div> : null}
        </header>

        {filters ? <div className="mt-6">{filters}</div> : null}
        {featured ? <div className="mt-6">{featured}</div> : null}
        <div className="mt-6">{results ?? empty}</div>
        {pagination ? <div className="mt-6">{pagination}</div> : null}
      </div>
    </LayoutShell>
  );
}
