// Diary-gap detector.
//
// Scans app_job_diary_jobs for windows of ≥2 consecutive days with
// no scheduled work in the merchant's diary. Bounded to the next N
// days from now (default 21). Excludes signed-off / cancelled jobs.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type DiaryGap } from "./types";

const DAY_MS = 86_400_000;
const MIN_GAP_DAYS = 2;

export type FindDiaryGapsInput = {
  merchantId:   string;
  now?:         Date;
  windowDays?:  number;      // default 21
};

export async function findDiaryGaps(opts: FindDiaryGapsInput): Promise<DiaryGap[]> {
  const now      = opts.now ?? new Date();
  const window   = opts.windowDays ?? 21;
  const fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // today at 00:00 local
  const toDate   = new Date(fromDate.getTime() + window * DAY_MS);

  const jobs = await supabaseAdmin
    .from("app_job_diary_jobs")
    .select("id, scheduled_start_date, scheduled_end_date, status")
    .eq("merchant_id", opts.merchantId)
    .gte("scheduled_start_date", fromDate.toISOString().slice(0, 10))
    .lte("scheduled_start_date", toDate.toISOString().slice(0, 10))
    .not("status", "in", "(signed_off,cancelled)");

  // Build a busy-day set from every job's scheduled range.
  const busy = new Set<string>();
  for (const j of jobs.data ?? []) {
    const start = j.scheduled_start_date as string | null;
    if (!start) continue;
    const end   = (j.scheduled_end_date as string | null) ?? start;
    const s = new Date(start + "T00:00:00Z").getTime();
    const e = new Date(end   + "T00:00:00Z").getTime();
    for (let t = s; t <= e; t += DAY_MS) {
      busy.add(new Date(t).toISOString().slice(0, 10));
    }
  }

  // Walk the window day-by-day, group free days into gaps.
  const evidence = evidenceFor("app_job_diary_jobs (scheduled_start_date + scheduled_end_date)", ["app_job_diary_jobs"]);
  const gaps: DiaryGap[] = [];
  let runStart: Date | null = null;
  const push = (start: Date, end: Date) => {
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (days < MIN_GAP_DAYS) return;
    gaps.push({
      start_date: start.toISOString().slice(0, 10),
      end_date:   end.toISOString().slice(0, 10),
      days,
      reason:     "No jobs scheduled in this window.",
      evidence
    });
  };

  for (let t = fromDate.getTime(); t <= toDate.getTime(); t += DAY_MS) {
    const d = new Date(t);
    const iso = d.toISOString().slice(0, 10);
    if (busy.has(iso)) {
      if (runStart) {
        const runEnd = new Date(t - DAY_MS);
        push(runStart, runEnd);
        runStart = null;
      }
    } else {
      if (!runStart) runStart = d;
    }
  }
  if (runStart) push(runStart, new Date(toDate.getTime()));

  return gaps;
}
