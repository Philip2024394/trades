// src/lib/nex/master-ai/statistics.ts
//
// NEX Master AI Engineer · Statistics / Trend / Forecast · §20
// Philip 2026-09-07 · AUTHORIZE (Wave 2 · continuous mission)
//
// Deterministic statistical operations only. Never present a forecast
// as certainty. Every trend/forecast preserves: historical data used,
// assumptions, method, confidence, horizon.

import { randomUUID } from "node:crypto";
import { readJsonlAll, appendJsonLine } from "./fs-atomic";
import { trendReportsPath } from "./paths";
import type { TrendDirection, TrendReport } from "./types";

export type TimeSeriesPoint = { at_iso: string; value: number };

/** Simple linear regression: slope + intercept in value-per-hour space. */
function linearRegressionPerHour(points: TimeSeriesPoint[]): { slope: number; intercept: number } {
  if (points.length < 2) return { slope: 0, intercept: points[0]?.value ?? 0 };
  const t0 = Date.parse(points[0].at_iso);
  const xs = points.map((p) => (Date.parse(p.at_iso) - t0) / (60 * 60 * 1000));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - meanX) * (ys[i] - meanY);
    den += (xs[i] - meanX) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  return { slope, intercept };
}

function classifyDirection(points: TimeSeriesPoint[], slopePerHour: number): TrendDirection {
  if (points.length < 3) return "INSUFFICIENT_DATA";
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const range = Math.max(...points.map((p) => p.value)) - Math.min(...points.map((p) => p.value));
  const scale = Math.max(1, Math.abs((first + last) / 2));
  const relativeSlope = slopePerHour / scale;
  if (Math.abs(relativeSlope) < 0.001 && range / scale < 0.01) return "STABLE";
  if (relativeSlope > 0) {
    // Compare first half vs second half slope for accel/decel classification
    const mid = Math.floor(points.length / 2);
    const early = linearRegressionPerHour(points.slice(0, Math.max(2, mid)));
    const late = linearRegressionPerHour(points.slice(mid));
    if (late.slope > early.slope * 1.2 && late.slope > 0) return "ACCELERATING";
    if (first <= 0 && last > 0) return "EMERGING";
    return "INCREASING";
  }
  // relativeSlope < 0
  const mid = Math.floor(points.length / 2);
  const early = linearRegressionPerHour(points.slice(0, Math.max(2, mid)));
  const late = linearRegressionPerHour(points.slice(mid));
  if (late.slope < early.slope * 1.2 && late.slope < 0) return "DECELERATING";
  if (last <= 0 && first > 0) return "DECLINING";
  return "DECREASING";
}

export function analyzeTimeSeries(input: {
  metric_key: string;
  points: TimeSeriesPoint[];
}): TrendReport {
  const points = [...input.points].sort((a, b) => a.at_iso.localeCompare(b.at_iso));
  const values = points.map((p) => p.value);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const { slope } = linearRegressionPerHour(points);
  const direction = classifyDirection(points, slope);
  const report: TrendReport = {
    trend_id: randomUUID(),
    metric_key: input.metric_key,
    window_start_iso: points[0]?.at_iso ?? new Date().toISOString(),
    window_end_iso: points[points.length - 1]?.at_iso ?? new Date().toISOString(),
    sample_count: points.length,
    first_value: points[0]?.value ?? 0,
    last_value: points[points.length - 1]?.value ?? 0,
    mean,
    min,
    max,
    slope_per_hour: slope,
    direction,
    computed_at_iso: new Date().toISOString(),
  };
  appendJsonLine(trendReportsPath(), report);
  return report;
}

export function readAllTrendReports(): TrendReport[] {
  return readJsonlAll<TrendReport>(trendReportsPath());
}

export function _resetStatisticsForTests(): void {
  const fs = require("node:fs") as typeof import("node:fs");
  try { if (fs.existsSync(trendReportsPath())) fs.unlinkSync(trendReportsPath()); } catch { /* ignore */ }
}
