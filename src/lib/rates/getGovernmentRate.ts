// getGovernmentRate — the ONE query the UI calls for rate data.
//
// Reads app_rates_gov for the most recent row matching
// (trade_slug, region_code, rate_type). Returns the row + a
// derived freshness flag so the UI can honestly say "22 days ago"
// or "no verified data yet".
//
// Evidence-or-silence rule (project_evidence_or_silence.md):
// If no row exists, we return null. Callers MUST render an honest
// empty state ("no verified rate available for this trade in this
// region"). Callers MUST NOT synthesise or fabricate a number in
// place of null.

import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type GovernmentRate = {
  source: "ONS_ASHE" | "CITB_SKILLS" | "HMRC_PAYE";
  sourceUrl: string;
  sourceRelease: string;
  tradeSlug: string;
  tradeSocCode: string;
  regionCode: string;
  regionLabel: string;
  rateType: "hourly" | "daily" | "annual";
  gbpLow: number | null;
  gbpMedian: number;
  gbpHigh: number | null;
  sampleSizeNote: string | null;
  releasedAt: string;
  ingestedAt: string;
  /** Days since the source released this data. UI uses this to
   *  decide whether to display an "old data" caution. */
  freshnessDays: number;
};

const FRESH_MAX_DAYS = 180; // 6 months. Older data still shown but with
                            // a caution label per methodology page.

type Row = {
  source: string;
  source_url: string;
  source_release: string;
  trade_slug: string;
  trade_soc_code: string;
  region_code: string;
  region_label: string;
  rate_type: string;
  gbp_low: number | string | null;
  gbp_median: number | string;
  gbp_high: number | string | null;
  sample_size_note: string | null;
  released_at: string;
  ingested_at: string;
};

function fromRow(r: Row): GovernmentRate {
  const releaseDate = new Date(r.released_at);
  const freshnessDays = Math.max(
    0,
    Math.floor((Date.now() - releaseDate.getTime()) / (1000 * 60 * 60 * 24))
  );
  return {
    source:         r.source as GovernmentRate["source"],
    sourceUrl:      r.source_url,
    sourceRelease:  r.source_release,
    tradeSlug:      r.trade_slug,
    tradeSocCode:   r.trade_soc_code,
    regionCode:     r.region_code,
    regionLabel:    r.region_label,
    rateType:       r.rate_type as GovernmentRate["rateType"],
    gbpLow:         r.gbp_low === null ? null : Number(r.gbp_low),
    gbpMedian:      Number(r.gbp_median),
    gbpHigh:        r.gbp_high === null ? null : Number(r.gbp_high),
    sampleSizeNote: r.sample_size_note,
    releasedAt:     r.released_at,
    ingestedAt:     r.ingested_at,
    freshnessDays
  };
}

export async function getGovernmentRate(params: {
  tradeSlug: string;
  regionCode: string;
  rateType?: "hourly" | "daily" | "annual";
}): Promise<GovernmentRate | null> {
  const rateType = params.rateType ?? "hourly";
  try {
    const { data, error } = await supabaseAdmin
      .from("app_rates_gov")
      .select(
        "source, source_url, source_release, trade_slug, trade_soc_code, region_code, region_label, rate_type, gbp_low, gbp_median, gbp_high, sample_size_note, released_at, ingested_at"
      )
      .eq("trade_slug", params.tradeSlug)
      .eq("region_code", params.regionCode)
      .eq("rate_type", rateType)
      .order("released_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return fromRow(data as Row);
  } catch {
    // Migration not applied yet in dev — return null so the UI shows
    // an honest empty state. Never invent a fallback number.
    return null;
  }
}

export function isFresh(rate: GovernmentRate): boolean {
  return rate.freshnessDays <= FRESH_MAX_DAYS;
}
