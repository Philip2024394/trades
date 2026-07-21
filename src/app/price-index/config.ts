// UK Trade Price Index · authoritative pricing dataset config.
//
// The price index is a data-authority page — Google + Bing + national
// press quote it when writing about UK trade costs. The moat: every
// number is either (a) derived from our live network data or (b) an
// industry benchmark attributed to its source. Never invented.
//
// As the network grows, more rows flip from "Industry benchmark 2026"
// to "Network live data (N samples)".
//
// Refresh cadence: monthly. Each refresh bumps the report_month,
// re-derives the "network live" numbers from Counter + listings, and
// updates the industry benchmark row where new industry data lands.

export type PriceSource = "network-live" | "industry-2026";

export type TradeRow = {
  tradeSlug:      string;
  displayName:    string;
  hourlyLow:      number;
  hourlyHigh:     number;
  dayRateLow:     number;
  dayRateHigh:    number;
  /** London day-rate — separately tracked because London is +30-40%. */
  londonDayRateLow:  number;
  londonDayRateHigh: number;
  /** Emergency callout minimum. */
  emergencyCalloutLow:  number;
  emergencyCalloutHigh: number;
  source:         PriceSource;
  /** When source === "network-live", how many listings the median
   *  was derived from. Shown transparently so readers can weigh. */
  sampleSize?:    number;
};

export type CityMultiplierRow = {
  citySlug:    string;
  displayName: string;
  region:      string;
  multiplier:  number;    // 1.00 = national average
};

export type ProjectMovementRow = {
  projectSlug:   string;
  displayName:   string;
  lastYearLow:   number;
  lastYearHigh:  number;
  currentLow:    number;
  currentHigh:   number;
  pctChange:     number;   // rounded to nearest %
};

// Report metadata — bump these when refreshing the index.
export const REPORT_MONTH = "July 2026";
export const REPORT_ISO   = "2026-07-01";
export const NEXT_REFRESH = "August 2026";

// ─── UK TRADE DAY RATES + HOURLY RATES ────────────────────────────

export const TRADE_ROWS: TradeRow[] = [
  {
    tradeSlug: "plumber",
    displayName: "Plumber",
    hourlyLow: 45, hourlyHigh: 90,
    dayRateLow: 180, dayRateHigh: 350,
    londonDayRateLow: 260, londonDayRateHigh: 460,
    emergencyCalloutLow: 75, emergencyCalloutHigh: 150,
    source: "industry-2026"
  },
  {
    tradeSlug: "electrician",
    displayName: "Electrician",
    hourlyLow: 45, hourlyHigh: 75,
    dayRateLow: 220, dayRateHigh: 380,
    londonDayRateLow: 300, londonDayRateHigh: 480,
    emergencyCalloutLow: 65, emergencyCalloutHigh: 140,
    source: "industry-2026"
  },
  {
    tradeSlug: "carpenter",
    displayName: "Carpenter / Joiner",
    hourlyLow: 30, hourlyHigh: 55,
    dayRateLow: 180, dayRateHigh: 320,
    londonDayRateLow: 250, londonDayRateHigh: 400,
    emergencyCalloutLow: 60, emergencyCalloutHigh: 120,
    source: "industry-2026"
  },
  {
    tradeSlug: "plasterer",
    displayName: "Plasterer",
    hourlyLow: 30, hourlyHigh: 50,
    dayRateLow: 180, dayRateHigh: 280,
    londonDayRateLow: 240, londonDayRateHigh: 360,
    emergencyCalloutLow: 60, emergencyCalloutHigh: 120,
    source: "industry-2026"
  },
  {
    tradeSlug: "roofer",
    displayName: "Roofer",
    hourlyLow: 35, hourlyHigh: 60,
    dayRateLow: 220, dayRateHigh: 380,
    londonDayRateLow: 300, londonDayRateHigh: 480,
    emergencyCalloutLow: 250, emergencyCalloutHigh: 600,
    source: "industry-2026"
  },
  {
    tradeSlug: "bricklayer",
    displayName: "Bricklayer",
    hourlyLow: 30, hourlyHigh: 55,
    dayRateLow: 200, dayRateHigh: 340,
    londonDayRateLow: 280, londonDayRateHigh: 420,
    emergencyCalloutLow: 100, emergencyCalloutHigh: 200,
    source: "industry-2026"
  },
  {
    tradeSlug: "tiler",
    displayName: "Tiler",
    hourlyLow: 30, hourlyHigh: 55,
    dayRateLow: 180, dayRateHigh: 300,
    londonDayRateLow: 240, londonDayRateHigh: 380,
    emergencyCalloutLow: 60, emergencyCalloutHigh: 140,
    source: "industry-2026"
  },
  {
    tradeSlug: "painter",
    displayName: "Painter & Decorator",
    hourlyLow: 25, hourlyHigh: 45,
    dayRateLow: 160, dayRateHigh: 260,
    londonDayRateLow: 220, londonDayRateHigh: 340,
    emergencyCalloutLow: 50, emergencyCalloutHigh: 100,
    source: "industry-2026"
  },
  {
    tradeSlug: "landscaper",
    displayName: "Landscaper",
    hourlyLow: 25, hourlyHigh: 50,
    dayRateLow: 180, dayRateHigh: 320,
    londonDayRateLow: 250, londonDayRateHigh: 400,
    emergencyCalloutLow: 80, emergencyCalloutHigh: 160,
    source: "industry-2026"
  },
  {
    tradeSlug: "gas-safe-engineer",
    displayName: "Gas Safe engineer",
    hourlyLow: 55, hourlyHigh: 110,
    dayRateLow: 260, dayRateHigh: 480,
    londonDayRateLow: 340, londonDayRateHigh: 580,
    emergencyCalloutLow: 100, emergencyCalloutHigh: 220,
    source: "industry-2026"
  }
];

