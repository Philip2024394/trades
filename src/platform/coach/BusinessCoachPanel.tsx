// BusinessCoachPanel — merchant-facing scorecard + backlog.
//
// Left: transparent per-dimension scorecard. Every score shows the
// reason and can be expanded to see which recommendations fired.
// Right: prioritised backlog. Every item has priority stars, impact
// badge, "Fix Now" button (when autoFix is available), and "Why?"
// disclosure.
//
// Zero dependencies beyond lucide-react + Tailwind.

"use client";

import {
  BadgeCheck,
  BookOpen,
  Calendar,
  CalendarClock,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Compass,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  Wand2,
  Zap
} from "lucide-react";
import { useMemo, useState } from "react";
import { assess, backlog, DIMENSION_LABEL } from "./BusinessCoach";
import type {
  BacklogItem,
  BacklogTimeframe,
  BusinessHealthScore,
  CoachBacklog,
  CoachContext,
  HealthDimension,
  ImpactBand
} from "./types";

const DIMENSION_ICON: Record<HealthDimension, typeof Compass> = {
  "strategy-alignment": Compass,
  trust: BadgeCheck,
  "local-seo": MapPin,
  portfolio: Camera,
  conversion: Zap,
  "content-quality": BookOpen
};

const IMPACT_STYLES: Record<ImpactBand, { badge: string; label: string }> = {
  high: { badge: "bg-red-100 text-red-800", label: "High impact" },
  medium: { badge: "bg-amber-100 text-amber-800", label: "Medium impact" },
  low: { badge: "bg-neutral-100 text-neutral-700", label: "Low impact" }
};

function scoreClass(score: number): string {
  if (score >= 85) return "text-emerald-700";
  if (score >= 70) return "text-blue-700";
  if (score >= 50) return "text-amber-700";
  return "text-red-700";
}

