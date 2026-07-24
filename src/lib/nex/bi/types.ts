// Nex Business Intelligence — contracts.
//
// Every BI adapter reports one domain (projects, invoices, reviews, …).
// The engine runs all adapters in parallel, aggregates the sub-scores
// into an overall Business Health, and folds the observations into the
// morning briefing and the "how's business" answer path.
//
// Evidence-or-silence: every metric carries the query source so Nex
// can point at where the number came from. If an adapter can't compute
// a metric, it returns null (never a fabricated fallback).

export type DomainKey =
  | "projects"
  | "quotations"
  | "invoices"
  | "customers"
  | "calendar"
  | "leads"
  | "marketing"
  | "marketplace"
  | "social"
  | "sitebook"
  | "reviews"
  | "products"
  | "purchases"
  | "time"
  | "expenses"
  | "knowledge"
  | "backup";

/** Where a number came from — every displayed fact needs one. */
export type Evidence = {
  /** Human-readable source, e.g. "hammerex_orders (status=paid)". */
  source:       string;
  /** Which table(s) or endpoint the number was computed from. */
  tables:       string[];
  /** ISO timestamp when the query ran. */
  computed_at:  string;
  /** Optional deep-link to the raw records for the merchant to inspect. */
  evidence_url?: string;
};

/** A single KPI with its evidence chain. */
export type Metric = {
  key:      string;                          // "revenue_gbp" | "quote_conversion_pct"
  label:    string;                          // "Revenue" | "Quote conversion"
  value:    number | null;                   // null = insufficient data
  unit:     "gbp" | "pct" | "count" | "days" | "hours" | "score";
  /** Prior-period value for the same lookback window (for trend). */
  prior?:   number | null;
  /** Direction that counts as "good" — used when computing sub-score. */
  direction: "higher_is_better" | "lower_is_better" | "neutral";
  evidence: Evidence;
};

/** Something Nex noticed that the owner might want mentioned. */
export type Observation = {
  /** Stable key so the same finding doesn't get reported twice. */
  key:       string;
  domain:    DomainKey;
  severity:  "info" | "notice" | "warning" | "alert";
  /** One-line sentence, briefing-ready. Ends with a full stop. */
  headline:  string;
  /** Optional deeper context if the user asks for detail. */
  detail?:   string;
  /** Optional recommended next action. */
  action?:   { label: string; href: string };
  evidence:  Evidence;
};

/** What every adapter returns. */
export type DomainMetrics = {
  domain:       DomainKey;
  label:        string;                      // "Projects" | "Invoices"
  /** 0–100. null = adapter had no data for this merchant yet. */
  sub_score:    number | null;
  /** Weight this domain carries in the overall health score (0–1). */
  weight:       number;
  metrics:      Metric[];
  observations: Observation[];
  /** Set when the adapter threw. Metric list will be empty. */
  error?:       string;
};

/** The adapter contract. */
export type BIAdapterContext = {
  merchantSlug: string;
  /** Rolling window for the "now" values (default 30 days). */
  lookbackDays: number;
  /** Optional pinned "now" for deterministic tests. */
  now?:         Date;
};

export type BIAdapter = {
  domain:  DomainKey;
  label:   string;
  weight:  number;                           // default 1; higher = more weight in health
  /** Never throws — engine wraps it. Returns null-metrics on missing data. */
  run:     (ctx: BIAdapterContext) => Promise<DomainMetrics>;
};

/** Overall business health snapshot — the "how's business?" reply. */
export type BusinessHealth = {
  score:        number;                      // 0–100
  band:         "excellent" | "healthy" | "steady" | "attention" | "critical";
  headline:     string;                      // "Business Health: 91%. Steady."
  domains:      DomainMetrics[];             // sorted by weight desc, then label
  observations: Observation[];               // union of all domain observations, sorted by severity
  computed_at:  string;
  /** Adapters that failed (name + error). Engine surfaces these so we
   *  never silently pretend the score is complete. */
  errors:       Array<{ domain: DomainKey; error: string }>;
};

/** Helper for adapters — build an evidence stamp with today's timestamp. */
export function evidenceFor(source: string, tables: string[], evidence_url?: string): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString(),
    evidence_url
  };
}
