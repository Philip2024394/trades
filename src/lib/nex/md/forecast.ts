// Seasonality + revenue forecast.
//
// Uses two honest signals:
//   1. Accepted-quote velocity — sum of last-30d accepted total_pence,
//      project forward.
//   2. Merchant daily metrics — best-day-of-week for profile views.
//
// Nothing over-confident: if data is thin (<3 accepted quotes), the
// forward revenue estimate is null, not a guess.

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evidenceFor, type ForecastSnapshot } from "./types";

const DAY_MS = 86_400_000;
const DAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export type BuildForecastInput = {
  merchantId:   string;
  merchantSlug: string;
  now?:         Date;
};

export async function buildForecast(opts: BuildForecastInput): Promise<ForecastSnapshot> {
  const now = opts.now ?? new Date();
  const evidence = evidenceFor(
    "app_quote_workspace_quotes (accepted) + hammerex_merchant_daily_metrics",
    ["app_quote_workspace_quotes", "hammerex_merchant_daily_metrics"]
  );

  // Last 30 days of accepted quotes → simple projection.
  const from30 = new Date(now.getTime() - 30 * DAY_MS).toISOString();
  const accepted30 = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("total_pence")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", from30);

  const rows30 = accepted30.data ?? [];
  const sum30  = rows30.reduce((s, r) => s + Number(r.total_pence ?? 0), 0);

  // 6-month history for monthly average.
  const from180 = new Date(now.getTime() - 180 * DAY_MS).toISOString();
  const accepted180 = await supabaseAdmin
    .from("app_quote_workspace_quotes")
    .select("total_pence, accepted_at")
    .eq("merchant_id", opts.merchantId)
    .not("accepted_at", "is", null)
    .gte("accepted_at", from180);

  const rows180 = accepted180.data ?? [];
  const monthlyAvg = rows180.length === 0
    ? null
    : Math.round(rows180.reduce((s, r) => s + Number(r.total_pence ?? 0), 0) / 6);

  const next30 = rows30.length < 3 ? null : sum30;
  const next60 = rows30.length < 3 || monthlyAvg === null ? null : sum30 + monthlyAvg;

  // Best day of week from daily metrics.
  const fromDate = new Date(now.getTime() - 90 * DAY_MS).toISOString().slice(0, 10);
  const daily = await supabaseAdmin
    .from("hammerex_merchant_daily_metrics")
    .select("date, profile_views")
    .eq("merchant_slug", opts.merchantSlug)
    .gte("date", fromDate);
  const byDow: Record<number, number> = {};
  for (const r of daily.data ?? []) {
    const dow = new Date(String(r.date) + "T00:00:00Z").getUTCDay();
    byDow[dow] = (byDow[dow] ?? 0) + Number(r.profile_views ?? 0);
  }
  const bestDayEntry = Object.entries(byDow).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
  const bestDay = bestDayEntry && Number(bestDayEntry[1]) > 0 ? DAY_LABELS[Number(bestDayEntry[0])] : null;

  const seasonality: string[] = [];
  if (rows30.length < 3) seasonality.push("Fewer than 3 accepted quotes in the last 30 days — forecast held silent until data lands.");
  if (bestDay)           seasonality.push(`Best day of the week for profile views: ${bestDay}.`);

  return {
    computed_at:            now.toISOString(),
    next_30d_revenue_pence: next30,
    next_60d_revenue_pence: next60,
    monthly_avg_pence:      monthlyAvg,
    best_day_of_week:       bestDay,
    seasonality_notes:      seasonality,
    evidence
  };
}
