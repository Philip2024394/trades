// Affordability check — "Can I afford X?"
//
// Decision matrix (deterministic, transparent):
//   • yes     — 90-day net covers purchase with ≥30% safety buffer remaining
//   • stretch — 90-day net covers purchase but buffer drops below 30% of pipeline
//   • no      — 90-day net does NOT cover purchase (even including weighted pipeline)
//   • unknown — cash-flow data missing entirely
//
// Every verdict includes the arithmetic: "90d net £X - £Y purchase =
// £Z remaining (Q% of pipeline)".

import { evidenceFor, type AffordabilityAnswer } from "./types";
import type { CashflowSnapshot } from "../md/types";

const SAFETY_BUFFER_RATIO = 0.30;   // want ≥30% of 90d net left after purchase
const MIN_ABSOLUTE_BUFFER_PENCE = 100_000;   // never dip below £1000 headroom

export type AffordabilityInput = {
  purchase_label:  string;
  purchase_pence:  number;
  cashflow:        CashflowSnapshot | null;
};

export function checkAffordability(input: AffordabilityInput): AffordabilityAnswer {
  const ev = evidenceFor("cash-flow horizon (from MD)", ["derived from MD cashflow"]);

  if (!input.cashflow || input.cashflow.horizon_pence === 0 && input.cashflow.outstanding_now_pence === 0) {
    return {
      purchase_label:      input.purchase_label,
      purchase_pence:      input.purchase_pence,
      verdict:             "unknown",
      reason:              "I don't have enough cash-flow data on record to decide honestly — log a few quotes and payments and ask again.",
      cash_horizon_pence:  0,
      safety_buffer_pence: 0,
      remaining_pence:     0,
      evidence:            ev
    };
  }

  const cf = input.cashflow;
  // The 90-day horizon uses net across all three buckets. Include the
  // weighted pipeline as best-guess money-in.
  const horizon = cf.horizon_pence + cf.pipeline_weighted_pence;
  const buffer  = Math.max(MIN_ABSOLUTE_BUFFER_PENCE, Math.round(horizon * SAFETY_BUFFER_RATIO));
  const remaining = horizon - input.purchase_pence;

  let verdict: AffordabilityAnswer["verdict"];
  let reason: string;
  const gbp = (p: number) => `£${(p / 100).toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  if (remaining >= buffer) {
    verdict = "yes";
    reason  = `Yes. 90-day cash horizon (net + weighted pipeline) is ${gbp(horizon)}. After ${gbp(input.purchase_pence)}, you'd have ${gbp(remaining)} left — comfortably above the ${gbp(buffer)} safety buffer.`;
  } else if (remaining > 0) {
    verdict = "stretch";
    reason  = `Stretch. 90-day cash horizon is ${gbp(horizon)}. After ${gbp(input.purchase_pence)}, you'd have ${gbp(remaining)} left — under the ${gbp(buffer)} safety buffer. Doable, but timing it after two more quotes accept would be safer.`;
  } else {
    verdict = "no";
    reason  = `Not on the visible numbers. 90-day cash horizon is ${gbp(horizon)}, purchase is ${gbp(input.purchase_pence)} — you'd be ${gbp(Math.abs(remaining))} short. Consider delaying, financing over 12+ months, or waiting for pipeline to close.`;
  }

  return {
    purchase_label:      input.purchase_label,
    purchase_pence:      input.purchase_pence,
    verdict,
    reason,
    cash_horizon_pence:  horizon,
    safety_buffer_pence: buffer,
    remaining_pence:     remaining,
    evidence:            ev
  };
}
