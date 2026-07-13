// getMarketRate — the ONE query the UI calls for verified user rates.
//
// Reads app_rates_aggregates for the most recent aggregate matching
// (trade_slug, region_code, rate_type). Returns null when no aggregate
// exists — meaning fewer than 3 verified contributors have submitted
// for that combination in the last 3 months, or the signal was too
// noisy (stdev ≥ 15%).
//
// Evidence-or-silence rule (project_evidence_or_silence.md):
// null MUST render as an honest "not enough data" state in the UI.
// Callers MUST NOT invent, extrapolate, or fall back to a made-up
// number.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type MarketRate = {
  tradeSlug: string;
  regionCode: string;
  citySlug: string | null;
  serviceSlug: string | null;
  rateType: "hourly" | "daily" | "annual";
  windowStart: string;
  windowEnd: string;
  sampleSize: number;
  contributorCount: number;
  gbpMedian: number;
  gbpP25: number;
  gbpP75: number;
  stdevPct: number;
  computedAt: string;
  freshnessDays: number;
  /** "city" when this is a city-level aggregate, "region" when a
   *  region-level fallback was used. UI shows this in the badge. */
  scope: "city" | "region";
};

type Row = {
  trade_slug: string;
  region_code: string;
  city_slug: string | null;
  service_slug: string | null;
  rate_type: string;
  window_start: string;
  window_end: string;
  sample_size: number;
  contributor_count: number;
  gbp_median: number | string;
  gbp_p25: number | string;
  gbp_p75: number | string;
  stdev_pct: number | string;
  computed_at: string;
};

