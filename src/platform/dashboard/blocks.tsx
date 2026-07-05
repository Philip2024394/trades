// dashboardBlockRegistry — 11 block types.
//
// Every block CONSUMES metrics from metricRegistry (never invents
// them) and reads from ResolvedStrategy facets to adapt behaviour.

"use client";

import * as React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  Briefcase,
  Calendar,
  ClipboardList,
  Filter,
  MessageSquare,
  Sparkles,
  TrendingUp,
  UsersRound
} from "lucide-react";
import { dashboardBlockRegistry } from "./registry";
import type {
  DashboardBlockRendererProps
} from "./types";
import type { MetricValue } from "@/platform/metrics";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── Helpers ──────────────────────────────────────────────────
function DeltaChip({ delta }: { delta: MetricValue["delta"] }) {
  if (!delta) return null;
  const Icon =
    delta.direction === "up"
      ? ArrowUpRight
      : delta.direction === "down"
        ? ArrowDownRight
        : TrendingUp;
  const cls =
    delta.direction === "up"
      ? "text-emerald-700 bg-emerald-100"
      : delta.direction === "down"
        ? "text-rose-700 bg-rose-100"
        : "text-neutral-700 bg-neutral-100";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold " +
        cls
      }
    >
      <Icon size={12} strokeWidth={2.5} aria-hidden />
      {Math.abs(delta.percent)}%
    </span>
  );
}

function Card({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col gap-2 rounded-xl border border-border bg-background p-4 shadow-sm " +
        (className ?? "")
      }
    >
      {children}
    </div>
  );
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-caption font-extrabold uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

// ─── 1. analytics-card ────────────────────────────────────────
function AnalyticsCardRenderer({
  metrics,
  title,
  kpiTargets
}: DashboardBlockRendererProps) {
  const first = Object.values(metrics)[0];
  if (!first) return <Card><Muted>No data</Muted></Card>;
  const target = kpiTargets?.[first.metricSlug];
  return (
    <Card>
      <Muted>{title ?? first.metricSlug.replace(/_/g, " ")}</Muted>
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-extrabold text-foreground tabular-nums">
          {first.formatted}
        </span>
        <DeltaChip delta={first.delta} />
      </div>
      {target && (
        <p className="text-[11px] text-muted-foreground">
          Target: {target} · {first.raw >= target ? "on track" : "behind"}
        </p>
      )}
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "analytics.card",
  name: "Analytics card",
  description: "Single metric + delta chip. The workhorse dashboard tile.",
  version: "1.0.0",
  blockType: "analytics-card",
  domain: "sales",
  supportedSizes: ["1x1", "2x1"],
  consumesMetrics: [
    "quote_requests",
    "callback_requests",
    "form_conversion_rate",
    "average_job_value",
    "review_score"
  ],
  consumesFacets: ["dashboard.kpiTargets"],
  renderer: AnalyticsCardRenderer,
  publisher: P
});

// ─── 2. statistics-big ────────────────────────────────────────
function StatisticsBigRenderer({
  metrics,
  title
}: DashboardBlockRendererProps) {
  const first = Object.values(metrics)[0];
  if (!first) return <Card><Muted>No data</Muted></Card>;
  return (
    <Card className="items-start">
      <Muted>{title ?? first.metricSlug.replace(/_/g, " ")}</Muted>
      <span className="text-5xl font-extrabold text-foreground tabular-nums">
        {first.formatted}
      </span>
      <div className="flex items-center gap-2">
        <DeltaChip delta={first.delta} />
        <span className="text-caption text-muted-foreground">
          {first.delta?.label}
        </span>
      </div>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "statistics.big",
  name: "Big statistic",
  description: "Oversized number + delta. Use for hero KPIs.",
  version: "1.0.0",
  blockType: "statistics-big",
  domain: "sales",
  supportedSizes: ["2x2", "2x1"],
  consumesMetrics: ["revenue_total", "jobs_completed", "average_job_value"],
  consumesFacets: [],
  renderer: StatisticsBigRenderer,
  publisher: P
});

