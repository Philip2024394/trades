// Customer-scoped answer router.
//
// Two families:
//   1. Specific customer  — "tell me about Mrs Smith" / "open John's project"
//   2. List / search       — "who owes me money?", "show kitchen customers"

import type { CustomerListEntry, CustomerSnapshot } from "./types";

export type CustomerQuestion =
  | { kind: "customer_overview";  name?: string }
  | { kind: "customer_search";    name: string }
  | { kind: "who_owes" }
  | { kind: "who_to_contact" }
  | { kind: "repeat_customers" }
  | { kind: "best_reviewers" }
  | { kind: "by_tag";             tag: string }
  | { kind: "none" };

/** Classifier. Order matters — LIST predicates first so a stray
 *  name in "who owes me money?" doesn't route to overview. */
export function classifyCustomerQuestion(text: string): CustomerQuestion {
  const t = text.toLowerCase().trim();
  if (!t) return { kind: "none" };

  if (/\b(who\s+owes|who'?s\s+outstanding|unpaid\s+customers?|who\s+hasn'?t\s+paid)\b/.test(t)) return { kind: "who_owes" };
  if (/\bwho\s+should\s+i\s+(contact|phone|call)\s+today\b|\bwho\s+have\s+i\s+not\s+contacted\b|\bwho\s+hasn'?t\s+heard\s+from\s+me\b/.test(t)) return { kind: "who_to_contact" };
  if (/\bwho\s+leaves\s+the\s+best\s+reviews\b|\bbest\s+review(s|ers)\b|\bhighest\s+rated\s+customers?\b/.test(t)) return { kind: "best_reviewers" };
  if (/\brepeat\s+(work|customers?|business)\b|\bwhich\s+customers?\s+have\s+repeat/.test(t)) return { kind: "repeat_customers" };

  const tagMatch = t.match(/\bshow\s+([a-z]+)\s+customers?\b/);
  if (tagMatch) return { kind: "by_tag", tag: tagMatch[1] };

  // "tell me about X" / "open X's project" / "who is X?"
  const overviewMatch = t.match(/\b(tell me about|open|show|who is)\s+([a-z][\w'\s-]{1,60})/i);
  if (overviewMatch) {
    return { kind: "customer_overview", name: overviewMatch[2].trim().replace(/'s\s+project.*$/i, "").trim() };
  }
  const searchMatch = t.match(/\bfind\s+([a-z][\w'\s-]{1,60})/i);
  if (searchMatch) return { kind: "customer_search", name: searchMatch[1].trim() };

  return { kind: "none" };
}

/** Turn a snapshot into a plain-English reply for the merchant. */
export function formatCustomerOverview(s: CustomerSnapshot): string {
  const c = s.contact;
  const lines: string[] = [];
  lines.push(`${c.displayName} — ${s.health.headline}`);
  const meta: string[] = [];
  if (c.lifecycleStage) meta.push(`stage: ${c.lifecycleStage}`);
  if (c.postcode)       meta.push(`postcode: ${c.postcode}`);
  if (c.whatsappE164)   meta.push(`WhatsApp: ${c.whatsappE164}`);
  if (c.tags.length > 0) meta.push(`tags: ${c.tags.join(", ")}`);
  if (meta.length > 0) { lines.push(""); lines.push(meta.join(" · ")); }

  lines.push("");
  lines.push(`- ${s.totals.quotesSent} quote${s.totals.quotesSent === 1 ? "" : "s"} sent · ${s.totals.quotesAccepted} accepted`);
  lines.push(`- ${s.totals.jobsSignedOff} job${s.totals.jobsSignedOff === 1 ? "" : "s"} signed off`);
  lines.push(`- ${s.totals.reviewsPosted} review${s.totals.reviewsPosted === 1 ? "" : "s"} on file`);

  if (s.payments_owed.length > 0) {
    const owed = s.payments_owed.reduce((sum, p) => sum + p.outstanding_pence, 0);
    lines.push("");
    lines.push(`Outstanding: £${(owed / 100).toLocaleString("en-GB")} across ${s.payments_owed.length} cost${s.payments_owed.length === 1 ? "" : "s"}.`);
  }
  if (s.preferences.length > 0) {
    lines.push("");
    lines.push("Preferences:");
    for (const p of s.preferences.slice(0, 4)) lines.push(`- ${p.label} — ${p.reason}`);
  }
  if (s.opportunities.length > 0) {
    lines.push("");
    lines.push("Opportunities:");
    for (const o of s.opportunities.slice(0, 3)) lines.push(`- ${o.headline}`);
  }
  if (s.warranties.length > 0) {
    lines.push("");
    lines.push("Warranties / home care:");
    for (const w of s.warranties.slice(0, 4)) {
      const due = w.days_until === null ? "no next date" : w.days_until <= 0 ? "overdue" : `${w.days_until} days`;
      lines.push(`- ${w.title} — ${due}`);
    }
  }
  return lines.join("\n");
}

/** Format a list-question reply. */
export function formatCustomerList(kind: string, list: CustomerListEntry[]): string {
  if (list.length === 0) return `Nothing to show for "${kind}".`;
  const lines = [
    kind === "who_owes"          ? "Customers with outstanding balance:" :
    kind === "who_to_contact"    ? "Customers who've gone quiet:"          :
    kind === "best_reviewers"    ? "Best reviewers:"                        :
    kind === "repeat_customers"  ? "Repeat customers:"                      :
                                    "Matching customers:"
  ];
  for (const c of list) lines.push(`- ${c.displayName} — ${c.note}`);
  return lines.join("\n");
}
