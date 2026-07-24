// Project-scoped answer router.
//
// classifyProjectQuestion() detects a project-scoped question and
// returns the shape of intent it represents. answerProjectQuestion()
// takes an intent + a snapshot and produces the plain-English reply.
//
// Rules from SiteBook v2.2 blueprint:
//   • Questions, not features — replies answer ONE question in plain
//     English; never expose "Documents System" labels.
//   • Replace work, not create work — if there's nothing to say we
//     say so honestly instead of padding.
//   • Evidence-or-silence — every number we mention has a source in
//     the snapshot; if the metric is null we say we don't know.

import type { ProjectSnapshot, AspectMetrics, Metric } from "./types";

export type PIQuestion =
  | { kind: "overview" }
  | { kind: "photos" }
  | { kind: "spend" }
  | { kind: "outstanding" }
  | { kind: "budget" }
  | { kind: "materials" }
  | { kind: "labour" }
  | { kind: "who_paid"; who?: string }
  | { kind: "timeline"; period: "today" | "yesterday" | "recent" }
  | { kind: "team" }
  | { kind: "questions_open" }
  | { kind: "snags" }
  | { kind: "variations" }
  | { kind: "risks" }
  | { kind: "completion" }
  | { kind: "documents"; category?: string }
  | { kind: "none" };

