// Foreign-exchange rate service — server-side cached.
//
// Fetches GBP-base exchange rates from open.er-api.com (no API key
// required, ~150 currencies, updates every 24h on the free tier).
// Caches in-process for 24 hours to avoid hammering the upstream.
//
// Used by Business Brain surfaces to show the merchant's real GBP
// price alongside an approximate local-currency price for
// international customers. Never used on Trade Brain surfaces per
// feedback_nex_no_prices_only_percentages rule.

import "server-only";

type RateCache = {
  base: string;              // "GBP"
  rates: Record<string, number>;
  fetchedAt: number;         // ms since epoch
};

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;   // 24h
let cache: RateCache | null = null;

const OPEN_ER_API = "https://open.er-api.com/v6/latest/GBP";

// Sensible fallback rates — used only when the upstream call fails
// AND we have no prior cached rates. Never marketed as accurate;
// the DualPrice component adds a "based on latest available rate"
// caveat regardless.
const FALLBACK_RATES: Record<string, number> = {
  GBP: 1.00,
  EUR: 1.17,
  USD: 1.27,
  CAD: 1.73,
  AUD: 1.93,
  NZD: 2.09,
  CHF: 1.13,
  JPY: 194,
  SGD: 1.72,
  IDR: 20500,
  INR: 106,
  AED: 4.66,
  ZAR: 23.9,
  CNY: 9.15
};

export async function getRates(): Promise<{ base: string; rates: Record<string, number>; stale: boolean }> {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return { base: cache.base, rates: cache.rates, stale: false };
  }

  try {
    const res = await fetch(OPEN_ER_API, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) throw new Error(`open_er_api_${res.status}`);
    const data = (await res.json()) as { result?: string; base_code?: string; rates?: Record<string, number> };
    if (data.result !== "success" || !data.rates || data.base_code !== "GBP") {
      throw new Error("open_er_api_bad_shape");
    }
    cache = { base: "GBP", rates: data.rates, fetchedAt: now };
    return { base: "GBP", rates: data.rates, stale: false };
  } catch {
    // Upstream failure — return cached if we have it, fallback otherwise.
    if (cache) return { base: cache.base, rates: cache.rates, stale: true };
    return { base: "GBP", rates: FALLBACK_RATES, stale: true };
  }
}

// Convert an amount in GBP pence to the target currency's minor units.
// Returns null if the target currency isn't in the rate table.
export async function convertGbpPence(
  gbpPence: number,
  targetCurrency: string
): Promise<{ amount: number; rate: number; stale: boolean } | null> {
  const { rates, stale } = await getRates();
  const rate = rates[targetCurrency.toUpperCase()];
  if (typeof rate !== "number") return null;
  const gbp = gbpPence / 100;
  const converted = gbp * rate;
  return { amount: converted, rate, stale };
}
