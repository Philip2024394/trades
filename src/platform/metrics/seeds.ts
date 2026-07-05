// metricRegistry — 18 seed metrics.

import { metricRegistry } from "./registry";

const P = { name: "Xrated Trades Platform", verified: true } as const;

// ─── Leads ────────────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "quote_requests",
  name: "Quote requests",
  description: "Total quote requests received in the window.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "clipboard-list",
  category: "leads",
  defaultWindow: { days: 7, label: "7d" },
  source: { table: "studio_form_submissions", where: "purpose = 'quote-request'" },
  relevantTo: {
    trades: ["*"],
    goals: ["lead-generation", "quotes"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "callback_requests",
  name: "Callback requests",
  description: "Callback requests received in the window.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "phone-call",
  category: "leads",
  defaultWindow: { days: 7, label: "7d" },
  source: { table: "studio_form_submissions", where: "purpose = 'callback-request'" },
  relevantTo: {
    trades: ["*"],
    goals: ["bookings", "increase-conversion-rate"],
    profileFlags: ["emergency"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "website_visitors",
  name: "Website visitors",
  description: "Unique visitors to the merchant site.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "distinct",
  icon: "users",
  category: "reach",
  defaultWindow: { days: 7, label: "7d" },
  format: { compact: true },
  source: { table: "app_events", where: "event = 'page.view'" },
  relevantTo: { trades: ["*"], goals: ["brand-awareness", "lead-generation"] },
  publisher: P
});

// ─── Conversion ───────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "form_conversion_rate",
  name: "Form conversion rate",
  description: "% of visitors who submit any form.",
  version: "1.0.0",
  kind: "conversion",
  unit: "percent",
  aggregation: "average",
  icon: "target",
  category: "conversion",
  defaultWindow: { days: 7, label: "7d" },
  format: { decimals: 1 },
  relevantTo: {
    trades: ["*"],
    goals: ["increase-conversion-rate", "lead-generation"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "callback_response_time",
  name: "Callback response time",
  description: "Median time from callback request to first call.",
  version: "1.0.0",
  kind: "average",
  unit: "minutes",
  aggregation: "median",
  icon: "timer",
  category: "conversion",
  defaultWindow: { days: 7, label: "7d" },
  format: { suffix: " min" },
  relevantTo: {
    trades: ["*"],
    goals: ["bookings"],
    profileFlags: ["emergency"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "booking_conversion_rate",
  name: "Booking conversion",
  description: "% of quote requests that convert to a confirmed booking.",
  version: "1.0.0",
  kind: "conversion",
  unit: "percent",
  aggregation: "average",
  icon: "check-circle",
  category: "conversion",
  defaultWindow: { days: 30, label: "30d" },
  format: { decimals: 1 },
  relevantTo: { trades: ["*"], goals: ["bookings", "increase-conversion-rate"] },
  publisher: P
});

// ─── Revenue ──────────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "revenue_total",
  name: "Total revenue",
  description: "Sum of confirmed job values.",
  version: "1.0.0",
  kind: "counter",
  unit: "currency",
  aggregation: "sum",
  icon: "banknote",
  category: "revenue",
  defaultWindow: { days: 30, label: "30d" },
  format: { prefix: "£", compact: true, decimals: 0 },
  relevantTo: {
    trades: ["*"],
    goals: ["increase-average-job-value", "ecommerce"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "average_job_value",
  name: "Average job value",
  description: "Mean confirmed job value.",
  version: "1.0.0",
  kind: "average",
  unit: "currency",
  aggregation: "average",
  icon: "trending-up",
  category: "revenue",
  defaultWindow: { days: 30, label: "30d" },
  format: { prefix: "£", decimals: 0 },
  relevantTo: {
    trades: ["*"],
    goals: ["increase-average-job-value"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "jobs_completed",
  name: "Jobs completed",
  description: "Total jobs marked complete in the window.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "hard-hat",
  category: "operations",
  defaultWindow: { days: 30, label: "30d" },
  relevantTo: { trades: ["*"], goals: ["bookings", "operations-dashboard"] },
  publisher: P
});

// ─── Reviews ──────────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "review_score",
  name: "Review score",
  description: "Weighted average of published reviews.",
  version: "1.0.0",
  kind: "score",
  unit: "rating",
  aggregation: "average",
  icon: "star",
  category: "reviews",
  defaultWindow: { days: 90, label: "90d" },
  format: { suffix: "★", decimals: 1 },
  relevantTo: {
    trades: ["*"],
    goals: ["trust-building", "increase-reviews"]
  },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "reviews_this_month",
  name: "New reviews",
  description: "Reviews collected this calendar month.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "message-square",
  category: "reviews",
  defaultWindow: { days: 30, label: "30d" },
  relevantTo: { trades: ["*"], goals: ["increase-reviews", "trust-building"] },
  publisher: P
});

// ─── Operations ──────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "upcoming_bookings",
  name: "Upcoming bookings",
  description: "Bookings scheduled in the next 7 days.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "calendar",
  category: "operations",
  defaultWindow: { days: 7, label: "next 7d" },
  relevantTo: { trades: ["*"], goals: ["bookings", "operations-dashboard"] },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "unread_messages",
  name: "Unread messages",
  description: "Customer messages awaiting response.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "mail",
  category: "operations",
  defaultWindow: { days: 30, label: "30d" },
  relevantTo: { trades: ["*"], goals: ["operations-dashboard"] },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "jobs_pipeline_open",
  name: "Open pipeline",
  description: "Quotes/enquiries in the funnel.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "filter",
  category: "operations",
  defaultWindow: { days: 30, label: "30d" },
  relevantTo: { trades: ["*"], goals: ["operations-dashboard", "lead-generation"] },
  publisher: P
});

// ─── Content ──────────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "projects_needing_photos",
  name: "Projects needing photos",
  description: "Completed jobs still missing gallery-ready photos.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "camera",
  category: "content",
  defaultWindow: { days: 90, label: "90d" },
  relevantTo: {
    trades: ["*"],
    goals: ["portfolio-showcase", "brand-awareness"]
  },
  publisher: P
});

// ─── Customer ─────────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "repeat_customer_rate",
  name: "Repeat customer rate",
  description: "% of jobs from returning customers.",
  version: "1.0.0",
  kind: "conversion",
  unit: "percent",
  aggregation: "average",
  icon: "refresh-cw",
  category: "customer",
  defaultWindow: { days: 90, label: "90d" },
  format: { decimals: 1 },
  relevantTo: {
    trades: ["*"],
    goals: ["increase-repeat-work"]
  },
  publisher: P
});

// ─── Reach / SEO ──────────────────────────────────────────────
metricRegistry.register({
  manifestVersion: 1,
  slug: "top_town_leads",
  name: "Top town leads",
  description: "Town generating the most leads (label metric — dashboard renders as a rank list).",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "count",
  icon: "map-pin",
  category: "reach",
  defaultWindow: { days: 30, label: "30d" },
  relevantTo: { trades: ["*"], goals: ["lead-generation", "brand-awareness"] },
  publisher: P
});

metricRegistry.register({
  manifestVersion: 1,
  slug: "seo_impressions",
  name: "SEO impressions",
  description: "Total impressions in search engines.",
  version: "1.0.0",
  kind: "counter",
  unit: "count",
  aggregation: "sum",
  icon: "eye",
  category: "reach",
  defaultWindow: { days: 30, label: "30d" },
  format: { compact: true },
  relevantTo: {
    trades: ["*"],
    goals: ["brand-awareness", "lead-generation"]
  },
  publisher: P
});
