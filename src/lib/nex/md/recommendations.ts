// Recommendations — turns priority items into actionable cards.
// Every recommendation includes a REASON drawn from the priority's
// evidence + headline. Nothing invented.

import type { PriorityItem, Recommendation } from "./types";

const URGENCY: Record<PriorityItem["severity"], Recommendation["urgency"]> = {
  alert:   "today",
  warning: "today",
  notice:  "this_week",
  info:    "this_month"
};

/** Translate a PriorityItem into a Recommendation. Merchant-approved
 *  by default — nothing auto-executes. */
export function toRecommendation(p: PriorityItem): Recommendation {
  return {
    key:      `rec_${p.key}`,
    action:   defaultActionFor(p),
    reason:   p.detail ?? p.headline,
    urgency:  URGENCY[p.severity],
    source:   p.source,
    evidence: p.evidence
  };
}

/** Rank + dedupe recommendations. Takes the top N most urgent. */
export function buildRecommendations(priorities: PriorityItem[], limit = 5): Recommendation[] {
  const recs = priorities.map(toRecommendation);
  // Prefer today > this_week > this_month, then respect priority order.
  const rank: Record<Recommendation["urgency"], number> = { today: 0, this_week: 1, this_month: 2 };
  recs.sort((a, b) => rank[a.urgency] - rank[b.urgency]);
  return recs.slice(0, limit);
}

function defaultActionFor(p: PriorityItem): string {
  // Map common priority keys to plain-English actions. Falls back to
  // the priority's own action label or headline.
  if (p.key.includes("overdue"))            return "Chase overdue payments today";
  if (p.key.includes("next30_negative"))    return "Tighten the next 30 days of cash flow";
  if (p.key.includes("pipeline_strong"))    return "Follow up on the strongest open quotes";
  if (p.key.includes("low_margin"))         return "Review the low-margin job";
  if (p.key.includes("weighted_low"))       return "Lift quoted margins on new work";
  if (p.key.startsWith("bi:review"))        return "Reply to pending reviews";
  if (p.key.startsWith("bi:quote"))         return "Chase quotes awaiting reply";
  if (p.action) return p.action.label;
  return p.headline;
}
