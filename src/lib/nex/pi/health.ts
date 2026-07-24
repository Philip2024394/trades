// Project health-score aggregator.
//
// Mirrors BI's health.ts but scoped per project. Weighted mean of the
// aspect sub-scores that returned data. Null-scored aspects are
// excluded (rather than defaulting to 0) so a fresh project with no
// photos yet isn't punished for absent data.

import type { AspectMetrics, ProjectSnapshot } from "./types";

const BANDS: Array<{ min: number; band: ProjectSnapshot["health"]["band"] }> = [
  { min: 90, band: "excellent" },
  { min: 75, band: "healthy" },
  { min: 60, band: "steady" },
  { min: 40, band: "attention" },
  { min:  0, band: "critical" }
];

const WORDS: Record<ProjectSnapshot["health"]["band"], string> = {
  excellent: "Excellent",
  healthy:   "Healthy",
  steady:    "Steady",
  attention: "Needs attention",
  critical:  "Critical"
};

export function computeProjectHealth(aspects: AspectMetrics[]): ProjectSnapshot["health"] {
  const scored = aspects.filter((a) => a.sub_score !== null);
  if (scored.length === 0) {
    return { score: 0, band: "critical", headline: "Project Health: no activity yet." };
  }
  const w = scored.reduce((s, a) => s + a.weight, 0);
  const v = scored.reduce((s, a) => s + (a.sub_score as number) * a.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(v / w)));
  const band  = bandFor(score);
  return { score, band, headline: `Project Health: ${score}%. ${WORDS[band]}.` };
}

export function bandFor(score: number): ProjectSnapshot["health"]["band"] {
  for (const b of BANDS) if (score >= b.min) return b.band;
  return "critical";
}

/** Linear-clamp scoring helper — same signature as BI's scoreMetric so
 *  adapters can share the pattern. */
export function scoreMetric(value: number, opts: {
  floor:   number;
  ceiling: number;
  direction: "higher_is_better" | "lower_is_better";
}): number {
  if (opts.floor === opts.ceiling) return 50;
  if (opts.direction === "higher_is_better") {
    if (value <= opts.floor) return 0;
    if (value >= opts.ceiling) return 100;
    return Math.round(((value - opts.floor) / (opts.ceiling - opts.floor)) * 100);
  }
  if (value >= opts.floor) return 0;
  if (value <= opts.ceiling) return 100;
  return Math.round(((opts.floor - value) / (opts.floor - opts.ceiling)) * 100);
}