export function classifyProjectQuestion(text: string): PIQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  // Most-specific first. Photo/document/timeline keywords beat overview
  // because "show me kitchen photos" is a photo question, not an overview.
  if (/\b(show|view|see|open)\b.*\bphotos?\b/.test(t))                   return { kind: "photos" };
  if (/\btoday'?s\s+(jobs?|activity|progress|site diary)\b/.test(t))     return { kind: "timeline", period: "today" };
  if (/\byesterday'?s?\b|\bwhat\s+happened\s+yesterday\b/.test(t))       return { kind: "timeline", period: "yesterday" };
  if (/\bhow'?s\s+(my|the)\s+(project|extension|build|house)\b/.test(t)) return { kind: "overview" };
  if (/\b(show|open|tell me about|everything about)\b/.test(t) && /\b(project|extension|renovation|build)\b/.test(t)) {
    return { kind: "overview" };
  }
  if (/\bhave\s+we\s+paid\s+(the\s+)?(\w+)/.test(t)) {
    const m = t.match(/\bhave\s+we\s+paid\s+(the\s+)?(\w+)/);
    return { kind: "who_paid", who: m?.[2] };
  }
  if (/\bhow\s+much\s+(have|has)\s+.*\s+spent\b|\btotal\s+spend\b|\bwhat\s+have\s+we\s+spent\b/.test(t)) return { kind: "spend" };
  if (/\bhas\s+the\s+customer\s+paid\b|\bwho\s+owes\b|\bwhat'?s\s+outstanding\b|\boutstanding\s+(payment|amount)\b/.test(t)) return { kind: "outstanding" };
  if (/\bbudget\b/.test(t))                                              return { kind: "budget" };
  if (/\bmaterials?\b/.test(t))                                          return { kind: "materials" };
  if (/\blabou?r\b|\bworked\b/.test(t))                                  return { kind: "labour" };
  if (/\bteam\b|\bwho'?s\s+on\s+(the\s+)?(project|site|job)\b/.test(t)) return { kind: "team" };
  if (/\bopen\s+questions?\b|\bany\s+questions?\b/.test(t))              return { kind: "questions_open" };
  if (/\bsnags?\b|\bthings\s+to\s+fix\b|\bwhat'?s\s+left\s+to\s+do\b/.test(t)) return { kind: "snags" };
  if (/\bvariations?\b|\bchange\s+order\b|\bextras\b/.test(t))          return { kind: "variations" };
  if (/\brisks?\b|\bwhat\s+could\s+go\s+wrong\b/.test(t))                return { kind: "risks" };
  if (/\bwhen\s+is\s+completion\b|\bcompletion\s+date\b|\bfinished\b/.test(t)) return { kind: "completion" };
  if (/\breceipts?\b/.test(t))                                          return { kind: "documents", category: "receipt" };
  if (/\binvoices?\b/.test(t))                                          return { kind: "documents", category: "invoice" };
  if (/\bquotes?\b/.test(t))                                            return { kind: "documents", category: "quote" };
  if (/\bcertificates?\b|\bdrawings?\b|\bplans?\b|\bdocuments?\b/.test(t)) return { kind: "documents" };

  return { kind: "none" };
}

export function answerProjectQuestion(q: PIQuestion, s: ProjectSnapshot): string {
  switch (q.kind) {
    case "overview":         return overviewReply(s);
    case "timeline":         return timelineReply(s, q.period);
    case "photos":           return photosReply(s);
    case "spend":            return spendReply(s);
    case "outstanding":      return outstandingReply(s);
    case "budget":           return budgetReply(s);
    case "materials":        return kindReply(s, "materials");
    case "labour":           return kindReply(s, "labour");
    case "who_paid":         return whoPaidReply(s, q.who);
    case "team":             return teamReply(s);
    case "questions_open":   return questionsReply(s);
    case "snags":            return snagsReply(s);
    case "variations":       return variationsReply(s);
    case "risks":            return risksReply(s);
    case "completion":       return completionReply(s);
    case "documents":        return documentsReply(s, q.category);
    case "none":             return "";
  }
}

// ─── Reply builders ─────────────────────────────────────────────

function overviewReply(s: ProjectSnapshot): string {
  const lines: string[] = [];
  lines.push(`${s.project.title}${s.project.address_city ? `, ${s.project.address_city}` : ""} — ${s.health.headline}`);
  const summary: string[] = [];
  const spend = numMetric(s, "costs", "paid_gbp");
  if (spend !== null) summary.push(`Spent £${spend.toLocaleString("en-GB")}.`);
  const outstanding = numMetric(s, "costs", "outstanding_gbp");
  if (outstanding !== null && outstanding > 0) summary.push(`£${outstanding.toLocaleString("en-GB")} outstanding.`);
  const photos = numMetric(s, "photos", "photos_total");
  if (photos !== null) summary.push(`${photos} photo${photos === 1 ? "" : "s"} on record.`);
  const team = numMetric(s, "team", "team_size");
  if (team !== null && team > 0) summary.push(`${team} trade${team === 1 ? "" : "s"} on the project.`);
  if (summary.length > 0) { lines.push(""); lines.push(summary.join(" ")); }
  if (s.observations.length > 0) {
    lines.push("");
    for (const o of s.observations.slice(0, 3)) lines.push(`- ${o.headline}`);
  }
  return lines.join("\n");
}

function timelineReply(s: ProjectSnapshot, period: "today" | "yesterday" | "recent"): string {
  const now       = new Date(s.computed_at);
  const dayStart  = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const yStart    = new Date(now.getTime() - 86_400_000).toISOString().slice(0, 10);
  const filtered = s.timeline.filter((ev) => {
    if (period === "today")     return ev.at >= dayStart;
    if (period === "yesterday") return ev.at.slice(0, 10) === yStart;
    return true;
  });
  if (filtered.length === 0) {
    if (period === "today")     return "Nothing has landed on the timeline today yet.";
    if (period === "yesterday") return "Nothing was logged yesterday.";
    return "The timeline is empty.";
  }
  const lines = [
    period === "today"     ? "Today so far:"    :
    period === "yesterday" ? "Yesterday:"        :
                             "Recent activity:"
  ];
  for (const ev of filtered.slice(0, 10)) {
    lines.push(`- ${ev.headline}${ev.actor_name ? ` — ${ev.actor_name}` : ""}`);
  }
  return lines.join("\n");
}

function photosReply(s: ProjectSnapshot): string {
  const total  = numMetric(s, "photos", "photos_total");
  const recent = numMetric(s, "photos", "photos_recent");
  const days   = numMetric(s, "photos", "days_since_photo");
  if (total === null || total === 0) return "No photos on the project yet.";
  const parts = [`${total} photo${total === 1 ? "" : "s"} on record.`];
  if (recent !== null) parts.push(`${recent} added in the last 30 days.`);
  if (days !== null) parts.push(`Last one landed ${days} day${days === 1 ? "" : "s"} ago.`);
  return parts.join(" ");
}

function spendReply(s: ProjectSnapshot): string {
  const paid   = numMetric(s, "costs", "paid_gbp");
  const agreed = numMetric(s, "costs", "agreed_gbp");
  if (paid === null && agreed === null) return "No costs recorded yet.";
  const parts: string[] = [];
  if (paid !== null)   parts.push(`Paid £${paid.toLocaleString("en-GB")}.`);
  if (agreed !== null) parts.push(`Agreed £${agreed.toLocaleString("en-GB")}.`);
  const budget = numMetric(s, "costs", "budget_used_pct");
  if (budget !== null) parts.push(`Using ${budget}% of budget.`);
  return parts.join(" ");
}

function outstandingReply(s: ProjectSnapshot): string {
  const out     = numMetric(s, "costs", "outstanding_gbp");
  const overdue = numMetric(s, "costs", "overdue_gbp");
  if (out === null) return "No cost data on the project.";
  const lines = [`£${out.toLocaleString("en-GB")} outstanding.`];
  if (overdue !== null && overdue > 0) lines.push(`£${overdue.toLocaleString("en-GB")} of that is overdue.`);
  return lines.join(" ");
}

function budgetReply(s: ProjectSnapshot): string {
  const used  = numMetric(s, "costs", "budget_used_pct");
  const min   = s.project.budget_min_gbp;
  const max   = s.project.budget_max_gbp;
  if (used === null) {
    if (min === null && max === null) return "No budget set on the project.";
    return `Budget is £${(min ?? 0).toLocaleString("en-GB")}–£${(max ?? 0).toLocaleString("en-GB")}. Spend not yet tracked.`;
  }
  return `Using ${used}% of the £${(max ?? 0).toLocaleString("en-GB")} budget ceiling.`;
}

function kindReply(s: ProjectSnapshot, kind: string): string {
  const key = `agreed_${kind}_gbp`;
  const value = numMetric(s, "costs", key);
  if (value === null || value === 0) return `No ${kind} costs recorded yet.`;
  return `£${value.toLocaleString("en-GB")} agreed on ${kind}.`;
}

function whoPaidReply(s: ProjectSnapshot, who?: string): string {
  const paid = numMetric(s, "costs", "paid_gbp");
  if (paid === null) return "No payments on record.";
  if (!who) return `Total paid: £${paid.toLocaleString("en-GB")}.`;
  const matches = s.timeline.filter((ev) => ev.event_type === "payment_made" && ev.headline.toLowerCase().includes(who.toLowerCase()));
  if (matches.length === 0) return `Nothing recorded as paid to ${who} yet.`;
  const lines = [`Paid ${who}:`];
  for (const m of matches.slice(0, 5)) lines.push(`- ${m.headline}`);
  return lines.join("\n");
}

function teamReply(s: ProjectSnapshot): string {
  const size    = numMetric(s, "team", "team_size");
  const hired   = numMetric(s, "team", "team_hired");
  const pending = numMetric(s, "team", "team_pending");
  if (size === null || size === 0) return "Nobody invited to the project yet.";
  return `${size} trade${size === 1 ? "" : "s"} in total — ${hired ?? 0} hired, ${pending ?? 0} awaiting a reply.`;
}

function questionsReply(s: ProjectSnapshot): string {
  const open = numMetric(s, "posts", "posts_open_questions");
  if (open === null || open === 0) return "No open questions right now.";
  return `${open} open question${open === 1 ? "" : "s"} on the site diary.`;
}

function snagsReply(s: ProjectSnapshot): string {
  const open = numMetric(s, "things_to_fix", "snags_open");
  if (open === null || open === 0) return "No open snags — nothing pending on the fix list.";
  return `${open} thing${open === 1 ? "" : "s"} still to fix.`;
}

function variationsReply(s: ProjectSnapshot): string {
  const total = numMetric(s, "variations", "variations_total");
  const open  = numMetric(s, "variations", "variations_open");
  if (total === null || total === 0) return "No variations on record.";
  return `${total} variation${total === 1 ? "" : "s"} on record, ${open ?? 0} still open.`;
}

function risksReply(s: ProjectSnapshot): string {
  const risks = s.observations.filter((o) => o.aspect === "risks");
  if (risks.length === 0) return "No active risks flagged.";
  const lines = [`${risks.length} risk${risks.length === 1 ? "" : "s"} flagged:`];
  for (const r of risks.slice(0, 5)) lines.push(`- ${r.headline}`);
  return lines.join("\n");
}

function completionReply(s: ProjectSnapshot): string {
  if (s.project.completed_at) return `Marked complete on ${s.project.completed_at.slice(0, 10)}.`;
  if (s.project.started_at)   return `Started ${s.project.started_at.slice(0, 10)}. No completion date set yet.`;
  return "Not started yet — no completion date on record.";
}

function documentsReply(s: ProjectSnapshot, category?: string): string {
  const docs = aspect(s, "documents");
  if (!docs) return "No documents adapter data.";
  const total = numMetric(s, "documents", "documents_total");
  if (total === null || total === 0) return "No documents on the project yet.";
  if (!category) return `${total} document${total === 1 ? "" : "s"} on record.`;
  const key = `documents_${category}`;
  const cat = numMetric(s, "documents", key);
  if (cat === null || cat === 0) return `No ${category}s uploaded yet.`;
  return `${cat} ${category}${cat === 1 ? "" : "s"} on the project.`;
}

// ─── Snapshot helpers ────────────────────────────────────────────

function aspect(s: ProjectSnapshot, key: AspectMetrics["aspect"]): AspectMetrics | null {
  return s.aspects.find((a) => a.aspect === key) ?? null;
}

function numMetric(s: ProjectSnapshot, aspectKey: AspectMetrics["aspect"], metricKey: string): number | null {
  const a = aspect(s, aspectKey);
  if (!a) return null;
  const m: Metric | undefined = a.metrics.find((x) => x.key === metricKey);
  if (!m || m.value === null) return null;
  return typeof m.value === "number" ? m.value : Number(m.value);
}
