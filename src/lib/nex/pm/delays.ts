// Delay detection — projects whose forecast finish is after their
// scheduled finish. Uses the same forecaster as everywhere else so
// results are consistent.

import { forecastCompletion } from "./forecast";
import { enumerateProjects } from "./enumerate";
import { evidenceFor, type DelayedProject } from "./types";

const DAY_MS = 86_400_000;

export type DetectDelaysInput = {
  merchantId:        string;
  merchantListingId: string;
  now?:              Date;
  /** Only surface projects whose forecast is this many days past
   *  scheduled_end. Default 1 (any slip). */
  minDaysBehind?:    number;
};

export async function detectDelayedProjects(opts: DetectDelaysInput): Promise<DelayedProject[]> {
  const now       = opts.now ?? new Date();
  const threshold = opts.minDaysBehind ?? 1;
  const evidence  = evidenceFor("app_job_diary_jobs — forecast vs scheduled_end_date", ["app_job_diary_jobs"]);

  const refs = await enumerateProjects({ merchantId: opts.merchantId, merchantListingId: opts.merchantListingId });
  const results: DelayedProject[] = [];

  for (const ref of refs) {
    if (!ref.scheduled_end || ref.completed_at) continue;
    const forecast = await forecastCompletion({ projectId: ref.project_id, merchantId: opts.merchantId, now });
    if (!forecast.forecast_end) continue;
    const days = Math.round((new Date(forecast.forecast_end).getTime() - new Date(ref.scheduled_end).getTime()) / DAY_MS);
    if (days < threshold) continue;
    results.push({
      project_id:    ref.project_id,
      title:         ref.title,
      scheduled_end: ref.scheduled_end,
      forecast_end:  forecast.forecast_end,
      days_behind:   days,
      reason:        forecast.reason,
      evidence
    });
  }
  results.sort((a, b) => b.days_behind - a.days_behind);
  return results;
}
