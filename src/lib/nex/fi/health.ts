// Financial Health — dedicated finance-only score.
//
// Where MD's health blends BI + cash + profit + workforce + CX at the
// business level, FI's health is a FINANCE-only view. Five signals:
//   • cash_flow    — next-30-day net normalised
//   • profit       — weighted margin vs merchant target
//   • payment_speed — outstanding vs booked revenue
//   • growth       — this-window revenue vs prior-window
//   • stability    — variance of accepted totals across recent weeks
//
// Null signals are excluded, not zeroed. Merchants with thin data see
// a partial score with a warning.

import type { FinancialHealth } from "./types";

const BANDS: Array<{ min: number; band: FinancialHealth["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

const WORDS: Record<FinancialHealth["band"], string> = {
  excellent: "Excellent",
  healthy:   "Healthy",
  steady:    "Steady",
  attention: "Needs attention",
  critical:  "Critical"
};

export type FinancialHealthInputs = {
  next_30d_net_pence?:      number | null;
  cash_target_pence?:       number;
  weighted_margin_pct?:     number | null;
  target_margin_pct?:       number;
  outstanding_pence?:       number | null;
  booked_revenue_pence?:    number | null;
  revenue_now_pence?:       number | null;
  revenue_prior_pence?:     number | null;
  weekly_revenue_series?:   number[];   // for variance signal
};

export function computeFinancialHealth(inputs: FinancialHealthInputs): FinancialHealth {
  const cash_flow    = cashFlowSignal(inputs.next_30d_net_pence, inputs.cash_target_pence ?? 500_000);
  const profit       = profitSignal(inputs.weighted_margin_pct, inputs.target_margin_pct ?? 20);
  const paySpeed     = paymentSpeedSignal(inputs.outstanding_pence, inputs.booked_revenue_pence);
  const growth       = growthSignal(inputs.revenue_now_pence, inputs.revenue_prior_pence);
  const stability    = stabilitySignal(inputs.weekly_revenue_series);

  const parts = [cash_flow, profit, paySpeed, growth, stability];
  const weights = [2, 2, 1.5, 1, 1];
  let ws = 0, vs = 0;
  for (let i = 0; i < parts.length; i++) {
    if (parts[i].score === null) continue;
    ws += weights[i];
    vs += (parts[i].score as number) * weights[i];
  }
  const score = ws === 0 ? 0 : Math.max(0, Math.min(100, Math.round(vs / ws)));
  const band  = bandFor(score);

  return {
    score,
    band,
    headline: ws === 0 ? "Financial Health: no data yet." : `Financial Health: ${score}%. ${WORDS[band]}.`,
    signals: {
      cash_flow,
      profit,
      payment_speed: paySpeed,
      growth,
      stability
    }
  };
}

export function bandFor(score: number): FinancialHealth["band"] {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return "critical";
}

// ─── Signal builders ───────────────────────────────────────────

function cashFlowSignal(net: number | null | undefined, target: number): { score: number | null; note: string } {
  if (net === null || net === undefined) return { score: null, note: "Cash-flow projection not available." };
  if (net >= target) return { score: 100, note: `Next-30-day net ≥ £${(target / 100).toLocaleString("en-GB")} target.` };
  if (net >= 0)      return { score: Math.round((net / target) * 100), note: `Next-30-day net £${(net / 100).toLocaleString("en-GB")}.` };
  return { score: 20, note: `Next-30-day net negative (£${(net / 100).toLocaleString("en-GB")}).` };
}

function profitSignal(margin: number | null | undefined, target: number): { score: number | null; note: string } {
  if (margin === null || margin === undefined) return { score: null, note: "No margin data (no accepted quotes)." };
  if (margin >= target) return { score: 100, note: `Weighted margin ${margin}% ≥ ${target}% target.` };
  if (margin <= 0)      return { score: 20,  note: `Weighted margin ${margin}%.` };
  return { score: Math.round((margin / target) * 100), note: `Weighted margin ${margin}% vs ${target}% target.` };
}

function paymentSpeedSignal(outstanding: number | null | undefined, booked: number | null | undefined): { score: number | null; note: string } {
  if (outstanding === null || outstanding === undefined || booked === null || booked === undefined || booked === 0) {
    return { score: null, note: "Not enough booked-revenue history to score payment speed." };
  }
  const ratio = outstanding / booked;
  if (ratio <= 0.10) return { score: 95, note: `Outstanding is only ${Math.round(ratio * 100)}% of booked revenue.` };
  if (ratio <= 0.30) return { score: 75, note: `Outstanding is ${Math.round(ratio * 100)}% of booked revenue.` };
  if (ratio <= 0.50) return { score: 55, note: `Outstanding is ${Math.round(ratio * 100)}% of booked revenue — chase overdue.` };
  return { score: 30, note: `Outstanding is ${Math.round(ratio * 100)}% of booked revenue — big collection gap.` };
}

function growthSignal(now: number | null | undefined, prior: number | null | undefined): { score: number | null; note: string } {
  if (now === null || now === undefined || prior === null || prior === undefined || prior === 0) {
    return { score: null, note: "No prior-window revenue to compare growth." };
  }
  const changePct = ((now - prior) / prior) * 100;
  if (changePct >= 20)  return { score: 100, note: `Revenue up ${Math.round(changePct)}% vs prior window.` };
  if (changePct >= 5)   return { score: 80,  note: `Revenue up ${Math.round(changePct)}% vs prior window.` };
  if (changePct >= -5)  return { score: 60,  note: `Revenue flat vs prior window.` };
  if (changePct >= -20) return { score: 40,  note: `Revenue down ${Math.abs(Math.round(changePct))}% vs prior window.` };
  return { score: 20, note: `Revenue down ${Math.abs(Math.round(changePct))}% vs prior window.` };
}

function stabilitySignal(series: number[] | undefined): { score: number | null; note: string } {
  if (!series || series.length < 4) return { score: null, note: "Not enough weekly history to score stability." };
  const mean = series.reduce((s, n) => s + n, 0) / series.length;
  if (mean === 0) return { score: 30, note: "Weekly revenue at zero across the window." };
  const variance = series.reduce((s, n) => s + (n - mean) ** 2, 0) / series.length;
  const stdev = Math.sqrt(variance);
  const cov = stdev / mean;    // coefficient of variation
  if (cov <= 0.25) return { score: 95, note: "Weekly revenue steady." };
  if (cov <= 0.50) return { score: 75, note: "Weekly revenue reasonably steady." };
  if (cov <= 1.0)  return { score: 50, note: "Weekly revenue swings — pipeline variability." };
  return { score: 30, note: "Weekly revenue is highly variable." };
}
