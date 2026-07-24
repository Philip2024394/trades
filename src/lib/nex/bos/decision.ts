// AI Business Decision Engine.
//
// Wraps FI.checkAffordability + a wait-window heuristic so the merchant
// can ask "can I afford a van?" and get back "yes, wait 45 days" rather
// than a plain yes/no.
//
// When the merchant can afford it now → verdict "yes" + wait_days 0.
// When the cash horizon needs time to grow → "wait" + rough number of
// days to reach the safe threshold, based on the 30-day net-inflow rate.
// When even the 90-day horizon doesn't cover it → "no" with a reason.

import { evidenceFor, type DecisionInput, type DecisionSuggestion } from "./types";
import type { FinancialSnapshot } from "../fi/types";

export type MakeDecisionInput = {
  input:   DecisionInput;
  finance: FinancialSnapshot | null;
};

/** How much cushion we keep above the purchase price. Same safety
 *  buffer FI's affordability engine uses (rough guide, not policy). */
const SAFETY_BUFFER_PENCE = 200_000;   // £2,000

export function makeDecision({ input, finance }: MakeDecisionInput): DecisionSuggestion {
  const ev = evidenceFor("bos.decision from FI.cashflow_ref", ["hammerex_customer_payments", "hammerex_quotes"]);
  if (!finance) {
    return {
      input,
      verdict:  "unknown",
      wait_days: null,
      reason:   "Financial snapshot not available. Can't answer honestly.",
      cash_horizon_pence: 0,
      footnote:  "Set up the Finance module and try again.",
      evidence: ev
    };
  }

  const cash30 = finance.cashflow_ref.next_30d_net_pence;
  const cash90 = finance.cashflow_ref.next_90d_net_pence;
  const needed = input.purchase_pence + SAFETY_BUFFER_PENCE;

  // Yes — 30-day net already covers it.
  if (cash30 >= needed) {
    return {
      input,
      verdict:  "yes",
      wait_days: 0,
      reason:   `£${(cash30 / 100).toLocaleString("en-GB")} net expected in 30 days covers ${input.purchase_label} + £2k safety buffer.`,
      cash_horizon_pence: cash30,
      footnote:  input.urgency === "flexible" ? "Nothing wrong with waiting a fortnight for a little more cushion." : "",
      evidence: ev
    };
  }

  // Wait — 90-day horizon covers, work out how long to safely cover it.
  if (cash90 >= needed) {
    // Estimate daily net rate from the 30→90-day tail.
    const tail = cash90 - cash30;
    const dailyRate = tail > 0 ? tail / 60 : 0;
    const shortfall = needed - cash30;
    const waitDays = dailyRate > 0 ? Math.max(7, Math.round(shortfall / dailyRate)) : 45;
    return {
      input,
      verdict:  "wait",
      wait_days: Math.min(waitDays, 90),
      reason:   `£${(cash30 / 100).toLocaleString("en-GB")} in 30d isn't enough; £${(cash90 / 100).toLocaleString("en-GB")} in 90d is. About ${Math.min(waitDays, 90)} days should get you there safely.`,
      cash_horizon_pence: cash30,
      footnote:  input.urgency === "now" ? "If truly urgent, consider financing rather than a straight cash purchase." : "",
      evidence: ev
    };
  }

  // No — even the 90-day horizon doesn't cover.
  return {
    input,
    verdict:  "no",
    wait_days: null,
    reason:   `Even the 90-day cash horizon of £${(cash90 / 100).toLocaleString("en-GB")} doesn't cover ${input.purchase_label} + safety buffer.`,
    cash_horizon_pence: cash30,
    footnote:  "Grow the pipeline or reduce the ask. Financing may bridge the gap short-term.",
    evidence: ev
  };
}
