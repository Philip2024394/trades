// "How's business?" answer router.
//
// Detects business-intelligence questions and turns a BusinessHealth
// snapshot into a plain-English reply. Never invents numbers — if a
// metric is null, Nex says so instead of fabricating.
//
// Voice: Nex — Northern UK, direct, brief. No AI jargon. No emojis.

import type { BusinessHealth, DomainMetrics, Metric } from "./types";

/** Question classes Nex can answer straight from a snapshot. */
export type BIQuestion =
  | { kind: "overall_health" }
  | { kind: "revenue"; period: "this_period" | "prior" }
  | { kind: "profit" }
  | { kind: "outstanding" }
  | { kind: "conversion" }
  | { kind: "leads" }
  | { kind: "reviews" }
  | { kind: "social" }
  | { kind: "best_trade" }
  | { kind: "response_time" }
  | { kind: "recommendations" }
  | { kind: "none" };

/** Route a raw user utterance to a business-intelligence question. */
export function classifyBIQuestion(text: string): BIQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  // Order matters — most specific first.
  if (/\b(how'?s\s+business|business\s+health|health\s+score|overall\s+health)\b/.test(t)) return { kind: "overall_health" };
  if (/\bwhat.*(recommend|should\s+i\s+improve|what\s+to\s+work\s+on)\b/.test(t)) return { kind: "recommendations" };
  if (/\bwhich\s+trade\s+earns\s+me\s+the\s+most\b/.test(t) || /\bbest[-\s]?paid\s+trade\b/.test(t)) return { kind: "best_trade" };
  if (/\bwho\s+owes\s+me\b|\boutstanding\b|\bunpaid\b|\bawaiting\s+(payment|reply)\b/.test(t)) return { kind: "outstanding" };
  if (/\bconversion\b|\bquote\s+(rate|conversion)\b|\bwin\s+rate\b/.test(t)) return { kind: "conversion" };
  if (/\bresponse\s+(time|rate)\b|\bhow\s+quickly\s+do\s+i\s+reply\b/.test(t)) return { kind: "response_time" };
  if (/\brevenue\b|\bturnover\b|\bincome\b|\btake(\s|home)|\bearned?\b|\bmoney\s+(in|made)\b|\bhow\s+much\s+did\s+i\s+make\b/.test(t)) {
    return { kind: "revenue", period: /\blast\s+(month|period)\b/.test(t) ? "prior" : "this_period" };
  }
  if (/\bprofit\b|\bmargin\b/.test(t)) return { kind: "profit" };
  if (/\bleads?\b|\benquir\w+\b/.test(t)) return { kind: "leads" };
  if (/\breviews?\b|\brating\b/.test(t)) return { kind: "reviews" };
  if (/\bsocial\b|\bposts?\b|\bfacebook\b|\binstagram\b|\bmarketing\b/.test(t)) return { kind: "social" };

  return { kind: "none" };
}

/** Turn a BusinessHealth snapshot into Nex's reply for a given question. */
export function answerBIQuestion(question: BIQuestion, snapshot: BusinessHealth): string {
  switch (question.kind) {
    case "overall_health":    return overallHealthReply(snapshot);
    case "revenue":           return revenueReply(snapshot, question.period);
    case "profit":            return profitReply(snapshot);
    case "outstanding":       return outstandingReply(snapshot);
    case "conversion":        return conversionReply(snapshot);
    case "leads":             return domainReply(snapshot, "leads",   "your leads");
    case "reviews":           return domainReply(snapshot, "reviews", "your reviews");
    case "social":            return domainReply(snapshot, "social",  "your social & marketing");
    case "best_trade":        return bestTradeReply(snapshot);
    case "response_time":     return responseTimeReply(snapshot);
    case "recommendations":   return recommendationsReply(snapshot);
    case "none":              return "";
  }
}

// ─── Reply builders ──────────────────────────────────────────────

function overallHealthReply(s: BusinessHealth): string {
  const lines: string[] = [s.headline];
  const notable = s.observations.slice(0, 3);
  if (notable.length > 0) {
    lines.push("");
    for (const o of notable) lines.push(`- ${o.headline}`);
  }
  const weakest = [...s.domains].filter((d) => d.sub_score !== null).sort((a, b) => (a.sub_score as number) - (b.sub_score as number))[0];
  if (weakest) {
    lines.push("");
    lines.push(`Weakest area: ${weakest.label} (${weakest.sub_score}%). Ask me "what should I improve?" for the next step.`);
  }
  return lines.join("\n");
}

function revenueReply(s: BusinessHealth, period: "this_period" | "prior"): string {
  const inv = domain(s, "invoices");
  if (!inv) return "I don't have revenue data yet.";
  const rev = metric(inv, "revenue_gbp");
  if (!rev || rev.value === null) return "No booked revenue in the current period.";
  const value = fmtGbp(rev.value);
  if (period === "prior" && rev.prior !== undefined && rev.prior !== null) {
    return `Last period you booked ${fmtGbp(rev.prior)}. This period you're at ${value}.`;
  }
  const trend = rev.prior !== undefined && rev.prior !== null && rev.prior > 0
    ? ` That's ${diffPct(rev.value, rev.prior)} versus the previous period.`
    : "";
  return `Booked revenue: ${value}.${trend}`;
}

function profitReply(_s: BusinessHealth): string {
  // No expense/cost source in the current data — evidence-or-silence.
  return "I can't calculate profit yet. Nothing on the system captures your costs (materials, labour, expenses). Once you record those we can produce a real number.";
}

function outstandingReply(s: BusinessHealth): string {
  const inv = domain(s, "invoices");
  if (!inv) return "Nothing outstanding on record.";
  const out  = metric(inv, "outstanding_gbp");
  const late = metric(inv, "overdue_gbp");
  const lines: string[] = [];
  if (out && out.value !== null) lines.push(`Outstanding across sent quotes and inbox replies: ${fmtGbp(out.value)}.`);
  if (late && late.value !== null && late.value > 0) lines.push(`Of that, ${fmtGbp(late.value)} has passed its expiry with no reply.`);
  if (lines.length === 0) return "Nothing outstanding on record.";
  lines.push("");
  lines.push("Want me to draft chase-up messages?");
  return lines.join("\n");
}

function conversionReply(s: BusinessHealth): string {
  const q = domain(s, "quotations");
  const conv = q ? metric(q, "conversion_pct") : null;
  if (!conv || conv.value === null) return "Not enough quotes sent yet to measure conversion.";
  const trend = conv.prior !== undefined && conv.prior !== null
    ? ` (was ${conv.prior}% the previous period)`
    : "";
  return `Quote conversion: ${conv.value}%${trend}.`;
}

function domainReply(s: BusinessHealth, key: DomainMetrics["domain"], label: string): string {
  const d = domain(s, key);
  if (!d || d.sub_score === null) return `No ${label} data on file yet.`;
  const lines: string[] = [`${d.label}: ${d.sub_score}%.`];
  for (const m of d.metrics.slice(0, 4)) {
    if (m.value === null) continue;
    lines.push(`- ${m.label}: ${fmtMetric(m)}`);
  }
  return lines.join("\n");
}

function bestTradeReply(s: BusinessHealth): string {
  const leads = domain(s, "leads");
  const topLead = leads?.observations.find((o) => o.key === "leads_top_trade");
  if (topLead) return topLead.headline;
  return "Not enough enquiry data to pick a top trade yet.";
}

function responseTimeReply(s: BusinessHealth): string {
  const leads = domain(s, "leads");
  const r = leads ? metric(leads, "response_rate") : null;
  if (!r || r.value === null) return "Not enough inbox activity to measure response rate.";
  return `Reply rate on inbox enquiries: ${r.value}%.`;
}

function recommendationsReply(s: BusinessHealth): string {
  const actionable = s.observations
    .filter((o) => o.severity === "warning" || o.severity === "alert")
    .slice(0, 5);
  if (actionable.length === 0) {
    // Fall back to the weakest domain.
    const weakest = [...s.domains].filter((d) => d.sub_score !== null).sort((a, b) => (a.sub_score as number) - (b.sub_score as number))[0];
    if (!weakest) return "Nothing to flag right now.";
    return `The area with the most room to improve is ${weakest.label} (${weakest.sub_score}%). Ask me "how are my ${weakest.label.toLowerCase()}?" for the detail.`;
  }
  const lines = ["Here's what I'd tackle first:"];
  for (const o of actionable) {
    lines.push(`- ${o.headline}${o.action ? ` → ${o.action.label}` : ""}`);
  }
  return lines.join("\n");
}

// ─── Formatting helpers ──────────────────────────────────────────

function domain(s: BusinessHealth, key: DomainMetrics["domain"]): DomainMetrics | null {
  return s.domains.find((d) => d.domain === key) ?? null;
}

function metric(d: DomainMetrics, key: string): Metric | null {
  return d.metrics.find((m) => m.key === key) ?? null;
}

function fmtGbp(v: number): string {
  return `£${v.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function fmtMetric(m: Metric): string {
  if (m.value === null) return "no data";
  switch (m.unit) {
    case "gbp":   return fmtGbp(m.value);
    case "pct":   return `${m.value}%`;
    case "days":  return `${m.value} days`;
    case "hours": return `${m.value} hours`;
    case "score": return `${m.value}`;
    case "count": return `${m.value.toLocaleString("en-GB")}`;
  }
}

function diffPct(current: number, prior: number): string {
  const pct = ((current - prior) / prior) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) return "flat";
  return rounded > 0 ? `up ${rounded}%` : `down ${Math.abs(rounded)}%`;
}
