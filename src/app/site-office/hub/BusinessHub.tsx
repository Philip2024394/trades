// Business Hub — runway ribbon + coach + pipeline slice + money.

"use client";

import Link from "next/link";
import {
  Sparkles,
  FileText,
  Send,
  Eye,
  ClipboardCheck,
  Bell,
  MessageCircle,
  Star,
  ArrowRight,
  Flame,
  Zap,
  Wand2,
  TrendingUp,
  Users,
  CheckCircle2,
  ExternalLink,
  Clock
} from "lucide-react";
import { SurfaceCard } from "@/platform/ui";
import type {
  ActivePipelineItem,
  BusinessHubSnapshot
} from "@/lib/business-hub/aggregator";
import type { CoachRecommendation } from "@/lib/business-hub/coach";

function gbp(pence: number): string {
  if (pence === 0) return "£0";
  if (pence < 100_000) return `£${(pence / 100).toFixed(0)}`;
  return `£${Math.round(pence / 100_000).toLocaleString()}k`;
}

const RUNWAY_COLOR: Record<string, string> = {
  urgent: "bg-red-100 text-red-800 border-red-200",
  warm: "bg-amber-100 text-amber-900 border-amber-200",
  cool: "bg-neutral-100 text-neutral-800 border-neutral-200"
};

const KIND_ICON: Record<
  ActivePipelineItem["kind"],
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  render: Sparkles,
  quote: FileText,
  job: ClipboardCheck,
  task: Bell
};

const URGENCY_TINT: Record<ActivePipelineItem["urgency"], string> = {
  hot: "bg-red-100 text-red-800",
  warm: "bg-amber-100 text-amber-900",
  cool: "bg-neutral-100 text-neutral-800"
};

const URGENCY_ICON: Record<
  ActivePipelineItem["urgency"],
  React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
> = {
  hot: Flame,
  warm: Zap,
  cool: Clock
};

const SEVERITY_TINT: Record<
  CoachRecommendation["severity"],
  "danger" | "warning" | "info" | "success"
