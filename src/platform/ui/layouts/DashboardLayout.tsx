// DashboardLayout — merchant Studio dashboard recipe.
//
// Structure: Greeting → optional Score → KPI grid → optional
// Activity → Insights slot.
//
// KPIs render via Grid density="kpi" (2-up mobile, 4-up desktop).

import type { ReactNode } from "react";
import { ActivityFeed } from "../data/ActivityFeed";
import type { ActivityFeedItem } from "../data/ActivityFeed";
import { LayoutShell } from "./LayoutShell";
import type { LayoutShellProps } from "./LayoutShell";
import { MetricCard } from "../cards/MetricCard";
import type { MetricCardProps } from "../cards/MetricCard";
import { PAGE_PAD_X, SECTION_PAD_Y } from "../tokens";

export type DashboardGreeting = {
  name: string;
  subtitle?: string;
  /** Rendered on the right of the greeting row on desktop. */
  action?: ReactNode;
};

export type DashboardLayoutProps = Omit<LayoutShellProps, "children"> & {
  greeting: DashboardGreeting;
  /** Optional prominent card slot BELOW the greeting — usually the
   *  Business Score card or Priority Actions slot. */
  hero?: ReactNode;
  /** KPIs across the top. */
  kpis?: readonly MetricCardProps[];
  /** Activity feed on the right column on desktop, below KPIs on
   *  mobile. */
  activity?: readonly ActivityFeedItem[];
  /** Free-form insights slot — the Coach panel, charts, etc. */
  main?: ReactNode;
};

export function DashboardLayout({
  greeting,
  hero,
  kpis,
  activity,
  main,
  ...shellProps
}: DashboardLayoutProps) {
  return (
    <LayoutShell {...shellProps}>
      <div className={`mx-auto max-w-6xl ${PAGE_PAD_X} ${SECTION_PAD_Y}`}>
        <header className="flex flex-col gap-2 md:flex-row md:items-baseline md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-neutral-900 md:text-3xl">
              {greeting.name}
            </h1>
            {greeting.subtitle ? (
              <p className="mt-1 text-[14px] text-neutral-600 md:text-[15px]">
                {greeting.subtitle}
              </p>
            ) : null}
          </div>
          {greeting.action ? (
            <div className="shrink-0">{greeting.action}</div>
          ) : null}
        </header>

        {hero ? <div className="mt-6">{hero}</div> : null}

        {kpis?.length ? (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {kpis.map((kpi, i) => (
              <MetricCard key={i} {...kpi} />
            ))}
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="min-w-0">{main}</div>
          {activity?.length ? (
            <aside className="min-w-0">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Activity
              </div>
              <ActivityFeed items={activity} />
            </aside>
          ) : null}
        </div>
      </div>
    </LayoutShell>
  );
}