// ─── 3-5. Charts (sparkline stand-ins) ────────────────────────
function ChartLineRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const first = Object.values(metrics)[0];
  return (
    <Card>
      <Muted>{title ?? "Trend"}</Muted>
      <div className="flex items-baseline gap-3">
        <span className="text-xl font-extrabold tabular-nums">
          {first?.formatted ?? "—"}
        </span>
        <DeltaChip delta={first?.delta} />
      </div>
      {/* Sparkline placeholder — chart library wired in M6 when Recharts
          ships. B6 shows the composition contract. */}
      <div className="mt-2 h-12 w-full rounded-md bg-gradient-to-tr from-primary/10 via-primary/30 to-primary/60" />
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "chart.line",
  name: "Line chart",
  description: "Time-series chart of one metric.",
  version: "1.0.0",
  blockType: "chart-line",
  domain: "sales",
  supportedSizes: ["2x1", "2x2", "4x1"],
  consumesMetrics: ["website_visitors", "seo_impressions", "quote_requests"],
  consumesFacets: [],
  renderer: ChartLineRenderer,
  publisher: P
});

function ChartBarRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const values = Object.values(metrics);
  return (
    <Card>
      <Muted>{title ?? "Breakdown"}</Muted>
      <ul className="flex flex-col gap-2">
        {values.slice(0, 5).map((v) => {
          const pct = Math.min(100, Math.max(2, v.raw % 100));
          return (
            <li key={v.metricSlug} className="flex items-center gap-2">
              <span className="w-32 truncate text-caption text-muted-foreground">
                {v.metricSlug.replace(/_/g, " ")}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 text-right text-caption font-bold tabular-nums">
                {v.formatted}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "chart.bar",
  name: "Bar chart",
  description: "Horizontal bar breakdown across metrics or categories.",
  version: "1.0.0",
  blockType: "chart-bar",
  domain: "sales",
  supportedSizes: ["2x2", "4x1"],
  consumesMetrics: ["quote_requests", "callback_requests", "reviews_this_month"],
  consumesFacets: [],
  renderer: ChartBarRenderer,
  publisher: P
});

function ChartDonutRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const first = Object.values(metrics)[0];
  const pct = Math.min(100, first?.raw ?? 0);
  return (
    <Card className="items-center">
      <Muted>{title ?? "Proportion"}</Muted>
      <div
        className="relative flex h-24 w-24 items-center justify-center rounded-full"
        style={{
          background: `conic-gradient(currentColor ${pct * 3.6}deg, #E5E7EB 0)`
        }}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-background">
          <span className="text-lg font-extrabold tabular-nums">
            {first?.formatted ?? "—"}
          </span>
        </div>
      </div>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "chart.donut",
  name: "Donut chart",
  description: "Percentage-driven donut for one conversion metric.",
  version: "1.0.0",
  blockType: "chart-donut",
  domain: "sales",
  supportedSizes: ["1x1", "2x1", "2x2"],
  consumesMetrics: [
    "form_conversion_rate",
    "booking_conversion_rate",
    "repeat_customer_rate"
  ],
  consumesFacets: [],
  renderer: ChartDonutRenderer,
  publisher: P
});

// ─── 6. table-data ────────────────────────────────────────────
function TableDataRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const values = Object.values(metrics);
  return (
    <Card>
      <Muted>{title ?? "Metrics table"}</Muted>
      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-caption">
          <thead className="bg-muted">
            <tr>
              <th className="px-3 py-1.5 text-left font-extrabold uppercase text-muted-foreground">Metric</th>
              <th className="px-3 py-1.5 text-right font-extrabold uppercase text-muted-foreground">Value</th>
              <th className="px-3 py-1.5 text-right font-extrabold uppercase text-muted-foreground">Δ</th>
            </tr>
          </thead>
          <tbody>
            {values.map((v) => (
              <tr key={v.metricSlug} className="border-t border-border">
                <td className="px-3 py-1.5 font-bold">{v.metricSlug.replace(/_/g, " ")}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{v.formatted}</td>
                <td className="px-3 py-1.5 text-right"><DeltaChip delta={v.delta} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "table.data",
  name: "Metrics table",
  description: "Compact table of many metrics.",
  version: "1.0.0",
  blockType: "table-data",
  domain: "sales",
  supportedSizes: ["4x1", "4x2"],
  consumesMetrics: [
    "quote_requests",
    "callback_requests",
    "form_conversion_rate",
    "average_job_value",
    "revenue_total"
  ],
  consumesFacets: [],
  renderer: TableDataRenderer,
  publisher: P
});

// ─── 7. crm-contact-list ──────────────────────────────────────
function ContactListRenderer({ title }: DashboardBlockRendererProps) {
  const sample = ["Sarah W.", "Mark T.", "Priya D.", "James F.", "Aoife K."];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Recent contacts"}</Muted>
        <UsersRound size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <ul className="divide-y divide-border">
        {sample.map((n, i) => (
          <li key={n} className="flex items-center justify-between py-1.5">
            <span className="text-body-sm font-bold">{n}</span>
            <span className="text-caption text-muted-foreground">
              {i < 2 ? "unread" : "read"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "crm.contact-list",
  name: "Contact list",
  description: "Recent customers + read state.",
  version: "1.0.0",
  blockType: "crm-contact-list",
  domain: "communication",
  supportedSizes: ["2x2", "4x1"],
  consumesMetrics: [],
  consumesFacets: [],
  renderer: ContactListRenderer,
  publisher: P
});

// ─── 8. orders-recent ─────────────────────────────────────────
function OrdersRecentRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const rev = metrics["revenue_total"];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Recent orders"}</Muted>
        <Briefcase size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <ul className="divide-y divide-border">
        {["#3821", "#3820", "#3819"].map((id) => (
          <li key={id} className="flex items-center justify-between py-1.5">
            <span className="text-body-sm font-bold">{id}</span>
            <span className="text-caption tabular-nums">
              £{Math.round((rev?.raw ?? 1000) / 3).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "orders.recent",
  name: "Recent orders",
  description: "Latest orders + values.",
  version: "1.0.0",
  blockType: "orders-recent",
  domain: "finance",
  supportedSizes: ["2x2", "4x1"],
  consumesMetrics: ["revenue_total"],
  consumesFacets: [],
  renderer: OrdersRecentRenderer,
  publisher: P
});

// ─── 9. jobs-pipeline ─────────────────────────────────────────
function JobsPipelineRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const stages = [
    { name: "Enquiry", count: metrics["quote_requests"]?.raw ?? 0 },
    { name: "Quoted", count: (metrics["quote_requests"]?.raw ?? 0) / 2 },
    { name: "Booked", count: (metrics["upcoming_bookings"]?.raw ?? 0) },
    { name: "Complete", count: metrics["jobs_completed"]?.raw ?? 0 }
  ];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Pipeline"}</Muted>
        <Filter size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <ul className="grid grid-cols-4 gap-2">
        {stages.map((s) => (
          <li
            key={s.name}
            className="rounded-md border border-border p-2 text-center"
          >
            <p className="text-caption font-extrabold uppercase text-muted-foreground">
              {s.name}
            </p>
            <p className="text-xl font-extrabold tabular-nums">
              {Math.round(s.count)}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "jobs.pipeline",
  name: "Jobs pipeline",
  description: "Enquiry → Quoted → Booked → Complete funnel.",
  version: "1.0.0",
  blockType: "jobs-pipeline",
  domain: "operations",
  supportedSizes: ["4x1", "4x2"],
  consumesMetrics: [
    "quote_requests",
    "upcoming_bookings",
    "jobs_completed"
  ],
  consumesFacets: [],
  renderer: JobsPipelineRenderer,
  publisher: P
});

// ─── 10. messages-inbox ───────────────────────────────────────
function MessagesInboxRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const unread = metrics["unread_messages"];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Inbox"}</Muted>
        <MessageSquare size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">
          {unread?.formatted ?? "0"}
        </span>
        <span className="text-caption text-muted-foreground">
          unread messages
        </span>
      </div>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "messages.inbox",
  name: "Inbox",
  description: "Unread customer messages.",
  version: "1.0.0",
  blockType: "messages-inbox",
  domain: "communication",
  supportedSizes: ["1x1", "2x1"],
  consumesMetrics: ["unread_messages"],
  consumesFacets: [],
  renderer: MessagesInboxRenderer,
  publisher: P
});

// ─── 11. calendar-week ────────────────────────────────────────
function CalendarWeekRenderer({ metrics, title }: DashboardBlockRendererProps) {
  const bookings = metrics["upcoming_bookings"];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "This week"}</Muted>
        <Calendar size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold tabular-nums">
          {bookings?.formatted ?? "0"}
        </span>
        <span className="text-caption text-muted-foreground">
          bookings scheduled
        </span>
      </div>
      <div className="mt-2 grid grid-cols-7 gap-1">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div
            key={d + i}
            className={
              "flex h-8 items-center justify-center rounded-md text-caption font-bold " +
              (i % 3 === 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground")
            }
          >
            {d}
          </div>
        ))}
      </div>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "calendar.week",
  name: "Calendar week",
  description: "Week ahead + booking count.",
  version: "1.0.0",
  blockType: "calendar-week",
  domain: "operations",
  supportedSizes: ["2x1", "2x2", "4x1"],
  consumesMetrics: ["upcoming_bookings"],
  consumesFacets: [],
  renderer: CalendarWeekRenderer,
  publisher: P
});

// ─── 12. suggested-action (new — user's dashboard vision) ─────
function SuggestedActionRenderer({ title }: DashboardBlockRendererProps) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <Sparkles
          size={14}
          strokeWidth={2.5}
          className="text-primary"
          aria-hidden
        />
        <Muted>{title ?? "Suggested action"}</Muted>
      </div>
      <p className="text-body-sm font-bold text-foreground">
        Launch your Fire Doors campaign — top 3 towns have unmet demand.
      </p>
      <button
        type="button"
        className="mt-2 inline-flex w-fit items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-caption font-extrabold text-primary-foreground"
      >
        Start campaign
      </button>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "actions.suggested",
  name: "Suggested action",
  description:
    "Actionable recommendation surfaced by dashboard.suggestedActions facet.",
  version: "1.0.0",
  blockType: "suggested-action",
  domain: "actions",
  supportedSizes: ["2x1", "2x2"],
  consumesMetrics: ["projects_needing_photos", "top_town_leads"],
  consumesFacets: ["dashboard.suggestedActions"],
  renderer: SuggestedActionRenderer,
  publisher: P
});

// ─── 13. activity-feed ────────────────────────────────────────
function ActivityFeedRenderer({ title }: DashboardBlockRendererProps) {
  const items = [
    { at: "2m", text: "New quote request · Sarah W." },
    { at: "1h", text: "Booking confirmed for tomorrow 09:00" },
    { at: "3h", text: "Review received · 5★" },
    { at: "1d", text: "Invoice paid · £2,400" }
  ];
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Activity"}</Muted>
        <Bell size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 py-1.5">
            <span className="mt-1 text-caption text-muted-foreground">{it.at}</span>
            <span className="text-body-sm">{it.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "activity.feed",
  name: "Activity feed",
  description: "Recent platform events.",
  version: "1.0.0",
  blockType: "activity-feed",
  domain: "operations",
  supportedSizes: ["2x2", "4x1"],
  consumesMetrics: [],
  consumesFacets: [],
  renderer: ActivityFeedRenderer,
  publisher: P
});

// ─── 14. notifications-center ─────────────────────────────────
function NotificationsRenderer({ title }: DashboardBlockRendererProps) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <Muted>{title ?? "Notifications"}</Muted>
        <ClipboardList size={16} strokeWidth={2.25} className="opacity-60" />
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {[
          "3 new quote requests need a response",
          "1 booking pending deposit",
          "2 projects need before/after photos"
        ].map((n, i) => (
          <li key={i} className="py-1.5 text-body-sm">
            <span className="font-extrabold text-primary">•</span> {n}
          </li>
        ))}
      </ul>
    </Card>
  );
}
dashboardBlockRegistry.register({
  manifestVersion: 1,
  slug: "notifications.center",
  name: "Notifications center",
  description: "Prioritised platform notifications.",
  version: "1.0.0",
  blockType: "notifications-center",
  domain: "operations",
  supportedSizes: ["2x1", "2x2"],
  consumesMetrics: ["projects_needing_photos", "unread_messages"],
  consumesFacets: [],
  renderer: NotificationsRenderer,
  publisher: P
});
