// Weekly report — Monday morning long-form summary.
//
// Same underlying snapshot as the briefing, but formatted as a
// structured report the owner can skim. Every section is derived
// from real adapter output — nothing invented.

import { buildBusinessSnapshot } from "../engine";
import type { BusinessHealth, DomainMetrics, Metric, Observation } from "../types";

export type WeeklyReport = {
  merchantSlug:      string;
  generated_at:      string;
  headline:          string;                    // "Business Health: 91%. Healthy."
  summary:           string;                    // 1-paragraph overview
  achievements:      string[];                  // 'info' observations
  attention:         string[];                  // 'warning' + 'alert' observations
  financial:         DomainMetrics | null;
  marketing:         DomainMetrics | null;
  customer:          DomainMetrics | null;      // reviews stand-in
  project:           DomainMetrics | null;
  actions:           string[];                  // top action bullets from observations
  health_estimate:   { score: number; band: BusinessHealth["band"] };
};

export async function buildWeeklyReport(merchantSlug: string, now?: Date): Promise<WeeklyReport> {
  const snapshot = await buildBusinessSnapshot({ merchantSlug, lookbackDays: 7, now, refresh: true });

  const achievements = snapshot.observations
    .filter((o) => o.severity === "info")
    .map((o) => o.headline);
  const attention = snapshot.observations
    .filter((o) => o.severity === "warning" || o.severity === "alert")
    .map((o) => o.headline);
  const actions = snapshot.observations
    .filter((o) => !!o.action)
    .slice(0, 5)
    .map((o) => `${o.headline} → ${o.action!.label}`);

  const summary = writeSummary(snapshot);
  return {
    merchantSlug,
    generated_at:    snapshot.computed_at,
    headline:        snapshot.headline,
    summary,
    achievements,
    attention,
    financial:       findDomain(snapshot, "invoices"),
    marketing:       findDomain(snapshot, "social"),
    customer:        findDomain(snapshot, "reviews"),
    project:         findDomain(snapshot, "projects"),
    actions,
    health_estimate: { score: snapshot.score, band: snapshot.band }
  };
}

function findDomain(s: BusinessHealth, key: DomainMetrics["domain"]): DomainMetrics | null {
  return s.domains.find((d) => d.domain === key) ?? null;
}

function writeSummary(s: BusinessHealth): string {
  const parts: string[] = [];
  const rev = metric(findDomain(s, "invoices"), "revenue_gbp");
  if (rev && rev.value !== null) {
    parts.push(`Booked £${rev.value.toLocaleString("en-GB")} this week.`);
  }
  const leads = metric(findDomain(s, "leads"), "leads_in");
  if (leads && leads.value !== null) {
    parts.push(`${leads.value} enquiries received.`);
  }
  const quotes = metric(findDomain(s, "quotations"), "quotes_sent");
  if (quotes && quotes.value !== null) {
    parts.push(`${quotes.value} quotes sent.`);
  }
  const projects = metric(findDomain(s, "projects"), "projects_completed");
  if (projects && projects.value !== null && projects.value > 0) {
    parts.push(`${projects.value} project${projects.value === 1 ? "" : "s"} completed.`);
  }
  if (parts.length === 0) return "Not enough activity this week to summarise. Add jobs, quotes and posts and next Monday's report will fill out.";
  return parts.join(" ");
}

function metric(d: DomainMetrics | null, key: string): Metric | null {
  if (!d) return null;
  return d.metrics.find((m) => m.key === key) ?? null;
}

/** Plain-text render of the report — suitable for email or chat. */
export function weeklyReportToText(r: WeeklyReport): string {
  const lines: string[] = [];
  lines.push(`Weekly business report — ${r.generated_at.slice(0, 10)}`);
  lines.push("");
  lines.push(r.headline);
  lines.push("");
  lines.push(r.summary);
  if (r.achievements.length > 0) {
    lines.push("");
    lines.push("Achievements:");
    for (const a of r.achievements) lines.push(`- ${a}`);
  }
  if (r.attention.length > 0) {
    lines.push("");
    lines.push("Needs attention:");
    for (const a of r.attention) lines.push(`- ${a}`);
  }
  if (r.actions.length > 0) {
    lines.push("");
    lines.push("Recommended actions:");
    for (const a of r.actions) lines.push(`- ${a}`);
  }
  return lines.join("\n");
}
