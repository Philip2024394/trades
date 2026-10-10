// src/lib/nex/signals/cusum.ts
//
// UWI · Wave 4 · M15c · CUSUM (Page 1954) shift detection
// Founder-authorised programme.
//
// Optimal (Lorden) minimum-delay change-point detection for a shift
// in the mean of a time series against a known baseline.
//
// Given a reference mean μ and drift tolerance k (typically 0.5σ):
//   S⁺_t = max(0, S⁺_{t-1} + (x_t - μ - k))
//   S⁻_t = max(0, S⁻_{t-1} + (μ - x_t - k))
// Alarm fires when S⁺ >= h or S⁻ >= h.
//
// Deterministic · pure · no external deps.

import type { CusumAlarm, CusumResult, TimeSeriesPoint } from "./types";

export interface CusumConfig {
  /** Reference mean the process is monitored against.
   *  When null, uses arithmetic mean of the input series. */
  readonly mean: number | null;
  /** Allowable drift · half of the "shift to detect" in the same units. */
  readonly k: number;
  /** Alarm threshold · alarm fires when S⁺ or S⁻ ≥ h. */
  readonly h: number;
}

export function runCusum(points: ReadonlyArray<TimeSeriesPoint>, config: CusumConfig): CusumResult {
  const values = points.map(p => p.value);
  const mean = config.mean ?? (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const k = config.k;
  const h = config.h;

  const upper_series: number[] = new Array(points.length).fill(0);
  const lower_series: number[] = new Array(points.length).fill(0);
  const alarms: CusumAlarm[] = [];

  let s_plus = 0;
  let s_minus = 0;

  for (let i = 0; i < points.length; i++) {
    const x = points[i].value;
    s_plus = Math.max(0, s_plus + (x - mean - k));
    s_minus = Math.max(0, s_minus + (mean - x - k));
    upper_series[i] = s_plus;
    lower_series[i] = s_minus;

    if (s_plus >= h) {
      alarms.push({ direction: "upper", at_ms: points[i].ts_ms, cumsum_value: s_plus, index: i });
      s_plus = 0; // reset after alarm (standard practice)
    }
    if (s_minus >= h) {
      alarms.push({ direction: "lower", at_ms: points[i].ts_ms, cumsum_value: s_minus, index: i });
      s_minus = 0;
    }
  }

  return {
    method: "cusum",
    mean,
    threshold_k: k,
    alarm_threshold_h: h,
    alarms,
    upper_series,
    lower_series,
  };
}