> = {
  urgent: "danger",
  high: "warning",
  moderate: "info",
  growth: "success"
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Late one";
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export function BusinessHub({
  merchantName,
  primaryTrade,
  city,
  snapshot,
  recommendations
}: {
  merchantName: string;
  primaryTrade: string | null;
  city: string | null;
  snapshot: BusinessHubSnapshot;
  recommendations: CoachRecommendation[];
}) {
  const c = snapshot.counters;
  const money = snapshot.money;

  const runway = [
    {
      key: "unquoted",
      label: "Ready to quote",
      value: c.unquotedLeads,
      severity: c.unquotedLeads > 0 ? "warm" : "cool",
      icon: Sparkles,
      href: "/site-office/apps/quote-workspace"
    },
    {
      key: "expiring",
      label: "Expiring soon",
      value: c.quotesExpiringSoon,
      severity: c.quotesExpiringSoon > 0 ? "urgent" : "cool",
      icon: Clock,
      href: "/site-office/apps/quote-workspace"
    },
    {
      key: "viewed",
      label: "Viewed by customer",
      value: c.quotesViewedNotAccepted,
      severity: c.quotesViewedNotAccepted > 0 ? "warm" : "cool",
      icon: Eye,
      href: "/site-office/apps/quote-workspace"
    },
    {
      key: "active-jobs",
      label: "Active jobs",
      value: c.activeJobs,
      severity: "cool",
      icon: ClipboardCheck,
      href: "/site-office/apps/job-diary"
    },
    {
      key: "followups",
      label: "Follow-ups due",
      value: c.followUpsOverdue + c.followUpsDueToday,
      severity:
        c.followUpsOverdue > 0
          ? "urgent"
          : c.followUpsDueToday > 0
            ? "warm"
            : "cool",
      icon: Bell,
      href: "/site-office/apps/crm"
    }
  ] as const;

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6">
      <header className="mb-6">
        <p className="text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          {greeting()}, {merchantName}
        </p>
        <h1 className="mt-1 text-2xl font-bold md:text-3xl">Today's runway</h1>
        <p className="mt-1 text-[13px] text-neutral-600">
          {primaryTrade
            ? `${primaryTrade.replace(/-/g, " ")}${city ? ` · ${city}` : ""}`
            : city}
        </p>
      </header>

      {/* RUNWAY RIBBON */}
      <section className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-5">
        {runway.map((r) => {
          const Icon = r.icon;
          return (
            <Link
              key={r.key}
              href={r.href}
              className={`flex items-start justify-between rounded-xl border p-3 transition hover:border-neutral-400 ${
                RUNWAY_COLOR[r.severity] || RUNWAY_COLOR.cool
              }`}
            >
              <div>
                <div className="text-[13px] font-semibold uppercase tracking-wide opacity-80">
                  {r.label}
                </div>
                <div className="mt-1 text-2xl font-bold">{r.value}</div>
              </div>
              <Icon className="h-4 w-4 opacity-70" aria-hidden />
            </Link>
          );
        })}
      </section>

      {/* COACH */}
      {recommendations.length > 0 ? (
        <section className="mb-6">
          <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            <Wand2 className="h-3.5 w-3.5" aria-hidden />
            Coach says
          </h2>
          <div className="space-y-3">
            {recommendations.map((rec) => (
              <SurfaceCard
                key={rec.id}
                variant={SEVERITY_TINT[rec.severity]}
                padding="md"
              >
                <div className="text-[13px] font-semibold uppercase tracking-wide opacity-80 capitalize">
                  {rec.severity}
                </div>
                <div className="mt-1 text-[15px] font-semibold">
                  {rec.title}
                </div>
                <p className="mt-1 text-[13px]">{rec.evidence}</p>
                <Link
                  href={rec.actionHref}
                  className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg bg-neutral-900 px-3 text-[13px] font-semibold text-white hover:bg-neutral-800"
                >
                  {rec.actionLabel}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </SurfaceCard>
            ))}
          </div>
        </section>
      ) : null}

      {/* PIPELINE + MONEY GRID */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
            What needs you now
          </h2>
          {snapshot.activePipeline.length === 0 ? (
            <SurfaceCard variant="secondary" padding="md">
              <p className="text-[13px] text-neutral-600">
                Nothing pressing. When leads land or a job needs attention
                they'll show up here.
              </p>
            </SurfaceCard>
          ) : (
            <ul className="space-y-2">
              {snapshot.activePipeline.map((item) => {
                const Icon = KIND_ICON[item.kind];
                const UrgencyIcon = URGENCY_ICON[item.urgency];
                return (
                  <li key={`${item.kind}-${item.id}`}>
                    <Link href={item.href}>
                      <SurfaceCard variant="primary" padding="md" interactive>
                        <div className="flex items-start gap-3">
                          <div
                            className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                              URGENCY_TINT[item.urgency]
                            }`}
                          >
                            <Icon className="h-4 w-4" aria-hidden />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <div className="text-[14px] font-semibold text-neutral-900">
                                {item.headline}
                              </div>
                              <UrgencyIcon
                                className={`h-3.5 w-3.5 shrink-0 ${
                                  item.urgency === "hot"
                                    ? "text-red-500"
                                    : item.urgency === "warm"
                                      ? "text-amber-500"
                                      : "text-neutral-400"
                                }`}
                                aria-hidden
                              />
                            </div>
                            {item.meta ? (
                              <div className="mt-0.5 text-[13px] text-neutral-500">
                                {item.meta}
                              </div>
                            ) : null}
                          </div>
                          <ExternalLink
                            className="h-3.5 w-3.5 shrink-0 text-neutral-400"
                            aria-hidden
                          />
                        </div>
                      </SurfaceCard>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-3">
          <SurfaceCard variant="dark" padding="md">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-white/60">
              <TrendingUp className="h-3.5 w-3.5" aria-hidden />
              This month
            </div>
            <div className="mt-2 text-3xl font-bold text-white">
              {gbp(money.bookedThisMonthPence)}
            </div>
            <div className="text-[13px] text-white/70">
              booked · vs {gbp(money.bookedLastMonthPence)} last month
            </div>
            <hr className="my-3 border-white/10" />
            <dl className="space-y-1 text-[13px] text-white/80">
              <div className="flex justify-between">
                <dt>Sent this week</dt>
                <dd>{money.quotesSentThisWeek}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Accepted this week</dt>
                <dd>{money.quotesAcceptedThisWeek}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Open pipeline</dt>
                <dd>{gbp(money.pipelineOpenPence)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Accepted pipeline</dt>
                <dd>{gbp(money.pipelineAcceptedPence)}</dd>
              </div>
              {snapshot.overallResponseHours != null ? (
                <div className="flex justify-between">
                  <dt>Avg quote response</dt>
                  <dd>{snapshot.overallResponseHours}h</dd>
                </div>
              ) : null}
            </dl>
          </SurfaceCard>

          <SurfaceCard variant="primary" padding="md">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Reputation
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-[13px]">
              <div>
                <div className="text-neutral-500">Reviews to respond</div>
                <div className="text-lg font-bold">{c.reviewsNoResponse}</div>
              </div>
              <div>
                <div className="text-neutral-500">New this month</div>
                <div className="text-lg font-bold">
                  {c.newVerifiedReviewsThisMonth}
                </div>
              </div>
            </div>
            <Link
              href="/site-office/apps/reviews"
              className="mt-3 inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-[13px] font-semibold text-neutral-700 hover:border-neutral-400"
            >
              Open reviews
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </SurfaceCard>

          <SurfaceCard variant="primary" padding="md">
            <div className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
              <ClipboardCheck className="h-3.5 w-3.5" aria-hidden />
              Signed off this week
            </div>
            <div className="mt-1 text-2xl font-bold">{c.jobsSignedOffThisWeek}</div>
          </SurfaceCard>
        </aside>
      </div>

      {/* QUICK ACTIONS */}
      <section className="mt-6">
        <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide text-neutral-500">
          Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <QuickAction
            href="/site-office/apps/quote-workspace"
            icon={FileText}
            label="Quote Workspace"
          />
          <QuickAction
            href="/site-office/apps/job-diary"
            icon={ClipboardCheck}
            label="Job Diary"
          />
          <QuickAction
            href="/site-office/apps/crm"
            icon={Users}
            label="Contacts"
          />
          <QuickAction
            href="/site-office/apps/reviews"
            icon={Star}
            label="Reviews"
          />
        </div>
      </section>
    </div>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label
}: {
  href: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[64px] items-center gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-[13px] font-semibold text-neutral-800 transition hover:border-neutral-400"
    >
      <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-neutral-100">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      {label}
    </Link>
  );
}