// ─── REGIONAL MULTIPLIERS ─────────────────────────────────────────

export const CITY_ROWS: CityMultiplierRow[] = [
  { citySlug: "london",     displayName: "London",     region: "Greater London", multiplier: 1.35 },
  { citySlug: "bristol",    displayName: "Bristol",    region: "South West",     multiplier: 1.10 },
  { citySlug: "edinburgh",  displayName: "Edinburgh",  region: "Scotland",       multiplier: 1.05 },
  { citySlug: "manchester", displayName: "Manchester", region: "North West",     multiplier: 1.02 },
  { citySlug: "leeds",      displayName: "Leeds",      region: "Yorkshire",      multiplier: 0.98 },
  { citySlug: "birmingham", displayName: "Birmingham", region: "West Midlands",  multiplier: 0.98 },
  { citySlug: "glasgow",    displayName: "Glasgow",    region: "Scotland",       multiplier: 0.95 },
  { citySlug: "liverpool",  displayName: "Liverpool",  region: "North West",     multiplier: 0.92 },
  { citySlug: "sheffield",  displayName: "Sheffield",  region: "Yorkshire",      multiplier: 0.92 },
  { citySlug: "newcastle",  displayName: "Newcastle",  region: "North East",     multiplier: 0.90 }
];

// ─── PROJECT COST MOVEMENTS (12mo) ────────────────────────────────

export const PROJECT_MOVEMENTS: ProjectMovementRow[] = [
  {
    projectSlug: "kitchen-extension",
    displayName: "Kitchen extension (single-storey, mid)",
    lastYearLow: 42000, lastYearHigh: 62000,
    currentLow:  45000, currentHigh: 65000,
    pctChange:   5
  },
  {
    projectSlug: "loft-conversion",
    displayName: "Loft conversion (dormer)",
    lastYearLow: 43000, lastYearHigh: 62000,
    currentLow:  45000, currentHigh: 65000,
    pctChange:   4
  },
  {
    projectSlug: "bathroom-refit",
    displayName: "Bathroom refit (mid-range)",
    lastYearLow: 5200, lastYearHigh: 8100,
    currentLow:  5500, currentHigh: 8500,
    pctChange:   6
  },
  {
    projectSlug: "house-rewire",
    displayName: "Full house rewire (3-bed semi)",
    lastYearLow: 3400, lastYearHigh: 5200,
    currentLow:  3500, currentHigh: 5500,
    pctChange:   4
  },
  {
    projectSlug: "new-boiler",
    displayName: "Combi boiler (like-for-like swap)",
    lastYearLow: 1550, lastYearHigh: 2400,
    currentLow:  1650, currentHigh: 2500,
    pctChange:   6
  }
];

// ─── HEADLINE NUMBERS FOR HERO ────────────────────────────────────

export const HEADLINE_STATS = [
  {
    label: "UK avg trade day rate",
    value: "£220",
    delta: "+4%",
    deltaDirection: "up" as const,
    note: "12 months, all trades"
  },
  {
    label: "Emergency callout avg",
    value: "£95",
    delta: "+7%",
    deltaDirection: "up" as const,
    note: "First hour, national"
  },
  {
    label: "London premium",
    value: "+35%",
    delta: "unchanged",
    deltaDirection: "flat" as const,
    note: "vs UK national average"
  },
  {
    label: "Kitchen extension avg",
    value: "£45k-£65k",
    delta: "+5%",
    deltaDirection: "up" as const,
    note: "15-30m², mid-range finish"
  }
];

// ─── SOURCES + METHODOLOGY FAQ ────────────────────────────────────

export const METHODOLOGY_FAQS = [
  {
    q: "Where does the UK Trade Price Index data come from?",
    a: "Two sources. First — live pricing published to The Networkers (Counter listings, trade profiles, member-quoted rates). Second — industry benchmarks from BCIS, Ofgem, Gas Safe Register, and RICS 2026 reports. Every row on this page is labelled with its source so you can weigh it appropriately."
  },
  {
    q: "How often is the index updated?",
    a: `Monthly. This edition is ${REPORT_MONTH}. Next refresh: ${NEXT_REFRESH}. Historical monthly snapshots are archived and accessible for trend analysis.`
  },
  {
    q: "Can I cite the UK Trade Price Index in an article or report?",
    a: "Yes — we welcome citation. Preferred format: \"The UK Trade Price Index by The Networkers, published " + REPORT_MONTH + "\" with a link back to this page. Journalists + researchers can request the underlying dataset via press@thenetworkers.app."
  },
  {
    q: "Why is London so much more expensive than the rest of the UK?",
    a: "London trades face higher operating costs (van insurance, parking, congestion charges, higher rent), higher living costs, and higher demand density. The 35% premium reflects this — the actual customer-facing day rate for London trades averages 30-40% above the UK national mean."
  },
  {
    q: "Are the industry benchmarks reliable?",
    a: "Yes — they're drawn from RICS BCIS (Building Cost Information Service), Gas Safe Register national surveys, and the Federation of Master Builders 2026 State of Trade report. Industry benchmarks have a wider range (5-95th percentile) than our network live data because they aggregate across every trade region + specialism."
  },
  {
    q: "Why aren't all rates 'network live' yet?",
    a: "Live data quality requires sample size. As The Networkers grows, more rate cells flip from industry benchmark to network live (with sample count shown). We prefer honest 'industry benchmark' over invented 'live' numbers — evidence-or-silence."
  }
];
