// Monthly report — end-of-month long-form review.
//
// Extends the weekly report with a 30-day rolling comparison and a
// trade-breakdown section. Uses the same adapter output — never
// re-queries the DB. Charts are prepared as data series the UI can
// render however it likes (Recharts, ASCII, spark-lines, …).

import { buildBusinessSnapshot } from "../engine";
import type { BusinessHealth, DomainMetrics, Metric, Observation } from "../types";

export type MonthlyReport = {
  merchantSlug:  string;
  generated_at:  string;
  headline:      string;
  summary:       string;
  revenue:       { current: number | null; prior: number | null; change_pct: number | null };
  leads:         { current: number | null; prior: number | null; change_pct: number | null };
  quotes:        { current: number | null; prior: number | null; change_pct: number | null };
  projects:      { current: number | null; prior: number | null; change_pct: number | null };
  reviews:       { count: number | null; avg_rating: number | null };
  most_profitable_service: string | null;
  weakest_area:            { label: string; sub_score: number } | null;
  recommendations:         string[];
  chart_series:            Array<{ metric: string; current: number | null; prior: number | null }>;
  health_estimate:         { score: number; band: BusinessHealth["band"] };
};

export async function buildMonthlyReport(merchantSlug: string, now?: Date): Promise<MonthlyReport> {
  const snapshot = await buildBusinessSnapshot({ merchantSlug, lookbackDays: 30, now, refresh: true });

  const inv     = findDomain(snapshot, "invoices");
  const leads   = findDomain(snapshot, "leads");
  const quotes  = findDomain(snapshot, "quotations");
  const projs   = findDomain(snapshot, "projects");
  const reviews = findDomain(snapshot, "reviews");
  const leadsObs = leads?.observations.find((o) => o.key === "leads_top_trade");

  const revMetric   = metric(inv, "revenue_gbp");
  const leadsMetric = metric(leads, "leads_in");
  const qMetric     = metric(quotes, "quotes_sent");
  const pMetric     = metric(projs, "projects_completed");
  const rCount      = metric(reviews, "reviews_live");
  const rRating     = metric(reviews, "avg_rating");

  const weakest = [...snapshot.domains]
    .filter((d) => d.sub_score !== null)
    .sort((a, b) => (a.sub_score as number) - (b.sub_score as number))[0] ?? null;

  const recommendations = snapshot.observations
    .filter((o) => o.severity === "warning" || o.severity === "alert")
    .slice(0, 8)
    .map((o) => o.headline);

  return {
    merchantSlug,
    generated_at:  snapshot.computed_at,
    headline:      snapshot.headline,
    summary:       writeSummary(snapshot),
    revenue:       compare(revMetric),
    leads:         compare(leadsMetric),
    quotes:        compare(qMetric),
    projects:      compare(pMetric),
    reviews: {
      count:      rCount?.value ?? null,
      avg_rating: rRating?.value ?? null
    },
    most_profitable_service: leadsObs?.headline ?? null,
    weakest_area:            weakest ? { label: weakest.label, sub_score: weakest.sub_score as number } : null,
    recommendations,
    chart_series: [
      { metric: "revenue_gbp",     current: revMetric?.value ?? null,   prior: revMetric?.prior ?? null },
      { metric: "leads_in",        current: leadsMetric?.value ?? null, prior: leadsMetric?.prior ?? null },
      { metric: "quotes_sent",     current: qMetric?.value ?? null,     prior: qMetric?.prior ?? null },
      { metric: "projects_completed", current: pMetric?.value ?? null,  prior: pMetric?.prior ?? null }
    ],
    health_estimate: { score: snapshot.score, band: snapshot.band }
  };
}

function findDomain(s: BusinessHealth, key: DomainMetrics["domain"]): DomainMetrics | null {
  return s.domains.find((d) => d.domain === key) ?? null;
}

function metric(d: DomainMetrics | null, key: string): Metric | null {
  if (!d) return null;
  return d.metrics.find((m) => m.key === key) ?? null;
}

function compare(m: Metric | null): { current: number | null; prior: number | null; change_pct: number | null } {
  if (!m) return { current: null, prior: null, change_pct: null };
  const current = m.value;
  const prior   = m.prior ?? null;
  let change: number | null = null;
  if (current !== null && prior !== null && prior > 0) {
    change = Number((((current - prior) / prior) * 100).toFixed(1));
  }
  return { current, prior, change_pct: change };
}

function writeSummary(s: BusinessHealth): string {
  const parts: string[] = [];
  const rev = metric(findDomain(s, "invoices"), "revenue_gbp");
  if (rev && rev.value !== null) {
    const trend = rev.prior !== undefined && rev.prior !== null && rev.prior > 0
      ? ` (${rev.value > rev.prior ? "up" : "down"} ${Math.abs(Math.round(((rev.value - rev.prior) / rev.prior) * 100))}%)`
      : "";
    parts.push(`Booked £${rev.value.toLocaleString("en-GB")}${trend}.`);
  }
  const leads = metric(findDomain(s, "leads"), "leads_in");
  if (leads && leads.value !== null) parts.push(`${leads.value} enquiries received.`);
  const projects = metric(findDomain(s, "projects"), "projects_completed");
  if (projects && projects.value !== null) parts.push(`${projects.value} project${projects.value === 1 ? "" : "s"} completed.`);
  if (parts.length === 0) return "Not enough activity this month to summarise.";
  return parts.join(" ");
}
