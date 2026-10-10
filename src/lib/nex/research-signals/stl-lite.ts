// src/lib/nex/signals/stl-lite.ts
//
// UWI · Wave 4 · M15b · STL-lite (classical seasonal-trend decomposition)
// Founder-authorised programme.
//
// This is a simplified classical-STL variant (not full Loess-STL):
//   1. Trend = centred moving average of window `period`
//   2. Detrended = value - trend
//   3. Seasonal = per-position (mod period) mean of detrended
//   4. Residual = value - trend - seasonal
//
// Full Loess-STL (Cleveland 1990) is deferred as a LATER item — this
// covers the "detect sustained shift vs periodic pattern" need for
// Wave 4 acceptance. The `method` field is `stl-lite` so consumers
// know which variant produced the decomposition.
//
// Deterministic · pure · no external deps.

import type { StlDecomposition, TimeSeriesPoint } from "./types";

export interface StlLiteConfig {
  /** Seasonal period (e.g. 7 for weekly, 24 for hourly-daily, 12 for monthly-yearly). */
  readonly period: number;
}

export function decomposeStlLite(
  points: ReadonlyArray<TimeSeriesPoint>,
  config: StlLiteConfig,
): StlDecomposition {
  const values = points.map(p => p.value);
  const n = values.length;
  const period = Math.max(2, Math.floor(config.period));

  if (n < period * 2) {
    // Too short for meaningful seasonal decomposition · trend = mean · seasonal = 0
    const mean = n ? values.reduce((a, b) => a + b, 0) / n : 0;
    return {
      method: "stl-lite",
      trend: values.map(() => mean),
      seasonal: values.map(() => 0),
      residual: values.map(v => v - mean),
      period,
    };
  }

  // Step 1: trend via centred moving average of window `period`
  // For even period, use symmetric two-step averaging (STL classical)
  const trend = movingAverageCentered(values, period);

  // Step 2: detrended
  const detrended = values.map((v, i) => v - trend[i]);

  // Step 3: seasonal — per-position mean of detrended (position = i mod period)
  const seasonal_pattern: number[] = new Array(period).fill(0);
  const seasonal_counts: number[] = new Array(period).fill(0);
  for (let i = 0; i < n; i++) {
    const pos = i % period;
    if (Number.isFinite(detrended[i])) {
      seasonal_pattern[pos] += detrended[i];
      seasonal_counts[pos] += 1;
    }
  }
  for (let p = 0; p < period; p++) {
    seasonal_pattern[p] = seasonal_counts[p] > 0 ? seasonal_pattern[p] / seasonal_counts[p] : 0;
  }
  // Centre the seasonal pattern (mean zero)
  const seasonal_mean = seasonal_pattern.reduce((a, b) => a + b, 0) / period;
  for (let p = 0; p < period; p++) seasonal_pattern[p] -= seasonal_mean;

  const seasonal = values.map((_, i) => seasonal_pattern[i % period]);

  // Step 4: residual
  const residual = values.map((v, i) => v - trend[i] - seasonal[i]);

  return {
    method: "stl-lite",
    trend,
    seasonal,
    residual,
    period,
  };
}

function movingAverageCentered(values: ReadonlyArray<number>, window: number): number[] {
  const n = values.length;
  const half = Math.floor(window / 2);
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    let start = Math.max(0, i - half);
    let end = Math.min(n - 1, i + half);
    let sum = 0;
    let count = 0;
    for (let j = start; j <= end; j++) { sum += values[j]; count++; }
    out[i] = count > 0 ? sum / count : values[i];
  }
  return out;
}
