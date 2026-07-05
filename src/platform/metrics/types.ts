// metricRegistry — types.
//
// Reusable metric definitions consumed by dashboard blocks, reports,
// AI assistants, benchmarking, notifications, automation rules, and
// monthly summaries. One definition, many consumers.

export type MetricUnit =
  | "count"
  | "percent"
  | "currency"
  | "hours"
  | "minutes"
  | "days"
  | "rating"
  | "ratio";

export type MetricKind =
  | "counter"          // total count over a window
  | "rate"             // count per unit time
  | "conversion"       // conversion percent
  | "average"          // arithmetic mean
  | "score";           // 0-5 or 0-100 aggregate

export type MetricAggregation =
  | "sum"
  | "average"
  | "max"
  | "min"
  | "count"
  | "distinct"
  | "median";

export type MetricSource = {
  /** Supabase table or view. */
  table: string;
  /** Optional column to aggregate. */
  column?: string;
  /** WHERE clause fragment (safe — no user input). */
  where?: string;
  /** Optional time-window column. */
  timestampColumn?: string;
};

export type MetricManifest = {
  manifestVersion: 1;
  slug: string;
  name: string;
  description: string;
  version: string;

  kind: MetricKind;
  unit: MetricUnit;
  aggregation: MetricAggregation;

  /** Icon slug from Lucide, used by dashboard blocks. */
  icon?: string;

  /** Data source declaration. Runtime execution belongs to the
   *  analytics layer (M8+); B6 uses mock data via `mockValueFor()`. */
  source?: MetricSource;

  /** Default aggregation window. */
  defaultWindow?: {
    days: number;
    label: string;         // "7d" | "30d" | "MTD" | "YTD"
  };

  /** Formatting hints for display. */
  format?: {
    prefix?: string;
    suffix?: string;
    decimals?: number;
    currencyCode?: string;
    compact?: boolean;     // "12.3k" instead of "12,345"
  };

  /** Trades / goals this metric is especially relevant to. Used by
   *  the dashboard composer to prioritise metrics per strategy. */
  relevantTo: {
    trades: readonly string[];
    goals: readonly string[];
    profileFlags?: readonly string[];
  };

  /** Metric class — helps consumers group related metrics. */
  category:
    | "leads"
    | "conversion"
    | "revenue"
    | "operations"
    | "reviews"
    | "content"
    | "reach"
    | "customer";

  publisher?: { name: string; verified: boolean };
};

export type FrozenMetricManifest = Readonly<MetricManifest>;

/** Materialised metric value — what dashboards render. */
export type MetricValue = {
  metricSlug: string;
  raw: number;
  formatted: string;
  window: { days: number; label: string };
  delta?: {
    absolute: number;
    percent: number;
    direction: "up" | "down" | "flat";
    label: string;         // "vs prev 7d"
  };
  target?: number;
  hitTarget?: boolean;
};
