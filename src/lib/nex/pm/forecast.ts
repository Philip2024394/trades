// Completion forecasting — honest version.
//
// Data we can use:
//   • progress_percent (from app_job_diary_jobs — snapshot value)
//   • actual_start_date (also from job diary)
//   • scheduled_end_date (also from job diary)
//
// Velocity = progress_percent / days_since_start.
// Forecast_end = now + (100 - progress_percent) / velocity days.
//
// Confidence rules (never over-promise):
//   • high   — progress ≥ 25%, actual_start_date present, ≥14 days on site
//   • medium — progress ≥ 10%, actual_start_date present
//   • low    — progress > 0
//   • unknown — no progress OR no start date → null forecast

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type CompletionForecast } from "./types";

const DAY_MS = 86_400_000;

export type ForecastInput = {
  projectId:         string;
  merchantId:        string;
  now?:              Date;
};

export async function forecastCompletion(opts: ForecastInput): Promise<CompletionForecast> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor("app_job_diary_jobs (progress + actual_start_date)", ["app_job_diary_jobs"]);

  // Freshest merchant-owned job for this project.
  const job = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("title, status, scheduled_end_date, actual_start_date, actual_end_date, progress_percent")
    .eq("merchant_id", opts.merchantId)
    .eq("project_id", opts.projectId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const j = job.data;
  const title  = String(j?.title ?? "(untitled project)");
  const sched  = (j?.scheduled_end_date as string | null) ?? null;
  const start  = (j?.actual_start_date as string | null) ?? null;
  const prog   = typeof j?.progress_percent === "number" ? Number(j.progress_percent) : null;

  // Already completed?
  if (j?.actual_end_date) {
    return {
      project_id:           opts.projectId,
      title,
      scheduled_end:        sched,
      progress_percent:     100,
      velocity_pct_per_day: null,
      forecast_end:         String(j.actual_end_date),
      confidence:           "high",
      reason:               `Marked complete on ${String(j.actual_end_date).slice(0, 10)}.`,
      evidence
    };
  }

  if (!start || prog === null || prog <= 0) {
    return {
      project_id:           opts.projectId,
      title,
      scheduled_end:        sched,
      progress_percent:     prog,
      velocity_pct_per_day: null,
      forecast_end:         null,
      confidence:           "unknown",
      reason:               !start
        ? "Cannot forecast — no actual start date on the job diary."
        : "Cannot forecast — no measurable progress on the job diary yet.",
      evidence
    };
  }

  const daysSinceStart = Math.max(1, Math.round((now.getTime() - new Date(start).getTime()) / DAY_MS));
  const velocity = prog / daysSinceStart;   // % per day
  if (velocity <= 0) {
    return {
      project_id:           opts.projectId,
      title,
      scheduled_end:        sched,
      progress_percent:     prog,
      velocity_pct_per_day: 0,
      forecast_end:         null,
      confidence:           "unknown",
      reason:               "Cannot forecast — progress hasn't advanced since the start date.",
      evidence
    };
  }

  const remainingPct = 100 - prog;
  const daysToFinish = Math.ceil(remainingPct / velocity);
  const forecastEnd  = new Date(now.getTime() + daysToFinish * DAY_MS).toISOString().slice(0, 10);

  const confidence: CompletionForecast["confidence"] =
    prog >= 25 && daysSinceStart >= 14 ? "high"   :
    prog >= 10                          ? "medium" :
                                          "low";

  const scheduledCompare = sched
    ? forecastEnd > sched
      ? ` — that's ${daysBetween(sched, forecastEnd)} days later than the scheduled end (${sched}).`
      : forecastEnd < sched
        ? ` — ahead of the scheduled end (${sched}).`
        : ` — matches the scheduled end.`
    : "";

  return {
    project_id:           opts.projectId,
    title,
    scheduled_end:        sched,
    progress_percent:     prog,
    velocity_pct_per_day: Number(velocity.toFixed(2)),
    forecast_end:         forecastEnd,
    confidence,
    reason:               `Progress ${prog}% over ${daysSinceStart} days on site = ${velocity.toFixed(2)}% per day. At that rate, ${remainingPct}% left = ~${daysToFinish} days → ${forecastEnd}${scheduledCompare}`,
    evidence
  };
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}