function fromRow(r: Row): MarketRate {
  const computed = new Date(r.computed_at);
  const freshnessDays = Math.max(
    0,
    Math.floor((Date.now() - computed.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    tradeSlug:        r.trade_slug,
    regionCode:       r.region_code,
    citySlug:         r.city_slug,
    serviceSlug:      r.service_slug,
    rateType:         r.rate_type as MarketRate["rateType"],
    windowStart:      r.window_start,
    windowEnd:        r.window_end,
    sampleSize:       r.sample_size,
    contributorCount: r.contributor_count,
    gbpMedian:        Number(r.gbp_median),
    gbpP25:           Number(r.gbp_p25),
    gbpP75:           Number(r.gbp_p75),
    stdevPct:         Number(r.stdev_pct),
    computedAt:       r.computed_at,
    freshnessDays,
    scope:            r.city_slug ? "city" : "region"
  };
}

/** Lookup with city → region fallback. When `citySlug` is provided,
 *  we try the city aggregate first. If none exists, fall back to the
 *  region-level aggregate. If `serviceSlug` is provided, we look up
 *  the per-service aggregate; otherwise the legacy per-rate_type
 *  aggregate. Returns null when no evidence exists. */
export async function getMarketRate(params: {
  tradeSlug: string;
  regionCode: string;
  rateType?: "hourly" | "daily" | "annual";
  citySlug?: string;
  serviceSlug?: string;
}): Promise<MarketRate | null> {
  const rateType = params.rateType ?? "hourly";
  const cols = "trade_slug, region_code, city_slug, service_slug, rate_type, window_start, window_end, sample_size, contributor_count, gbp_median, gbp_p25, gbp_p75, stdev_pct, computed_at";
  try {
    // Try city-level first when city is provided.
    if (params.citySlug) {
      let cityQ = supabaseAdmin
        .from("app_rates_aggregates")
        .select(cols)
        .eq("trade_slug", params.tradeSlug)
        .eq("city_slug", params.citySlug)
        .eq("rate_type", rateType);
      cityQ = params.serviceSlug
        ? cityQ.eq("service_slug", params.serviceSlug)
        : cityQ.is("service_slug", null);
      const { data } = await cityQ.order("window_end", { ascending: false }).limit(1).maybeSingle();
      if (data) return fromRow(data as Row);
    }
    // Region-level fallback.
    let regionQ = supabaseAdmin
      .from("app_rates_aggregates")
      .select(cols)
      .eq("trade_slug", params.tradeSlug)
      .eq("region_code", params.regionCode)
      .is("city_slug", null)
      .eq("rate_type", rateType);
    regionQ = params.serviceSlug
      ? regionQ.eq("service_slug", params.serviceSlug)
      : regionQ.is("service_slug", null);
    const { data, error } = await regionQ.order("window_end", { ascending: false }).limit(1).maybeSingle();
    if (error || !data) return null;
    return fromRow(data as Row);
  } catch {
    return null;
  }
}

/** Batch lookup — fetch multiple per-service aggregates in one round
 *  trip. Used by the plastering rates page to populate the "network
 *  median" column across every catalog row. Returns a Map keyed by
 *  service_slug. Silence for missing services (evidence-or-silence). */
export async function batchGetMarketRatesByService(params: {
  tradeSlug: string;
  serviceSlugs: string[];
  regionCode: string;
  citySlug?: string;
  rateType?: "hourly" | "daily" | "annual";
}): Promise<Map<string, MarketRate>> {
  const map = new Map<string, MarketRate>();
  const rateType = params.rateType ?? "sqm-based";
  // rateType is unused for per-service — service_slug carries the
  // meaning. But the aggregation column still requires a value so we
  // accept any rate_type that matches submissions.
  void rateType;
  const cols = "trade_slug, region_code, city_slug, service_slug, rate_type, window_start, window_end, sample_size, contributor_count, gbp_median, gbp_p25, gbp_p75, stdev_pct, computed_at";
  if (params.serviceSlugs.length === 0) return map;
  try {
    // Prefer city-level; region fallback in a second query for
    // services that didn't match at city level.
    if (params.citySlug) {
      const { data } = await supabaseAdmin
        .from("app_rates_aggregates")
        .select(cols)
        .eq("trade_slug", params.tradeSlug)
        .eq("city_slug", params.citySlug)
        .in("service_slug", params.serviceSlugs)
        .order("window_end", { ascending: false });
      for (const r of (data ?? []) as Row[]) {
        if (r.service_slug && !map.has(r.service_slug)) {
          map.set(r.service_slug, fromRow(r));
        }
      }
    }
    const missing = params.serviceSlugs.filter((s) => !map.has(s));
    if (missing.length > 0) {
      const { data } = await supabaseAdmin
        .from("app_rates_aggregates")
        .select(cols)
        .eq("trade_slug", params.tradeSlug)
        .eq("region_code", params.regionCode)
        .is("city_slug", null)
        .in("service_slug", missing)
        .order("window_end", { ascending: false });
      for (const r of (data ?? []) as Row[]) {
        if (r.service_slug && !map.has(r.service_slug)) {
          map.set(r.service_slug, fromRow(r));
        }
      }
    }
  } catch {
    /* migration not applied yet — silence is honest */
  }
  return map;
}

/** List all city-level aggregates for a trade — powers the network
 *  browse page. Returns rates sorted by median descending so trades
 *  can quickly see where the top rates cluster. */
export async function listCityRates(params: {
  tradeSlug: string;
  rateType?: "hourly" | "daily" | "annual";
}): Promise<MarketRate[]> {
  const rateType = params.rateType ?? "hourly";
  const cols = "trade_slug, region_code, city_slug, rate_type, window_start, window_end, sample_size, contributor_count, gbp_median, gbp_p25, gbp_p75, stdev_pct, computed_at";
  try {
    const { data, error } = await supabaseAdmin
      .from("app_rates_aggregates")
      .select(cols)
      .eq("trade_slug", params.tradeSlug)
      .eq("rate_type", rateType)
      .not("city_slug", "is", null)
      .order("gbp_median", { ascending: false });
    if (error || !data) return [];
    return (data as Row[]).map(fromRow);
  } catch {
    return [];
  }
}

/** Compute the network-wide average across all city aggregates for a
 *  trade — weighted by sample size so heavily-contributed cities
 *  count more. Returns null when no city aggregates exist. */
export async function getNetworkAverage(params: {
  tradeSlug: string;
  rateType?: "hourly" | "daily" | "annual";
}): Promise<null | {
  tradeSlug: string;
  rateType: "hourly" | "daily" | "annual";
  weightedMedian: number;
  totalSampleSize: number;
  cityCount: number;
  regionCount: number;
  freshestComputedAt: string;
}> {
  const rates = await listCityRates(params);
  if (rates.length === 0) return null;
  const totalSampleSize = rates.reduce((n, r) => n + r.sampleSize, 0);
  const weightedSum = rates.reduce((n, r) => n + r.gbpMedian * r.sampleSize, 0);
  const weightedMedian = totalSampleSize === 0 ? 0 : weightedSum / totalSampleSize;
  return {
    tradeSlug:          params.tradeSlug,
    rateType:           params.rateType ?? "hourly",
    weightedMedian:     Number(weightedMedian.toFixed(2)),
    totalSampleSize,
    cityCount:          rates.length,
    regionCount:        new Set(rates.map((r) => r.regionCode)).size,
    freshestComputedAt: rates
      .map((r) => r.computedAt)
      .sort()
      .reverse()[0]
  };
}
