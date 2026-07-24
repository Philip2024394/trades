// Benchmark aggregator — compute distributional stats over
// fingerprints with the k-anonymity gate ALWAYS applied.
//
// The k-anonymity rule is enforced INSIDE this module. Callers cannot
// bypass it. When count < K_MIN, every stat field returns null with
// confidence='insufficient' and a plain-English reason.

import { evidenceFor, K_MIN, type BenchmarkStat, type ProjectBenchmark, type ProjectFingerprint, type PropertyTypeCategory } from "./types";

const METRIC_LABELS: Record<BenchmarkStat["metric"], string> = {
  duration_days:         "Duration (days)",
  labour_hours:          "Labour hours",
  materials_spend_pence: "Materials spend (£)",
  labour_spend_pence:    "Labour spend (£)",
  crew_size:             "Crew size"
};

export type BuildBenchmarkInput = {
  fingerprints:  ProjectFingerprint[];
  filters?: {
    trade?:         string;
    project_type?:  string;
    region?:        string;
    property_type?: PropertyTypeCategory;
  };
};

export function buildBenchmark(input: BuildBenchmarkInput): ProjectBenchmark {
  const filters = input.filters ?? {};
  const filtered = input.fingerprints.filter((f) => {
    if (filters.trade         && f.trade         !== filters.trade)         return false;
    if (filters.project_type  && f.project_type  !== filters.project_type)  return false;
    if (filters.region        && f.region        !== filters.region)        return false;
    if (filters.property_type && f.property_type !== filters.property_type) return false;
    return true;
  });

  const evidence = evidenceFor("XP aggregate over contributed fingerprints", ["derived from hammerex_sitebook_projects + members + costs"]);
  const warnings: string[] = [];
  if (filtered.length < K_MIN) {
    warnings.push(`Only ${filtered.length} contributing project${filtered.length === 1 ? "" : "s"} matched — below the k=${K_MIN} threshold. No benchmark surfaced to keep contributors anonymous.`);
  }

  const stats: BenchmarkStat[] = ([
    "duration_days",
    "labour_hours",
    "materials_spend_pence",
    "labour_spend_pence",
    "crew_size"
  ] as const).map((metric) => statFor(metric, filtered, evidence));

  return {
    filters,
    sample_size: filtered.length,
    stats,
    warnings,
    evidence
  };
}

// ─── Statistics ─────────────────────────────────────────────

function statFor(metric: BenchmarkStat["metric"], list: ProjectFingerprint[], evidence: ReturnType<typeof evidenceFor>): BenchmarkStat {
  const label = METRIC_LABELS[metric];
  const values = list
    .map((f) => f[metric])
    .filter((n): n is number => typeof n === "number" && isFinite(n))
    .sort((a, b) => a - b);

  const count = values.length;
  if (count < K_MIN) {
    return {
      metric,
      label,
      count,
      median:     null,
      min:        null,
      max:        null,
      p25:        null,
      p75:        null,
      confidence: "insufficient",
      reason:     `Only ${count} contributing project${count === 1 ? "" : "s"} had a value for ${label} — silent below k=${K_MIN}.`,
      source_kind: "experience",
      evidence
    };
  }

  const min = values[0];
  const max = values[count - 1];
  const p25 = percentile(values, 0.25);
  const median = percentile(values, 0.50);
  const p75 = percentile(values, 0.75);
  const confidence: BenchmarkStat["confidence"] = count >= 25 ? "high" : count >= 10 ? "medium" : "low";

  return {
    metric,
    label,
    count,
    median,
    min,
    max,
    p25,
    p75,
    confidence,
    reason:      `${count} contributing project${count === 1 ? "" : "s"} in this filter set.`,
    source_kind: "experience",
    evidence
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return round(sortedAsc[lo]);
  const w = idx - lo;
  return round(sortedAsc[lo] * (1 - w) + sortedAsc[hi] * w);
}

function round(n: number): number {
  return Number(n.toFixed(1));
}
