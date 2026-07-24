// Projects adapter — reads hammerex_xrated_projects.
//
// KPIs:
//   • projects_running    — status = live and not completed
//   • projects_completed  — completed within the lookback window
//   • cycle_time_days     — median days from started_at → completed_at
//                          for projects completed in the lookback
// Sub-score:
//   Weighted mix of "activity" (at least one project running) and
//   "throughput" (completions this month vs prior month).

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { BIAdapter, DomainMetrics, Observation } from "../types";
import { evidenceFor } from "../types";
import { scoreMetric } from "../health";
import { pctChange, resolveListingId, windows } from "./_shared";

export const projectsAdapter: BIAdapter = {
  domain: "projects",
  label:  "Projects",
  weight: 1.5,

  async run(ctx) {
    const now = ctx.now ?? new Date();
    const listingId = await resolveListingId(ctx.merchantSlug);
    if (!listingId) return emptyMetrics(ctx.merchantSlug, "listing not found");

    const w = windows(ctx.lookbackDays, now);

    // Running (open) projects — snapshot count, ignores window.
    const running = await supabaseAdmin
      .from("hammerex_xrated_projects")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .eq("status", "live")
      .is("completed_at", null);

    // Completed within the current + prior windows.
    const completedNow = await supabaseAdmin
      .from("hammerex_xrated_projects")
      .select("started_at, completed_at", { count: "exact" })
      .eq("listing_id", listingId)
      .not("completed_at", "is", null)
      .gte("completed_at", w.currentStart)
      .lte("completed_at", w.currentEnd);

    const completedPrior = await supabaseAdmin
      .from("hammerex_xrated_projects")
      .select("id", { count: "exact", head: true })
      .eq("listing_id", listingId)
      .not("completed_at", "is", null)
      .gte("completed_at", w.priorStart)
      .lte("completed_at", w.priorEnd);

    const runningCount   = running.count ?? 0;
    const completedCount = completedNow.count ?? 0;
    const priorCount     = completedPrior.count ?? 0;

    const cycleDays = medianCycleDays(completedNow.data ?? []);

    const activityScore   = runningCount > 0 ? 100 : 40;
    const throughputScore = scoreMetric(completedCount, { floor: 0, ceiling: 5, direction: "higher_is_better" });
    const cycleScore      = cycleDays === null ? 60 : scoreMetric(cycleDays, { floor: 60, ceiling: 7, direction: "lower_is_better" });
    const subScore        = Math.round((activityScore + throughputScore + cycleScore) / 3);

    const evidence = evidenceFor("hammerex_xrated_projects", ["hammerex_xrated_projects"], "/nex?prompt=Show%20my%20current%20projects");

    const observations: Observation[] = [];
    if (runningCount === 0) {
      observations.push({
        key:      "projects_none_running",
        domain:   "projects",
        severity: "notice",
        headline: "No projects are showing as live right now.",
        detail:   "If you're on site today, adding the project to your Trade OS makes it visible to homeowners looking in your area.",
        action:   { label: "Add a project", href: "/studio/projects" },
        evidence
      });
    }
    const change = pctChange(completedCount, priorCount);
    if (change !== null && change >= 20) {
      observations.push({
        key:      "projects_throughput_up",
        domain:   "projects",
        severity: "info",
        headline: `Project completions are up ${change}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    } else if (change !== null && change <= -25) {
      observations.push({
        key:      "projects_throughput_down",
        domain:   "projects",
        severity: "warning",
        headline: `Project completions have dropped ${Math.abs(change)}% versus the previous ${ctx.lookbackDays} days.`,
        evidence
      });
    }

    return {
      domain: "projects",
      label:  "Projects",
      sub_score: subScore,
      weight:    1.5,
      metrics: [
        { key: "projects_running",   label: "Projects live",     value: runningCount,   unit: "count", direction: "higher_is_better", evidence },
        { key: "projects_completed", label: "Projects completed", value: completedCount, prior: priorCount, unit: "count", direction: "higher_is_better", evidence },
        { key: "cycle_time_days",    label: "Median cycle time",  value: cycleDays,      unit: "days",  direction: "lower_is_better", evidence }
      ],
      observations
    };
  }
};

function medianCycleDays(rows: Array<{ started_at: string | null; completed_at: string | null }>): number | null {
  const days = rows
    .map((r) => {
      if (!r.started_at || !r.completed_at) return null;
      const ms = new Date(r.completed_at).getTime() - new Date(r.started_at).getTime();
      return ms > 0 ? ms / 86_400_000 : null;
    })
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b);
  if (days.length === 0) return null;
  const mid = Math.floor(days.length / 2);
  const median = days.length % 2 === 1 ? days[mid] : (days[mid - 1] + days[mid]) / 2;
  return Number(median.toFixed(1));
}

function emptyMetrics(slug: string, reason: string): DomainMetrics {
  return {
    domain:       "projects",
    label:        "Projects",
    sub_score:    null,
    weight:       1.5,
    metrics:      [],
    observations: [],
    error:        `projects adapter: ${reason} (${slug})`
  };
}
