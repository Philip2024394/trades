// Trade rates library — evidence-required pricing helpers.
//
// Every rate carries source_publisher + source_url + last_verified_at.
// Never fabricate. If a rate isn't in the DB, return null and let
// the caller show "estimate unavailable — get 3 quotes" rather than
// invent a number.
//
// Trade-agnostic — same functions serve decorative-rendering,
// concrete, roofing, plumbing, electrical.

import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ─── Types ────────────────────────────────────────────────────────

export type TradeRate = {
  id:                  string;
  trade_slug:          string;
  line_item_slug:      string;
  display_name:        string;
  description:         string | null;
  unit:                "m2" | "linear-m" | "hour" | "fixed" | "each" | "tonne" | "bag" | "sheet" | "day" | "week";
  price_low_pence:     number;
  price_high_pence:    number;
  currency:            string;
  source_publisher:    string;
  source_url:          string;
  source_reference:    string | null;
  last_verified_at:    string;
  applies_to_regions:  string[];
  excludes_notes:      string | null;
  finish_slug:         string | null;
  confidence:          "high" | "moderate" | "low";
};

export type RegionalMultiplier = {
  region_slug:         string;
  display_name:        string;
  postcode_prefixes:   string[];
  multiplier:          number;   // e.g. 1.15 = +15%
  source_publisher:    string;
  source_url:          string;
  source_reference:    string | null;
  last_verified_at:    string;
  applies_to_trades:   string[];
  notes:               string | null;
};

/** Applied price for a rate + region. Range in pence. Citations
 *  attached so callers render provenance. */
export type PricedRate = {
  rate:                 TradeRate;
  region:               RegionalMultiplier | null;
  quantity:             number;
  quantity_unit:        TradeRate["unit"];
  low_pence:            number;
  high_pence:           number;
  regional_multiplier:  number;   // 1.0 if no region matched
  citation_text:        string;   // human-readable "per Spon's 2026 × 1.15 London-SE (ONS BCI)"
  stale_days:           number;   // 0 if fresh; >365 = flag in admin
};

// ─── Lookups ──────────────────────────────────────────────────────

/** Fetch a single rate by trade + line_item. Returns null if not
 *  found — caller must handle gracefully (never fabricate). */
export async function getRate(
  tradeSlug:    string,
  lineItemSlug: string
): Promise<TradeRate | null> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_rates")
    .select("*")
    .eq("trade_slug",     tradeSlug)
    .eq("line_item_slug", lineItemSlug)
    .maybeSingle();
  return (data as TradeRate | null) ?? null;
}

/** All rates for a trade (used by /admin/rates + calculator). */
export async function getAllRatesForTrade(tradeSlug: string): Promise<TradeRate[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_rates")
    .select("*")
    .eq("trade_slug", tradeSlug)
    .order("line_item_slug");
  return (data as TradeRate[]) ?? [];
}

/** Fetch rates for a specific finish (e.g. all rates flagged
 *  finish_slug='stone-effect'). Includes non-finish supporting
 *  items (prep, beads, scaffold) which apply to any finish. */
export async function getRatesForFinish(
  tradeSlug:  string,
  finishSlug: string
): Promise<TradeRate[]> {
  const { data } = await supabaseAdmin
    .from("hammerex_trade_rates")
    .select("*")
    .eq("trade_slug", tradeSlug)
    .or(`finish_slug.eq.${finishSlug},finish_slug.is.null`)
    .order("line_item_slug");
  return (data as TradeRate[]) ?? [];
}

/** Resolve a postcode → regional multiplier row. Falls back to null
 *  if postcode doesn't match any prefix. Uses the Postgres
 *  lookup_region_slug() function which handles longest-prefix-wins
 *  correctly. */
export async function getRegionForPostcode(
  postcode: string
): Promise<RegionalMultiplier | null> {
  if (!postcode || postcode.trim().length < 2) return null;
  const clean = postcode.trim().toUpperCase().replace(/\s+/g, "");
  const { data: slugRow } = await supabaseAdmin.rpc("lookup_region_slug", { postcode: clean });
  const slug = slugRow as string | null;
  if (!slug) return null;
  const { data } = await supabaseAdmin
    .from("hammerex_regional_cost_multipliers")
    .select("*")
    .eq("region_slug", slug)
    .maybeSingle();
  return (data as RegionalMultiplier | null) ?? null;
}

// ─── Pricing math ─────────────────────────────────────────────────

/** Apply a rate + regional multiplier to a quantity. Returns pence
 *  range + a human citation string. */
export function applyRate(
  rate:      TradeRate,
  quantity:  number,
  region:    RegionalMultiplier | null
): PricedRate {
  const mult = region?.multiplier ?? 1.0;
  const low  = Math.round(rate.price_low_pence  * quantity * mult);
  const high = Math.round(rate.price_high_pence * quantity * mult);

  const citation_text = region
    ? `Rate: ${rate.source_publisher} × ${mult.toFixed(2)} regional multiplier (${region.display_name}, ${region.source_publisher})`
    : `Rate: ${rate.source_publisher} (national)`;

  // Days since last verified
  const stale_days = Math.floor(
    (Date.now() - new Date(rate.last_verified_at).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    rate,
    region,
    quantity,
    quantity_unit:       rate.unit,
    low_pence:           low,
    high_pence:          high,
    regional_multiplier: mult,
    citation_text,
    stale_days
  };
}

// ─── Formatting helpers ───────────────────────────────────────────

/** Format a pence range as a UK £ range: `£4,500 – £8,500`. */
export function formatPriceRange(low_pence: number, high_pence: number): string {
  const fmt = (p: number) => "£" + Math.round(p / 100).toLocaleString("en-GB");
  if (low_pence === high_pence) return fmt(low_pence);
  return `${fmt(low_pence)} – ${fmt(high_pence)}`;
}

/** Sum priced-rate rows and return one aggregated range + list of
 *  citations. */
export function aggregatePricedRates(items: PricedRate[]): {
  low_pence:  number;
  high_pence: number;
  citations:  string[];
  stale_any:  boolean;
} {
  const low_pence  = items.reduce((acc, r) => acc + r.low_pence,  0);
  const high_pence = items.reduce((acc, r) => acc + r.high_pence, 0);
  const citations  = [...new Set(items.map(r => r.citation_text))];
  const stale_any  = items.some(r => r.stale_days > 365);
  return { low_pence, high_pence, citations, stale_any };
}
