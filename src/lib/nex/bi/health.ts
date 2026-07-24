// Health-score aggregator.
//
// Given the per-domain sub-scores + weights, produce a single 0–100
// number and the band + headline Nex speaks. Deterministic — no clever
// smoothing, no rolling averages, just a weighted mean of the domains
// that returned data. Domains that returned null are excluded (rather
// than defaulting to 0) so a merchant on Free tier with no invoicing
// isn't punished for absent modules.

import type { BusinessHealth, DomainMetrics } from "./types";

const BAND_THRESHOLDS: Array<{ min: number; band: BusinessHealth["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

const BAND_WORD: Record<BusinessHealth["band"], string> = {
  excellent: "Excellent",
  healthy:   "Healthy",
  steady:    "Steady",
  attention: "Needs attention",
  critical:  "Critical"
};

export function computeHealth(domains: DomainMetrics[]): { score: number; band: BusinessHealth["band"]; headline: string } {
  const scored = domains.filter((d) => d.sub_score !== null);
  if (scored.length === 0) {
    return { score: 0, band: "critical", headline: "Business Health: no data yet. Start posting jobs and enquiries and I'll build the picture." };
  }
  const totalWeight = scored.reduce((sum, d) => sum + d.weight, 0);
  const weighted    = scored.reduce((sum, d) => sum + (d.sub_score as number) * d.weight, 0);
  const raw         = weighted / totalWeight;
  const score       = Math.max(0, Math.min(100, Math.round(raw)));
  const band        = bandFor(score);
  const headline    = `Business Health: ${score}%. ${BAND_WORD[band]}.`;
  return { score, band, headline };
}

export function bandFor(score: number): BusinessHealth["band"] {
  for (const t of BAND_THRESHOLDS) if (score >= t.min) return t.band;
  return "critical";
}

/** Score a single metric on a 0–100 scale given target values. Used
 *  by adapters that need a consistent scoring curve rather than
 *  hand-rolled thresholds. Linear between floor and ceiling; clamped
 *  outside. */
export function scoreMetric(value: number, opts: {
  floor:   number;              // value that scores 0
  ceiling: number;              // value that scores 100
  direction: "higher_is_better" | "lower_is_better";
}): number {
  const { floor, ceiling, direction } = opts;
  if (floor === ceiling) return 50;
  if (direction === "higher_is_better") {
    if (value <= floor) return 0;
    if (value >= ceiling) return 100;
    return Math.round(((value - floor) / (ceiling - floor)) * 100);
  }
  // lower_is_better — invert
  if (value >= floor) return 0;
  if (value <= ceiling) return 100;
  return Math.round(((floor - value) / (floor - ceiling)) * 100);
}