function scoreBar(score: number): string {
  if (score >= 85) return "bg-emerald-500";
  if (score >= 70) return "bg-blue-500";
  if (score >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export type BusinessCoachPanelProps = {
  context: CoachContext;
  /** Optional handler when a "Fix Now" button is clicked. Receives
   *  the recommendation slug + optional autoFix handler slug. */
  onFixNow?: (input: { recommendationSlug: string; handler?: string }) => void;
  /** Optional title override. */
  title?: string;
};

export function BusinessCoachPanel({
  context,
  onFixNow,
  title = "Your Business Coach"
}: BusinessCoachPanelProps) {
  const score = useMemo<BusinessHealthScore>(() => assess(context), [context]);
  const list = useMemo<CoachBacklog>(() => backlog(context), [context]);
  const [expandedDim, setExpandedDim] = useState<HealthDimension | null>(null);

  return (
    <section className="mx-auto w-full max-w-4xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
      <header className="mb-4 flex flex-col gap-1">
        <div className="flex items-center gap-2 text-[13px] text-neutral-500">
          <Wand2 className="h-4 w-4" />
          Business Operating Coach
        </div>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          <div className="flex items-baseline gap-2">
            <span className={`text-3xl font-bold ${scoreClass(score.overall)}`}>
              {score.overall}
            </span>
            <span className="text-[13px] text-neutral-500">/ 100</span>
          </div>
        </div>
        <p className="text-[13px] text-neutral-600">
          Growth goal:{" "}
          <strong className="text-neutral-900">
            {score.strategySnapshot.goal.replace(/-/g, " ")}
          </strong>{" "}
          · Recipe:{" "}
          <em className="text-neutral-700">{score.strategySnapshot.recipeSlug}</em>
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* ── SCORECARD ─────────────────────────────────────── */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-neutral-900">
            Health scorecard
          </h3>
          <ul className="flex flex-col gap-2">
            {score.dimensions.map((entry) => {
              const Icon = DIMENSION_ICON[entry.dimension];
              const expanded = expandedDim === entry.dimension;
              return (
                <li
                  key={entry.dimension}
                  className="overflow-hidden rounded-xl border border-neutral-200"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedDim(expanded ? null : entry.dimension)
                    }
                    className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-neutral-50"
                  >
                    <Icon className="h-4 w-4 text-neutral-500" />
                    <span className="flex-1 text-[13px] font-medium text-neutral-900">
                      {DIMENSION_LABEL[entry.dimension]}
                    </span>
                    <span
                      className={`text-[13px] font-bold ${scoreClass(
                        entry.score
                      )}`}
                    >
                      {entry.score}
                    </span>
                  </button>
                  <div className="h-1 bg-neutral-100">
                    <div
                      className={`h-full ${scoreBar(entry.score)}`}
                      style={{ width: `${entry.score}%` }}
                    />
                  </div>
                  {expanded ? (
                    <div className="border-t border-neutral-200 bg-neutral-50/60 px-3 py-2 text-[12px] text-neutral-700">
                      <div>{entry.reasoning}</div>
                      {entry.triggeredRecommendations.length ? (
                        <div className="mt-1 text-neutral-500">
                          Firing: {entry.triggeredRecommendations.join(", ")}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {/* ── BACKLOG ───────────────────────────────────────── */}
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-neutral-900">
            Your plan — {list.items.length} action
            {list.items.length === 1 ? "" : "s"}
          </h3>
          {list.items.length ? (
            <TimeframeGroups items={list.items} onFixNow={onFixNow} />
          ) : (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] text-emerald-900">
              <Sparkles className="mb-1 h-4 w-4" />
              No open actions — your site is well aligned with your growth
              strategy. Come back after your next quarterly review.
            </div>
          )}
        </div>
      </div>

      <footer className="mt-6 border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
        Assessed {new Date(score.generatedAt).toLocaleString()}. Every score
        traces to the recommendations that fired — click a dimension to see
        which.
      </footer>
    </section>
  );
}

function BacklogRow({
  item,
  onFixNow
}: {
  item: BacklogItem;
  onFixNow?: BusinessCoachPanelProps["onFixNow"];
}) {
  const [expanded, setExpanded] = useState(false);
  const impactStyle = IMPACT_STYLES[item.estimatedImpact];
  return (
    <li className="overflow-hidden rounded-xl border border-neutral-200">
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex shrink-0 items-center gap-0.5" aria-label={`Priority ${item.priority} of 5`}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Star
              key={i}
              className={`h-3 w-3 ${
                i < item.priority
                  ? "fill-amber-400 text-amber-400"
                  : "text-neutral-300"
              }`}
            />
          ))}
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-neutral-900">
              {item.title}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${impactStyle.badge}`}
            >
              {impactStyle.label}
            </span>
          </div>
          <div className="mt-0.5 text-[12px] text-neutral-700">{item.detail}</div>
          {item.expectedImpactHeadline ? (
            <div className="mt-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] text-emerald-900">
              <TrendingUp className="mr-1 inline h-3 w-3" />
              <strong>Expected impact:</strong> {item.expectedImpactHeadline}
              {item.expectedImpactSource ? (
                <span className="ml-1 text-emerald-700/70">
                  · {item.expectedImpactSource}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-neutral-500 underline-offset-2 hover:text-neutral-900 hover:underline"
            >
              {expanded ? "Hide why" : "Why?"}
            </button>
            {item.autoFix ? (
              <button
                type="button"
                onClick={() =>
                  onFixNow?.({
                    recommendationSlug: item.recommendationSlug,
                    handler: item.autoFix?.handler
                  })
                }
                className="inline-flex items-center gap-1 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-neutral-800"
              >
                <ClipboardCheck className="h-3 w-3" /> {item.actionLabel}
              </button>
            ) : (
              <span className="text-neutral-400">Manual action</span>
            )}
          </div>
          {expanded ? (
            <div className="mt-2 rounded-lg bg-neutral-50 p-2 text-[11px] leading-relaxed text-neutral-700">
              <div>
                <strong>Why it matters:</strong> {item.whyItMatters}
              </div>
              <div className="mt-1">
                <strong>Expected outcome:</strong> {item.expectedOutcome}
              </div>
              {item.citedPlaybooks.length ? (
                <div className="mt-1 text-neutral-500">
                  Playbook{item.citedPlaybooks.length === 1 ? "" : "s"}: {item.citedPlaybooks.join(", ")}
                </div>
              ) : null}
              {item.citedEvidence.length ? (
                <div className="text-neutral-500">
                  Evidence: {item.citedEvidence.join(", ")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}

const TIMEFRAME_ORDER: readonly BacklogTimeframe[] = [
  "this-week",
  "this-month",
  "this-quarter"
];

const TIMEFRAME_META: Record<BacklogTimeframe, { label: string; icon: typeof Calendar }> = {
  "this-week": { label: "This week", icon: CalendarClock },
  "this-month": { label: "This month", icon: Calendar },
  "this-quarter": { label: "This quarter", icon: CalendarDays }
};

function TimeframeGroups({
  items,
  onFixNow
}: {
  items: readonly BacklogItem[];
  onFixNow?: BusinessCoachPanelProps["onFixNow"];
}) {
  const byTimeframe: Record<BacklogTimeframe, BacklogItem[]> = {
    "this-week": [],
    "this-month": [],
    "this-quarter": []
  };
  for (const item of items) byTimeframe[item.timeframe].push(item);

  return (
    <div className="flex flex-col gap-4">
      {TIMEFRAME_ORDER.map((tf) => {
        const bucket = byTimeframe[tf];
        if (!bucket.length) return null;
        const meta = TIMEFRAME_META[tf];
        const Icon = meta.icon;
        return (
          <div key={tf}>
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
              <Icon className="h-3 w-3" />
              {meta.label} · {bucket.length} action{bucket.length === 1 ? "" : "s"}
            </div>
            <ul className="flex flex-col gap-2">
              {bucket.map((item) => (
                <BacklogRow key={item.recommendationSlug} item={item} onFixNow={onFixNow} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
