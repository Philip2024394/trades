// Nex Digital Twin — contracts.
//
// The Twin is a SIMULATION + WHAT-IF layer. It never persists state
// changes. Every scenario runs against the current business snapshot
// + returns a delta (before / after / difference) so the merchant can
// see the shape of a decision before committing to it.
//
// Nothing new gets stored. Nothing auto-executes. Every reply carries
// the assumptions used so nothing is silent.

import type { Evidence } from "../pi/types";
export type { Evidence };

/** The five canned scenarios shipping in this phase. */
export type ScenarioKind =
  | "fuel_increase"       // "if fuel increases by X%"
  | "price_rise"          // "if I raise my prices by X%"
  | "extra_hire"          // "if I hire another carpenter/plasterer/etc."
  | "van_purchase"        // "can I afford another van?"
  | "advertising_boost";  // "if I spend £X/month on ads"

/** A single monetary or scalar delta line. */
export type ScenarioDelta = {
  label:      string;
  before:    number | null;
  after:     number | null;
  /** Absolute difference (after - before). Null when either side missing. */
  diff:      number | null;
  unit:      "gbp" | "pct" | "count" | "days" | "hours";
  /** When true, `diff > 0` is good (revenue up). When false, `diff > 0`
   *  is bad (labour cost up). */
  higher_is_better: boolean;
};

/** A single scenario's result. Every field is explicit — no
 *  merchant-facing surprises. */
export type ScenarioResult = {
  kind:            ScenarioKind;
  headline:        string;                // one-line "£1,200/mo more revenue at 12% marginal margin"
  parameters:      Record<string, unknown>;  // what the merchant fed in
  assumptions:     string[];              // "assumed 30% job-mix for fuel-heavy trades"
  deltas:          ScenarioDelta[];
  verdict:         "positive" | "neutral" | "negative" | "unknown";
  reason:          string;
  disclaimer:      string;                // "Simulated only — no records changed."
  evidence:        Evidence;
};

/** The full simulation output — includes the raw scenario + a
 *  formatted speak block ready for chat. */
export type SimulationReply = {
  computed_at:     string;
  merchant_slug:   string;
  results:         ScenarioResult[];
  speak:           string;
  errors:          Array<{ scenario: ScenarioKind; error: string }>;
};

export const NO_PERSIST_DISCLAIMER =
  "Simulated only. No records were changed. If you want to act on this, ask me to prepare the change and it'll route to your approval queue.";

export function evidenceFor(source: string, tables: string[] = []): Evidence {
  return {
    source,
    tables,
    computed_at: new Date().toISOString()
  };
}
