// MD health aggregator — one 0–100 score composed from the sub-engines.
//
// Contributions (each is optional — null means "no data yet" and is
// excluded from the weighted mean rather than penalised):
//   • BI overall score          weight 3  (fleet-wide business KPIs)
//   • Cash-flow 30d bucket net  weight 2  (scored 0–100)
//   • Profit weighted margin    weight 2  (scored 0–100 vs merchant target)
//   • Workforce utilisation     weight 1
//   • CX priorities health      weight 1  (proxy: overdue-count)
//
// This is the same shape as BI's computeHealth so callers get a
// familiar API — but the inputs come from every engine, not one.

import type { MDHealth } from "./types";

const BANDS: Array<{ min: number; band: MDHealth["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

const WORDS: Record<MDHealth["band"], string> = {
  excellent: "Excellent",
  healthy:   "Healthy",
  steady:    "Steady",
  attention: "Needs attention",
  critical:  "Critical"
};

export type HealthInputs = {
  bi_score?:              number | null;
  cashflow_30d_pence?:    number | null;
  cashflow_target_pence?: number;         // amount that scores 100 (default 500,000)
  profit_margin_pct?:     number | null;
  profit_target_pct?:     number;         // default 20
  workforce_util_score?:  number | null;  // adapter returns 0-100 directly
  cx_overdue_count?:      number | null;
};

export function computeMDHealth(inputs: HealthInputs): MDHealth {
  const contributions: MDHealth["contributions"] = [];

  const parts: Array<{ engine: string; score: number | null; weight: number }> = [];

  parts.push({ engine: "bi",         score: nullToScore(inputs.bi_score),                                                          weight: 3 });
  parts.push({ engine: "cashflow",   score: cashflowScore(inputs.cashflow_30d_pence, inputs.cashflow_target_pence ?? 500_000),      weight: 2 });
  parts.push({ engine: "profit",     score: profitScore(inputs.profit_margin_pct, inputs.profit_target_pct ?? 20),                 weight: 2 });
  parts.push({ engine: "workforce",  score: nullToScore(inputs.workforce_util_score),                                              weight: 1 });
  parts.push({ engine: "cx",         score: overdueScore(inputs.cx_overdue_count),                                                 weight: 1 });

  let weightSum = 0;
  let valueSum  = 0;
  for (const p of parts) {
    contributions.push(p);
    if (p.score === null) continue;
    weightSum += p.weight;
    valueSum  += p.score * p.weight;
  }
  const score = weightSum === 0 ? 0 : Math.max(0, Math.min(100, Math.round(valueSum / weightSum)));
  const band  = bandFor(score);
  return {
    score,
    band,
    headline: weightSum === 0 ? "Business Health: no data yet." : `Business Health: ${score}%. ${WORDS[band]}.`,
    contributions
  };
}

export function bandFor(score: number): MDHealth["band"] {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return "critical";
}

function nullToScore(v: number | null | undefined): number | null {
  if (v === null || v === undefined || Number.isNaN(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function cashflowScore(net: number | null | undefined, target: number): number | null {
  if (net === null || net === undefined) return null;
  if (net >= target) return 100;
  if (net >= 0)      return Math.round((net / target) * 100);
  // Negative cash-flow — scale toward 0.
  const bad = -net;
  if (bad >= target) return 0;
  return Math.max(0, Math.round(30 - (bad / target) * 30));   // range 0–30
}

function profitScore(margin: number | null | undefined, target: number): number | null {
  if (margin === null || margin === undefined) return null;
  if (margin <= 0)      return 20;
  if (margin >= target) return 100;
  return Math.round((margin / target) * 100);
}

function overdueScore(count: number | null | undefined): number | null {
  if (count === null || count === undefined) return null;
  if (count === 0) return 100;
  if (count >= 10) return 20;
  return Math.max(20, 100 - count * 10);
}
