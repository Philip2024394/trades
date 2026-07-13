// aggregate.ts — the aggregation job that turns raw submissions into
// verified market signals.
//
// Runs nightly (or on-demand). Rules enforced (all four must pass):
//   1. ≥3 unique contributors within a rolling 3-month window
//   2. Submissions from that window are ≥3 approved+unflagged rows
//   3. Standard deviation < 15% of median
//   4. No single contributor >40% of submissions in the window
//
// Rows that pass become app_rates_aggregates records. Rows that fail
// silently leave no aggregate — the UI shows honest empty state.
// Never write an aggregate that failed any rule.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { SOC_TO_TRADE_SLUG, NUTS1_REGIONS, UK_CITIES } from "./taxonomy";

const WINDOW_MONTHS = 3;
const MIN_CONTRIBUTORS = 3;
const MIN_SAMPLE_SIZE = 3;
const MAX_STDEV_PCT = 15;
const MAX_SINGLE_CONTRIBUTOR_SHARE = 0.40;
const RATE_TYPES = ["hourly", "daily", "annual"] as const;

type SubmissionRow = {
  trade_id: string;
  gbp_amount: number | string;
  date_of_work: string;
};

type AggregateResult = {
  computed: number;
  rejected: number;
  rejectionReasons: Record<string, number>;
};

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  const frac = idx - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

function standardDeviation(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const sqDiff = values.reduce((s, v) => s + (v - mean) ** 2, 0);
  return Math.sqrt(sqDiff / (values.length - 1));
}

/** Compute aggregates for one bucket over a 3-month window ending at
 *  `windowEnd`. Bucket = (trade_slug, region_code, rate_type,
 *  [optional city_slug, service_slug]). Passing `citySlug` computes
 *  the finer city-level aggregate; passing `serviceSlug` computes
 *  a per-service aggregate (e.g. skim-coat-2coat) rather than the
 *  legacy per-rate_type aggregate.
 *  Returns null if any threshold fails — caller must not persist. */
export async function computeAggregateForBucket(params: {
  tradeSlug: string;
  regionCode: string;
  rateType: (typeof RATE_TYPES)[number];
  windowEnd: Date;
  citySlug?: string;
  serviceSlug?: string;
}): Promise<null | {
  tradeSlug: string;
  regionCode: string;
  citySlug: string | null;
  serviceSlug: string | null;
  rateType: (typeof RATE_TYPES)[number];
  windowStart: Date;
  windowEnd: Date;
  sampleSize: number;
  contributorCount: number;
  gbpMedian: number;
  gbpP25: number;
  gbpP75: number;
  stdevPct: number;
}> {
  const windowStart = new Date(params.windowEnd);
  windowStart.setMonth(windowStart.getMonth() - WINDOW_MONTHS);

  let query = supabaseAdmin
    .from("app_rates_submissions")
    .select("trade_id, gbp_amount, date_of_work")
    .eq("trade_slug", params.tradeSlug)
    .eq("region_code", params.regionCode)
    .eq("rate_type", params.rateType)
    .eq("approved", true)
    .eq("flagged", false)
    .gte("date_of_work", windowStart.toISOString().slice(0, 10))
    .lte("date_of_work", params.windowEnd.toISOString().slice(0, 10));

  if (params.citySlug) {
    query = query.eq("city_slug", params.citySlug);
  }
  if (params.serviceSlug) {
    query = query.eq("service_slug", params.serviceSlug);
  } else {
    // Legacy per-rate_type aggregation: exclude per-service rows so
    // the two aggregation modes don't double-count each other.
    query = query.is("service_slug", null);
  }

  const { data, error } = await query;

  if (error || !data) return null;
  const rows = data as SubmissionRow[];
  if (rows.length < MIN_SAMPLE_SIZE) return null;

  // Rule 1: unique contributor count
  const uniqueContributors = new Set(rows.map((r) => r.trade_id));
  if (uniqueContributors.size < MIN_CONTRIBUTORS) return null;

  // Rule 4: no single contributor represents >40%
  const contributorCounts = new Map<string, number>();
  for (const r of rows) {
    contributorCounts.set(r.trade_id, (contributorCounts.get(r.trade_id) ?? 0) + 1);
  }
  const maxShare = Math.max(...contributorCounts.values()) / rows.length;
  if (maxShare > MAX_SINGLE_CONTRIBUTOR_SHARE) return null;

  const values = rows.map((r) => Number(r.gbp_amount)).sort((a, b) => a - b);
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const med = median(values);
  const p25 = percentile(values, 0.25);
  const p75 = percentile(values, 0.75);
  const stdev = standardDeviation(values, mean);
  const stdevPct = med === 0 ? 100 : (stdev / med) * 100;

  // Rule 3: stdev must be under 15% of median
  if (stdevPct >= MAX_STDEV_PCT) return null;

  return {
    tradeSlug:        params.tradeSlug,
    regionCode:       params.regionCode,
    citySlug:         params.citySlug ?? null,
    serviceSlug:      params.serviceSlug ?? null,
    rateType:         params.rateType,
    windowStart,
    windowEnd:        params.windowEnd,
    sampleSize:       rows.length,
    contributorCount: uniqueContributors.size,
    gbpMedian:        Number(med.toFixed(2)),
    gbpP25:           Number(p25.toFixed(2)),
    gbpP75:           Number(p75.toFixed(2)),
    stdevPct:         Number(stdevPct.toFixed(2))
  };
}

