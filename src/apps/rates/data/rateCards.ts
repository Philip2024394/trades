// Rate Card Marketplace (R08) — data model + fixtures.
//
// Every trade publishes their OWN labour-rate menu (not project total,
// not "what to charge" — just their honest per-unit rate). Customers
// see it before they call, self-qualify, and stop wasting the trade's
// mornings on tire-kickers who wanted half the price anyway.
//
// The market benchmark (RegionalBenchmark) aggregates every rate card
// in a region and shows anonymised P25/median/P75 bands. Trade Center
// NEVER recommends a rate — we just show what other trades published.
// See TRADE_CENTER_FEATURE_MASTERPLAN.md R08 for the full rationale.

export type RateCardUnit = "per-m2" | "per-lm" | "per-hour" | "per-day" | "per-job" | "each";

export const UNIT_LABEL: Record<RateCardUnit, string> = {
  "per-m2":   "per m²",
  "per-lm":   "per linear m",
  "per-hour": "per hour",
  "per-day":  "per day",
  "per-job":  "per job",
  "each":     "each"
};

export type RateCardItem = {
  id: string;
  label: string;         // "Skim (1 coat)"
  detail?: string;       // "Prep + skim + finish"
  unit: RateCardUnit;
  rateGbp: number;
  minimumGbp?: number;   // "Minimum £180 per job"
};

export type RateCard = {
  ownerTradeSlug: string;
  tradeName: string;
  discipline: string;    // "Plastering & Skimming"
  region: string;        // "Manchester"
  visibility: "private" | "public";
  publishedAtIso?: string;
  updatedAtIso: string;
  items: RateCardItem[];
  minimumJobGbp?: number;
  travelPolicy?: string;
  materialsPolicy?: string;
  vatIncluded: boolean;
};

// ─── Fixtures ────────────────────────────────────────────────────────

export const RATE_CARD_FIXTURES: RateCard[] = [
  {
    ownerTradeSlug: "bob-plastering",
    tradeName: "Bob Watson · Watson Plastering Ltd",
    discipline: "Plastering & Skimming",
    region: "Manchester",
    visibility: "public",
    publishedAtIso: "2026-05-14T00:00:00Z",
    updatedAtIso: "2026-07-01T00:00:00Z",
    minimumJobGbp: 180,
    travelPolicy: "Free within 15 miles of M20. £0.60/mile beyond.",
    materialsPolicy: "Priced separately at Trade Center merchant rate + 5% handling.",
    vatIncluded: false,
    items: [
      { id: "i1", label: "Skim (1 coat)",           detail: "Prep + skim + finish",             unit: "per-m2",  rateGbp: 22 },
      { id: "i2", label: "Multi-finish (Thistle)",  detail: "Higher-spec finish",               unit: "per-m2",  rateGbp: 28 },
      { id: "i3", label: "Bonding coat",            detail: "Base coat only — undercoat",       unit: "per-m2",  rateGbp: 15 },
      { id: "i4", label: "Ceiling (up to 12m²)",    detail: "Setup + travel included",          unit: "per-job", rateGbp: 180, minimumGbp: 180 },
      { id: "i5", label: "Reveals",                 detail: "Ex materials",                     unit: "per-lm",  rateGbp: 8 },
      { id: "i6", label: "Day rate — 8hr on site",  detail: "Fall-back rate for small jobs",    unit: "per-day", rateGbp: 280 }
    ]
  }
];

export function findRateCard(slug: string): RateCard | undefined {
  return RATE_CARD_FIXTURES.find((c) => c.ownerTradeSlug === slug);
}

// ─── Anonymised regional benchmark ───────────────────────────────────
// In production this is aggregated server-side across every rate card
// that opted into "share for benchmark" (default on). Bands are recomputed
// weekly against a rolling 30-day window. Anonymised — never mentions any
// individual trade.

export type BenchmarkBand = {
  label: string;
  unit: RateCardUnit;
  sampleSize: number;
  p25: number;
  median: number;
  p75: number;
};

export type RegionalBenchmark = {
  discipline: string;
  region: string;
  totalContributors: number;
  updatedAtIso: string;
  perItem: BenchmarkBand[];
};

/**
 * Fixture: Manchester plasterer benchmark. Real system computes these
 * from all opted-in rate cards + a 30-day rolling window.
 */
export const REGIONAL_BENCHMARK_FIXTURES: RegionalBenchmark[] = [
  {
    discipline: "Plastering & Skimming",
    region: "Manchester",
    totalContributors: 47,
    updatedAtIso: "2026-07-08T00:00:00Z",
    perItem: [
      { label: "Skim (1 coat)",          unit: "per-m2",  sampleSize: 47, p25: 18, median: 24, p75: 28 },
      { label: "Multi-finish (Thistle)", unit: "per-m2",  sampleSize: 39, p25: 24, median: 30, p75: 34 },
      { label: "Bonding coat",           unit: "per-m2",  sampleSize: 42, p25: 12, median: 16, p75: 19 },
      { label: "Ceiling (up to 12m²)",   unit: "per-job", sampleSize: 35, p25: 160, median: 200, p75: 240 },
      { label: "Reveals",                unit: "per-lm",  sampleSize: 28, p25: 6, median: 9, p75: 12 },
      { label: "Day rate — 8hr on site", unit: "per-day", sampleSize: 45, p25: 240, median: 280, p75: 320 }
    ]
  }
];

export function findBenchmark(discipline: string, region: string): RegionalBenchmark | undefined {
  return REGIONAL_BENCHMARK_FIXTURES.find(
    (b) => b.discipline === discipline && b.region === region
  );
}
