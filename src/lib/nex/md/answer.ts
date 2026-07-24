// Managing-Director answer router.
//
// Handles the "MD-level" questions the spec lists:
//   "How's my business?"        → overview
//   "What worries you?"         → priorities (warnings + alerts)
//   "What should I do first?"   → top recommendation
//   "Where am I losing money?"  → low-margin jobs + overdue payments
//   "What's my biggest opportunity?" → highest-value pipeline / opportunity
//   "Who should I call first?"  → delegate to CX (already exists)
//   "How's cash flow?"          → cash flow summary

import type { MDBriefing } from "./types";

export type MDQuestion =
  | { kind: "overview" }
  | { kind: "worries" }
  | { kind: "do_first" }
  | { kind: "losing_money" }
  | { kind: "opportunity" }
  | { kind: "cash_flow" }
  | { kind: "forecast" }
  | { kind: "workforce" }
  | { kind: "suppliers" }
  | { kind: "profit" }
  | { kind: "none" };

export function classifyMDQuestion(text: string): MDQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\b(how'?s\s+my\s+business|business\s+overview|managing\s+director)\b/.test(t)) return { kind: "overview" };
  if (/\bwhat\s+worries\s+you\b|\banything\s+i\s+should\s+worry\b/.test(t))            return { kind: "worries" };
  if (/\bwhat\s+should\s+i\s+do\s+first\b|\btoday'?s\s+priorities\b|\bwhat'?s\s+next\b/.test(t)) return { kind: "do_first" };
  if (/\bwhere\s+am\s+i\s+losing\s+money\b|\bwhich\s+jobs?\s+(are\s+)?los(e|ing)\s+money\b/.test(t)) return { kind: "losing_money" };
  if (/\bbiggest\s+opportunit\w+\b|\bwhat'?s\s+my\s+(biggest\s+)?opportunit/.test(t)) return { kind: "opportunity" };
  if (/\bcash\s?flow\b|\bhow'?s\s+cash\b/.test(t))                                    return { kind: "cash_flow" };
  if (/\bforecast\b|\bnext\s+month'?s?\s+revenue\b|\bpredict/.test(t))                return { kind: "forecast" };
  if (/\bworkforce\b|\bwho'?s\s+working\b|\butilisation\b|\bcapacity\b/.test(t))      return { kind: "workforce" };
  if (/\bsuppliers?\b|\bwho\s+do\s+i\s+buy\s+from\b/.test(t))                          return { kind: "suppliers" };
  if (/\bprofit\b|\bmargin\b/.test(t))                                                 return { kind: "profit" };

  return { kind: "none" };
}

export function answerMD(q: MDQuestion, b: MDBriefing): string {
  switch (q.kind) {
    case "overview":     return overviewReply(b);
    case "worries":      return worriesReply(b);
    case "do_first":     return doFirstReply(b);
    case "losing_money": return losingMoneyReply(b);
    case "opportunity":  return opportunityReply(b);
    case "cash_flow":    return cashFlowReply(b);
    case "forecast":     return forecastReply(b);
    case "workforce":    return workforceReply(b);
    case "suppliers":    return suppliersReply(b);
    case "profit":       return profitReply(b);
    case "none":         return "";
  }
}

// ─── Reply builders ─────────────────────────────────────────────

function gbp(pence: number | null): string {
  if (pence === null) return "£—";
  return `£${(pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function overviewReply(b: MDBriefing): string {
  const lines: string[] = [];
  lines.push(b.health.headline);
  lines.push("");
  const cf = b.cashflow;
  if (cf.outstanding_now_pence > 0) lines.push(`- Outstanding right now: ${gbp(cf.outstanding_now_pence)}${cf.overdue_now_pence > 0 ? ` (${gbp(cf.overdue_now_pence)} overdue)` : ""}.`);
  if (cf.pipeline_weighted_pence > 0) lines.push(`- Weighted pipeline: ${gbp(cf.pipeline_weighted_pence)}.`);
  if (b.profit.jobs.length > 0)     lines.push(`- Booked ${b.profit.jobs.length} job${b.profit.jobs.length === 1 ? "" : "s"} at ${b.profit.totals.weighted_margin_pct}% weighted margin.`);
  if (b.workforce.utilisation_note) lines.push(`- ${b.workforce.utilisation_note}`);
  if (b.priorities.length > 0) {
    lines.push("");
    lines.push("Top of the list:");
    for (const p of b.priorities.slice(0, 3)) lines.push(`- ${p.headline}`);
  }
  return lines.join("\n");
}

function worriesReply(b: MDBriefing): string {
  const worries = b.priorities.filter((p) => p.severity === "alert" || p.severity === "warning");
  if (worries.length === 0) return "Nothing worrying at the moment.";
  const lines = ["Here's what's on the worry list:"];
  for (const w of worries.slice(0, 6)) lines.push(`- ${w.headline}${w.detail ? ` — ${w.detail}` : ""}`);
  return lines.join("\n");
}

function doFirstReply(b: MDBriefing): string {
  if (b.recommendations.length === 0) return "Nothing urgent on the list. Good moment to reach out to a quiet customer or refresh a canteen post.";
  const lines = ["Do first:"];
  for (const r of b.recommendations.slice(0, 3)) lines.push(`- ${r.action} — because: ${r.reason}`);
  return lines.join("\n");
}

function losingMoneyReply(b: MDBriefing): string {
  const parts: string[] = [];
  if (b.profit.low_margin_jobs.length > 0) {
    parts.push(`${b.profit.low_margin_jobs.length} accepted job${b.profit.low_margin_jobs.length === 1 ? "" : "s"} priced below your ${b.profit.target_margin_pct}% target margin:`);
    for (const j of b.profit.low_margin_jobs.slice(0, 5)) parts.push(`- ${j.title} — ${j.margin_pct_planned}% margin (${gbp(j.estimated_total_pence)})`);
  }
  if (b.cashflow.overdue_now_pence > 0) {
    parts.push("");
    parts.push(`Overdue money on the ledger: ${gbp(b.cashflow.overdue_now_pence)}.`);
  }
  if (parts.length === 0) return "No obvious loss-makers on the visible data.";
  return parts.join("\n");
}

function opportunityReply(b: MDBriefing): string {
  const bits: string[] = [];
  if (b.cashflow.pipeline_weighted_pence > 0) {
    bits.push(`Quoted pipeline (probability-weighted) at ${gbp(b.cashflow.pipeline_weighted_pence)} — closing more of it is the biggest short-term win.`);
  }
  const infoPriorities = b.priorities.filter((p) => p.severity === "info");
  if (infoPriorities.length > 0) {
    bits.push(`Also worth noting: ${infoPriorities[0].headline}`);
  }
  if (b.forecast.next_30d_revenue_pence !== null) {
    bits.push(`Next 30 days revenue estimate: ${gbp(b.forecast.next_30d_revenue_pence)}.`);
  }
  return bits.length === 0 ? "Not enough signal to name a biggest opportunity yet." : bits.join("\n\n");
}

function cashFlowReply(b: MDBriefing): string {
  const cf = b.cashflow;
  const lines = [
    `Cash-flow snapshot (money-in only — expense tracking not yet wired):`,
    `- Outstanding: ${gbp(cf.outstanding_now_pence)}${cf.overdue_now_pence > 0 ? ` (${gbp(cf.overdue_now_pence)} overdue)` : ""}.`,
    `- Weighted pipeline: ${gbp(cf.pipeline_weighted_pence)}.`,
    `- Next 30 days net: ${gbp(cf.buckets[0]?.net_pence ?? 0)}.`,
    `- Next 60 days net: ${gbp(cf.buckets[1]?.net_pence ?? 0)}.`,
    `- Next 90 days net: ${gbp(cf.buckets[2]?.net_pence ?? 0)}.`
  ];
  if (cf.warnings.length > 0) { lines.push(""); lines.push(`Warnings:`); for (const w of cf.warnings) lines.push(`- ${w}`); }
  return lines.join("\n");
}

function forecastReply(b: MDBriefing): string {
  const f = b.forecast;
  const lines: string[] = [];
  if (f.next_30d_revenue_pence !== null) lines.push(`Estimated next-30-day revenue: ${gbp(f.next_30d_revenue_pence)}.`);
  if (f.monthly_avg_pence !== null)      lines.push(`6-month monthly average: ${gbp(f.monthly_avg_pence)}.`);
  if (f.best_day_of_week)                lines.push(`Best day of the week for profile views: ${f.best_day_of_week}.`);
  if (f.seasonality_notes.length > 0) {
    if (lines.length > 0) lines.push("");
    for (const n of f.seasonality_notes) lines.push(`- ${n}`);
  }
  return lines.length === 0 ? "Not enough historical data to forecast yet." : lines.join("\n");
}

function workforceReply(b: MDBriefing): string {
  const w = b.workforce;
  const lines = [
    w.utilisation_note,
    `- Active projects: ${w.active_projects_count}.`,
    `- Hours logged (last 30 days): ${w.hours_last_30d}.`,
    `- Bookings in the next 14 days: ${w.bookings_next_14d}.`
  ];
  for (const warn of w.warnings) lines.push(`- ${warn}`);
  return lines.join("\n");
}

function suppliersReply(b: MDBriefing): string {
  const s = b.suppliers;
  if (s.suppliers.length === 0) return "No supplier spend recorded on the ledger — add costs with kind=supplier or materials to build the picture.";
  const lines = [`Suppliers by spend (last ${s.window_days} days, total ${gbp(s.total_spend_pence)}):`];
  for (const r of s.suppliers.slice(0, 6)) lines.push(`- ${r.supplier_key} — ${gbp(r.spend_pence)} across ${r.cost_count} cost${r.cost_count === 1 ? "" : "s"}`);
  return lines.join("\n");
}

function profitReply(b: MDBriefing): string {
  const p = b.profit;
  if (p.jobs.length === 0) return "No accepted quotes on record yet, so no profit picture to report. " + (p.warnings.at(-1) ?? "");
  const lines = [
    `Booked ${p.jobs.length} job${p.jobs.length === 1 ? "" : "s"}: ${gbp(p.totals.quoted_pence)} quoted, planned profit ${gbp(p.totals.planned_profit_pence)} (${p.totals.weighted_margin_pct}% weighted margin, target ${p.target_margin_pct}%).`
  ];
  if (p.low_margin_jobs.length > 0) {
    lines.push("");
    lines.push(`${p.low_margin_jobs.length} below your target margin:`);
    for (const j of p.low_margin_jobs.slice(0, 5)) lines.push(`- ${j.title} @ ${j.margin_pct_planned}%`);
  }
  // Always surface the honest caveat.
  const lastWarn = p.warnings[p.warnings.length - 1];
  if (lastWarn) { lines.push(""); lines.push(lastWarn); }
  return lines.join("\n");
}