/** Full sweep — iterate every trade × region × rate_type combo
 *  (region-level aggregates) AND every trade × city × rate_type combo
 *  (city-level aggregates). Compute aggregates for the window ending
 *  today. Called by the nightly cron. Idempotent upsert. */
export async function runAggregationSweep(): Promise<AggregateResult> {
  const result: AggregateResult = {
    computed: 0,
    rejected: 0,
    rejectionReasons: {}
  };
  const windowEnd = new Date();

  async function upsertAggregate(agg: NonNullable<Awaited<ReturnType<typeof computeAggregateForBucket>>>) {
    const { error } = await supabaseAdmin
      .from("app_rates_aggregates")
      .upsert(
        {
          trade_slug:        agg.tradeSlug,
          region_code:       agg.regionCode,
          city_slug:         agg.citySlug,
          service_slug:      agg.serviceSlug,
          rate_type:         agg.rateType,
          window_start:      agg.windowStart.toISOString().slice(0, 10),
          window_end:        agg.windowEnd.toISOString().slice(0, 10),
          sample_size:       agg.sampleSize,
          contributor_count: agg.contributorCount,
          gbp_median:        agg.gbpMedian,
          gbp_p25:           agg.gbpP25,
          gbp_p75:           agg.gbpP75,
          stdev_pct:         agg.stdevPct
        },
        { onConflict: "trade_slug,region_code,city_slug,service_slug,rate_type,window_end" }
      );
    if (error) {
      result.rejected += 1;
      result.rejectionReasons["upsert_error"] =
        (result.rejectionReasons["upsert_error"] ?? 0) + 1;
    } else {
      result.computed += 1;
    }
  }

  // Region-level aggregates
  for (const trade of SOC_TO_TRADE_SLUG) {
    for (const region of NUTS1_REGIONS) {
      for (const rateType of RATE_TYPES) {
        const agg = await computeAggregateForBucket({
          tradeSlug:  trade.slug,
          regionCode: region.code,
          rateType,
          windowEnd
        });
        if (!agg) {
          result.rejected += 1;
          continue;
        }
        await upsertAggregate(agg);
      }
    }
  }

  // City-level aggregates — finer bucket. Only rows where 3+ contributors
  // submitted from that specific city within the window will pass.
  for (const trade of SOC_TO_TRADE_SLUG) {
    for (const city of UK_CITIES) {
      for (const rateType of RATE_TYPES) {
        const agg = await computeAggregateForBucket({
          tradeSlug:  trade.slug,
          regionCode: city.regionCode,
          citySlug:   city.slug,
          rateType,
          windowEnd
        });
        if (!agg) {
          result.rejected += 1;
          continue;
        }
        await upsertAggregate(agg);
      }
    }
  }

  // Per-service aggregates — the finest bucket. Discovers every
  // distinct service_slug the submissions table has so we don't need
  // to hard-code catalog references (new disciplines auto-work).
  const { data: serviceRows } = await supabaseAdmin
    .from("app_rates_submissions")
    .select("trade_slug, region_code, city_slug, rate_type, service_slug")
    .not("service_slug", "is", null)
    .eq("approved", true)
    .eq("flagged", false);

  const perServiceBuckets = new Set<string>();
  for (const row of (serviceRows ?? []) as Array<{
    trade_slug: string;
    region_code: string;
    city_slug: string | null;
    rate_type: string;
    service_slug: string;
  }>) {
    perServiceBuckets.add(
      [row.trade_slug, row.region_code, row.city_slug ?? "", row.rate_type, row.service_slug].join("|")
    );
  }

  for (const key of perServiceBuckets) {
    const [tradeSlug, regionCode, citySlugRaw, rateType, serviceSlug] = key.split("|");
    const citySlug = citySlugRaw === "" ? undefined : citySlugRaw;
    if (!(RATE_TYPES as readonly string[]).includes(rateType)) continue;
    const agg = await computeAggregateForBucket({
      tradeSlug,
      regionCode,
      citySlug,
      serviceSlug,
      rateType: rateType as (typeof RATE_TYPES)[number],
      windowEnd
    });
    if (!agg) {
      result.rejected += 1;
      continue;
    }
    await upsertAggregate(agg);
  }

  return result;
}
