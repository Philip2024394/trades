// Growth engine — pattern-detected upsell/campaign chances.
//
// Sourced entirely from existing engines:
//   • BI  — completed project types + trade breakdown
//   • CX  — customers with 5★ reviews + stale-quote follow-ups
//   • MP  — nearby search demand (when available)
//
// Every opportunity carries an evidence chain. When a category has no
// signal we drop it silently — no fabricated "18 projects → package".

import { evidenceFor, type GrowthOpportunity } from "./types";

export type CompletedProjectTally = {
  trade_label:  string;   // "Kitchen renovation"
  count:        number;
};

export type StaleQuote = {
  quote_id:       string;
  customer_label: string;
  age_days:       number;
  amount_pence:   number;
};

export type FiveStarCustomer = {
  customer_id:    string;
  customer_label: string;
  last_review_at: string;
};

export type NearbySearch = {
  trade_label:   string;
  count:         number;
  window_days:   number;
};

export type SuggestGrowthInput = {
  completed_projects?: CompletedProjectTally[];
  stale_quotes?:       StaleQuote[];
  five_star_customers?: FiveStarCustomer[];
  nearby_searches?:    NearbySearch[];
};

const PACKAGE_THRESHOLD = 10;   // ≥10 of the same trade type → suggest a package
const STALE_QUOTE_MIN_DAYS = 14;
const NEARBY_MIN_COUNT = 3;

export function suggestGrowth(input: SuggestGrowthInput): GrowthOpportunity[] {
  const out: GrowthOpportunity[] = [];

  // Package opportunity — repeat volume of one trade type.
  for (const t of input.completed_projects ?? []) {
    if (t.count >= PACKAGE_THRESHOLD) {
      out.push({
        kind:              "package",
        headline:          `You completed ${t.count} ${t.trade_label.toLowerCase()} projects. Worth packaging.`,
        reason:            `Repeatable scope + fixed price = higher conversion + faster estimate cycle`,
        suggested_action:  `Draft a "${t.trade_label}" package listing on your canteen. One fixed price, one call to action.`,
        upside_pence:      null,
        evidence:          evidenceFor("bos.growth.package from BI completed_projects", ["hammerex_projects"])
      });
    }
  }

  // Follow-up opportunity — quotes ageing without a decision.
  for (const q of input.stale_quotes ?? []) {
    if (q.age_days >= STALE_QUOTE_MIN_DAYS) {
      out.push({
        kind:              "follow_up",
        headline:          `Quote for ${q.customer_label} is ${q.age_days} days old (£${(q.amount_pence / 100).toLocaleString("en-GB")}).`,
        reason:            "Stale quotes typically close 3× more often after a nudge",
        suggested_action:  `Send a soft check-in message today. Nex can draft it.`,
        upside_pence:      q.amount_pence,
        evidence:          evidenceFor("bos.growth.follow_up from CX stale_quotes", ["hammerex_quotes"])
      });
    }
  }

  // Referral opportunity — 5★ customer, no referral asked.
  for (const c of input.five_star_customers ?? []) {
    out.push({
      kind:              "referral",
      headline:          `${c.customer_label} left 5★. Good moment to ask for a referral.`,
      reason:            "5★ reviews correlate with the highest referral yield within 30 days of completion",
      suggested_action:  `Send a short "who else could I help?" message. Nex can draft it.`,
      upside_pence:      null,
      evidence:          evidenceFor("bos.growth.referral from CX five_star_customers", ["hammerex_reviews"])
    });
  }

  // Campaign opportunity — nearby demand rising for a trade you serve.
  for (const s of input.nearby_searches ?? []) {
    if (s.count >= NEARBY_MIN_COUNT) {
      out.push({
        kind:              "campaign",
        headline:          `${s.count} nearby ${s.trade_label.toLowerCase()} searches in ${s.window_days} days.`,
        reason:            "Local demand cluster. A well-timed post/campaign converts higher.",
        suggested_action:  `Draft a short social post targeting ${s.trade_label.toLowerCase()}. Nex can prepare it.`,
        upside_pence:      null,
        evidence:          evidenceFor("bos.growth.campaign from MP nearby_searches", ["hammerex_mp_searches"])
      });
    }
  }

  return out;
}
