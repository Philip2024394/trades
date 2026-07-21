// Cron Heartbeat · every scheduled job wraps its work in cronRun().
//
// Usage inside /api/cron/foo/route.ts:
//
//   export async function GET() {
//     return cronRun("/api/cron/foo", async () => {
//       const n = await doWork();
//       return { summary: `${n} rows updated` };
//     });
//   }
//
// Writes a start row (status=running), then updates it to success/error
// with duration + summary. The System Health page reads these to spot
// jobs that have missed their expected cadence.

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type CronRunResult = {
  summary?: string;
  metadata?: Record<string, unknown>;
  skipped?: boolean;      // e.g. env var missing → mark skipped not error
};

export async function cronRun(jobName: string, work: () => Promise<CronRunResult | void>): Promise<NextResponse> {
  const startedAt = new Date();
  const insertRes = await supabaseAdmin
    .from("hammerex_cron_runs")
    .insert({ job_name: jobName, started_at: startedAt.toISOString(), status: "running" })
    .select("id")
    .maybeSingle();
  const runId = insertRes.data?.id as string | undefined;

  try {
    const result = (await work()) || {};
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    if (runId) {
      await supabaseAdmin
        .from("hammerex_cron_runs")
        .update({
          finished_at:    finishedAt.toISOString(),
          duration_ms:    durationMs,
          status:         result.skipped ? "skipped" : "success",
          result_summary: result.summary ?? null,
          metadata:       result.metadata ?? null
        })
        .eq("id", runId);
    }
    return NextResponse.json({ ok: true, jobName, durationMs, ...result });
  } catch (err) {
    const finishedAt = new Date();
    const durationMs = finishedAt.getTime() - startedAt.getTime();
    const message    = err instanceof Error ? err.message : String(err);
    if (runId) {
      await supabaseAdmin
        .from("hammerex_cron_runs")
        .update({
          finished_at:   finishedAt.toISOString(),
          duration_ms:   durationMs,
          status:        "error",
          error_message: message
        })
        .eq("id", runId);
    }
    console.error(`[cron] ${jobName} failed:`, err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** Per-job expected-cadence table — feeds the "stale" detector.
 *  Values in seconds. Only jobs listed here get flagged when stale;
 *  the rest just show their last-run time. */
export const CRON_EXPECTED_CADENCE: Record<string, number> = {
  "/api/cron/monthly-washer-replenish": 32 * 86_400,   // monthly ± 2d
  "/api/cron/shadow-profile-drip":      86_400,        // daily
  "/api/cron/warranty-expiry-reminders": 86_400,       // daily
  "/api/cron/reset-usage":              86_400,        // daily
  "/api/cron/imagekit-migrate":         86_400,        // daily (Hammerex)
  "/api/cron/fx-refresh":               86_400         // daily (Hammerex)
};

export type CronHealth = {
  jobName:           string;
  lastRunAt:         string | null;
  lastStatus:        "running" | "success" | "error" | "skipped" | null;
  lastDurationMs:    number | null;
  lastError:         string | null;
  lastSummary:       string | null;
  expectedCadenceS:  number | null;
  isStale:           boolean;   // has_expected_cadence && lastRunAt older than cadence
  totalErrors24h:    number;
};

export async function loadCronHealth(): Promise<CronHealth[]> {
  // Latest run per job
  const latestRes = await supabaseAdmin
    .from("hammerex_cron_runs")
    .select("job_name, started_at, finished_at, status, duration_ms, error_message, result_summary")
    .order("started_at", { ascending: false })
    .limit(500);
  const rows = (latestRes.data as Array<{
    job_name: string; started_at: string; finished_at: string | null;
    status: "running" | "success" | "error" | "skipped";
    duration_ms: number | null; error_message: string | null; result_summary: string | null;
  }>) ?? [];

  // Fold to first-seen per job (already sorted desc)
  const latestByJob = new Map<string, typeof rows[number]>();
  for (const r of rows) {
    if (!latestByJob.has(r.job_name)) latestByJob.set(r.job_name, r);
  }

  // 24h error tally
  const since24h = new Date(Date.now() - 24 * 3600_000).toISOString();
  const errsRes  = await supabaseAdmin
    .from("hammerex_cron_runs")
    .select("job_name", { count: "exact", head: false })
    .eq("status", "error")
    .gte("started_at", since24h);
  const errCounts = new Map<string, number>();
  for (const row of ((errsRes.data as Array<{ job_name: string }>) ?? [])) {
    errCounts.set(row.job_name, (errCounts.get(row.job_name) ?? 0) + 1);
  }

  const now = Date.now();
  const jobs: CronHealth[] = [];
  const jobNames = new Set<string>([...latestByJob.keys(), ...Object.keys(CRON_EXPECTED_CADENCE)]);
  for (const name of jobNames) {
    const latest      = latestByJob.get(name) ?? null;
    const cadenceS    = CRON_EXPECTED_CADENCE[name] ?? null;
    const lastRunAt   = latest?.started_at ?? null;
    const lastRunMs   = lastRunAt ? new Date(lastRunAt).getTime() : 0;
    const isStale     = cadenceS !== null && (!lastRunAt || (now - lastRunMs) > cadenceS * 1000);
    jobs.push({
      jobName:          name,
      lastRunAt,
      lastStatus:       latest?.status ?? null,
      lastDurationMs:   latest?.duration_ms ?? null,
      lastError:        latest?.error_message ?? null,
      lastSummary:      latest?.result_summary ?? null,
      expectedCadenceS: cadenceS,
      isStale,
      totalErrors24h:   errCounts.get(name) ?? 0
    });
  }
  return jobs.sort((a, b) => Number(b.isStale) - Number(a.isStale) || (b.totalErrors24h - a.totalErrors24h));
}
