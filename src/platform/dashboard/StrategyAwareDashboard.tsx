// StrategyAwareDashboard — the "what to pay attention to today" shell.
//
// Takes a ResolvedStrategy, reads dashboard.primaryMetrics + blockOrder
// + kpiTargets + suggestedActions, and renders exactly the tiles this
// specific business should see. Every carpenter sees a different
// dashboard even though the framework is identical.

"use client";

import * as React from "react";
import { mockValueFor, metricRegistry } from "@/platform/metrics";
import type { MetricValue } from "@/platform/metrics";
import { dashboardBlockRegistry } from "./registry";
import type { ResolvedStrategy } from "@/platform/business";

type Props = {
  strategy?: ResolvedStrategy;
  /** Live metric values keyed by slug. Falls back to mock values in dev. */
  metricValues?: Readonly<Record<string, MetricValue>>;
  /** Optional trade + goal used when no strategy is passed. */
  fallback?: { trade?: string; goals?: readonly string[] };
  className?: string;
};

function readFacet<T>(
  strategy: ResolvedStrategy | undefined,
  domain: string,
  field: string
): T | undefined {
  return strategy?.get(domain, field) as T | undefined;
}

export function StrategyAwareDashboard({
  strategy,
  metricValues,
  fallback,
  className
}: Props) {
  // 1. Determine primary metrics for THIS business.
  const primaryMetricsFacet = readFacet<{ list?: string[] }>(
    strategy,
    "dashboard",
    "primaryMetrics"
  );
  let primaryMetricSlugs = primaryMetricsFacet?.list ?? [];

  if (primaryMetricSlugs.length === 0) {
    // Fall back to metricRegistry.rank() over the profile's trade/goals.
    const trade = strategy?.inputs.profile.trade ?? fallback?.trade;
    const goals =
      strategy?.inputs.strategy
        ? [strategy.inputs.strategy.currentGoal]
        : (fallback?.goals ?? []);
    primaryMetricSlugs = metricRegistry
      .rank({ trade, goals, limit: 8 })
      .map((m) => m.slug);
  }

  // 2. Materialise metric values (real or mock).
  const values: Record<string, MetricValue> = {};
  for (const slug of primaryMetricSlugs) {
    values[slug] = metricValues?.[slug] ?? mockValueFor(slug);
  }

  // 3. Determine block order — strategy-declared or ranked.
  const blockOrderFacet = readFacet<{ list?: string[] }>(
    strategy,
    "dashboard",
    "blockOrder"
  );
  let blockSlugs = blockOrderFacet?.list ?? [];
  if (blockSlugs.length === 0) {
    blockSlugs = dashboardBlockRegistry
      .rank({ metrics: primaryMetricSlugs })
      .slice(0, 8)
      .map((b) => b.slug);
    // Always append the suggested-action card if not already present.
    if (
      !blockSlugs.includes("actions.suggested") &&
      dashboardBlockRegistry.has("actions.suggested")
    ) {
      blockSlugs.push("actions.suggested");
    }
  }

  // 4. KPI targets from facet.
  const kpiTargetsFacet = readFacet<{ targets?: Record<string, number> }>(
    strategy,
    "dashboard",
    "kpiTargets"
  );
  const kpiTargets = kpiTargetsFacet?.targets ?? {};

  return (
    <div
      className={
        "grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 " + (className ?? "")
      }
    >
      {blockSlugs.map((slug) => {
        const block = dashboardBlockRegistry.get(slug);
        if (!block) return null;
        // Metric subset for this block.
        const scoped: Record<string, MetricValue> = {};
        for (const m of block.consumesMetrics) {
          if (values[m]) scoped[m] = values[m];
        }
        const size = block.supportedSizes[0];
        const colSpan = sizeToColSpan(size);
        const Renderer = block.renderer;
        return (
          <div key={slug} className={colSpan}>
            <Renderer
              metrics={scoped}
              size={size}
              kpiTargets={kpiTargets}
              title={block.name}
            />
          </div>
        );
      })}
    </div>
  );
}

function sizeToColSpan(size: string): string {
  // 4-column grid → map (cols × rows) → tailwind col-span classes.
  const cols = Number(size.split("x")[0]);
  switch (cols) {
    case 1:
      return "col-span-1";
    case 2:
      return "col-span-1 md:col-span-2";
    case 3:
      return "col-span-1 md:col-span-2 lg:col-span-3";
    case 4:
      return "col-span-1 md:col-span-2 lg:col-span-4";
    default:
      return "col-span-1";
  }
}
