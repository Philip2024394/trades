// AI-time-saved estimator.
//
// Simple, conservative estimate: for each prepared draft in the
// current AB approval queue, count a per-category manual-time
// estimate. Kept intentionally small so we don't over-claim.

import type { PreparedActionCategory } from "../ab/types";
import { evidenceFor, type TimeSavedEstimate } from "./types";

/** Rough minutes a merchant would spend doing this manually. */
export const PER_CATEGORY_MINUTES: Record<PreparedActionCategory, number> = {
  customer_message:     8,   // drafting + sending a WA/email
  quote_followup:      10,
  invoice_reminder:    12,
  social_post:         15,
  review_request:       6,
  purchase_order:      20,   // per PO
  project_update:      10,
  maintenance_reminder: 8,
  recommendation:       3    // just noting a recommendation (small)
};

export function estimateTimeSaved(actions: Array<{ category: PreparedActionCategory }>): TimeSavedEstimate {
  const evidence = evidenceFor("AB approval queue × per-category manual-time estimate", []);
  if (actions.length === 0) {
    return { minutes: 0, drafts: 0, reason: "Nothing prepared this morning — no minutes claimed.", evidence };
  }
  let minutes = 0;
  const perCategory: Record<string, number> = {};
  for (const a of actions) {
    const m = PER_CATEGORY_MINUTES[a.category] ?? 5;
    minutes += m;
    perCategory[a.category] = (perCategory[a.category] ?? 0) + m;
  }
  const rounded = Math.round(minutes / 5) * 5;
  const parts = Object.entries(perCategory).map(([k, v]) => `${k}: ${v}m`).join(", ");
  return {
    minutes: rounded,
    drafts:  actions.length,
    reason:  `${actions.length} draft${actions.length === 1 ? "" : "s"} × per-category baseline (${parts}) = ~${rounded} min.`,
    evidence
  };
}
