// NEX Predictive · calibration + measurement · invariant #15 (extra-strict:
// this module is READ-ONLY · it writes to no table, not even nex.predictions).
//
// Answers "does the prediction actually predict reality?" by joining
// nex.predictions against nex.conversion_events on (contact_id, window)
// and reporting Brier · Brier skill · AUC · calibration bins · precision /
// recall / F1 at threshold sweep · time-window drift.
//
// A prediction is RESOLVED when created_at + window_days has already
// passed. Only resolved predictions enter the scored metrics; pending
// predictions are counted separately for observability.

import { withClient } from "@/lib/nex/db";
import type { PredictionTarget } from "./types";

export interface CalibrationBin {
  bucket: string;
  bucket_min: number;
  bucket_max: number;
  n: number;
  mean_predicted: number;
  observed_rate: number;
}

export interface DriftBucket {
  window_label: string;
  n: number;
  base_rate: number | null;
  brier: number | null;
}

export interface PrecisionRecallRow {
  threshold: number;
  predicted_positive: number;
  actual_positive: number;
  true_positive: number;
  precision: number | null;
  recall: number | null;
  f1: number | null;
}

export interface CalibrationReport {
  ok: true;
  target: PredictionTarget;
  model_version_filter: string | null;
  n_predictions: number;      // all rows matching the filter
  n_resolved: number;         // window closed · scored
  n_pending: number;          // window not yet closed · not scored
  n_positive: number;
  base_rate: number | null;
  brier: number | null;
  brier_reference: number | null;   // brier of always-predict-base-rate baseline
  brier_skill: number | null;       // 1 - brier / brier_reference · +ve = beats baseline
  auc: number | null;
  calibration_bins: CalibrationBin[];
  precision_recall: PrecisionRecallRow[];
  drift: DriftBucket[];
  computed_at: string;
}

interface ScoredPoint { predicted: number; outcome: 0 | 1; window_end: number; resolved: boolean }

// ── Pure metric functions ────────────────────────────────────

export function brier(points: Array<{ predicted: number; outcome: 0 | 1 }>): number | null {
  if (points.length === 0) return null;
  let sse = 0;
  for (const p of points) { const d = p.predicted - p.outcome; sse += d * d; }
  return sse / points.length;
}

export function baseRate(points: Array<{ outcome: 0 | 1 }>): number | null {
  if (points.length === 0) return null;
  return points.reduce((a, p) => a + p.outcome, 0) / points.length;
}

// AUC via Mann-Whitney U · handles ties by averaging ranks.
export function auc(points: Array<{ predicted: number; outcome: 0 | 1 }>): number | null {
  const pos = points.filter((p) => p.outcome === 1).length;
  const neg = points.length - pos;
  if (pos === 0 || neg === 0) return null;
  const sorted = [...points].sort((a, b) => a.predicted - b.predicted);
  const ranks = new Array<number>(sorted.length);
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1].predicted === sorted[i].predicted) j++;
    const avgRank = (i + j + 2) / 2;                       // ranks are 1-based
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }
  let sumRanksPos = 0;
  for (let k = 0; k < sorted.length; k++) if (sorted[k].outcome === 1) sumRanksPos += ranks[k];
  return (sumRanksPos - pos * (pos + 1) / 2) / (pos * neg);
}

export function calibrationBins(points: Array<{ predicted: number; outcome: 0 | 1 }>, bins = 10): CalibrationBin[] {
  const out: CalibrationBin[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins, hi = (b + 1) / bins;
    const inBin = points.filter((p) => (b === bins - 1 ? p.predicted >= lo && p.predicted <= hi : p.predicted >= lo && p.predicted < hi));
    const n = inBin.length;
    out.push({
      bucket: `${lo.toFixed(1)}-${hi.toFixed(1)}`,
      bucket_min: lo,
      bucket_max: hi,
      n,
      mean_predicted: n === 0 ? 0 : inBin.reduce((a, p) => a + p.predicted, 0) / n,
      observed_rate: n === 0 ? 0 : inBin.reduce((a, p) => a + p.outcome, 0) / n,
    });
  }
  return out;
}

export function precisionRecallSweep(points: Array<{ predicted: number; outcome: 0 | 1 }>, thresholds = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]): PrecisionRecallRow[] {
  const rows: PrecisionRecallRow[] = [];
  const actualPositive = points.filter((p) => p.outcome === 1).length;
  for (const t of thresholds) {
    let tp = 0, fp = 0;
    for (const p of points) {
      if (p.predicted >= t) {
        if (p.outcome === 1) tp++;
        else fp++;
      }
    }
    const predictedPositive = tp + fp;
    const precision = predictedPositive > 0 ? tp / predictedPositive : null;
    const recall = actualPositive > 0 ? tp / actualPositive : null;
    const f1 = precision != null && recall != null && (precision + recall) > 0
      ? (2 * precision * recall) / (precision + recall)
      : null;
    rows.push({
      threshold: t,
      predicted_positive: predictedPositive,
      actual_positive: actualPositive,
      true_positive: tp,
      precision, recall, f1,
    });
  }
  return rows;
}

function driftBuckets(all: ScoredPoint[], now: number): DriftBucket[] {
  const buckets: Array<{ label: string; sinceDays: number; untilDays: number }> = [
    { label: "0-7d",   sinceDays: 0,  untilDays: 7 },
    { label: "7-30d",  sinceDays: 7,  untilDays: 30 },
    { label: "30-90d", sinceDays: 30, untilDays: 90 },
    { label: ">90d",   sinceDays: 90, untilDays: Number.POSITIVE_INFINITY },
  ];
  const day = 86_400_000;
  return buckets.map((b) => {
    const rows = all.filter((p) => {
      if (!p.resolved) return false;
      const ageDays = (now - p.window_end) / day;
      return ageDays >= b.sinceDays && ageDays < b.untilDays;
    });
    const points = rows.map((r) => ({ predicted: r.predicted, outcome: r.outcome }));
    return {
      window_label: b.label,
      n: points.length,
      base_rate: baseRate(points),
      brier: brier(points),
    };
  });
}

// ── Orchestrator ─────────────────────────────────────────────

export interface CalibrationInput {
  target?: PredictionTarget;                // default 'conversion_probability'
  model_version?: string;                   // optional filter
  now?: string;                             // for deterministic reruns
}

export async function computeCalibration(input: CalibrationInput = {}): Promise<CalibrationReport> {
  const target = input.target ?? "conversion_probability";
  const nowMs = input.now ? new Date(input.now).getTime() : Date.now();
  const rows = (await withClient(async (c) => {
    const res = await c.query(
      `SELECT
         p.prediction_id::text AS prediction_id,
         p.contact_id::text    AS contact_id,
         (p.prediction->>'value')::numeric AS predicted,
         p.window_days,
         p.created_at,
         (p.created_at + (p.window_days || ' days')::interval) AS window_end,
         CASE WHEN EXISTS (
           SELECT 1 FROM nex.conversion_events c
            WHERE c.contact_id = p.contact_id
              AND c.occurred_at >= p.created_at
              AND c.occurred_at <= p.created_at + (p.window_days || ' days')::interval
         ) THEN 1 ELSE 0 END AS outcome
       FROM nex.predictions p
       WHERE p.target = $1
         AND p.contact_id IS NOT NULL
         AND ($2::text IS NULL OR p.model_version = $2)
       ORDER BY p.created_at DESC
       LIMIT 20000`,
      [target, input.model_version ?? null],
    );
    return res.rows;
  })) ?? [];

  const points: ScoredPoint[] = rows.map((r) => {
    const windowEndDate = r.window_end instanceof Date ? r.window_end : new Date(String(r.window_end));
    const windowEndMs = windowEndDate.getTime();
    return {
      predicted: Number(r.predicted),
      outcome: Number(r.outcome) === 1 ? 1 : 0,
      window_end: windowEndMs,
      resolved: windowEndMs <= nowMs,
    };
  });

  const resolved = points.filter((p) => p.resolved);
  const scored = resolved.map((p) => ({ predicted: p.predicted, outcome: p.outcome }));
  const positive = scored.reduce((a, p) => a + p.outcome, 0);
  const base = baseRate(scored);
  const bri = brier(scored);
  const briRef = base != null && scored.length > 0
    ? scored.reduce((a, p) => a + (base - p.outcome) ** 2, 0) / scored.length
    : null;
  const skill = bri != null && briRef != null && briRef > 0 ? 1 - bri / briRef : null;

  return {
    ok: true,
    target,
    model_version_filter: input.model_version ?? null,
    n_predictions: points.length,
    n_resolved: resolved.length,
    n_pending: points.length - resolved.length,
    n_positive: positive,
    base_rate: base,
    brier: bri,
    brier_reference: briRef,
    brier_skill: skill,
    auc: auc(scored),
    calibration_bins: calibrationBins(scored),
    precision_recall: precisionRecallSweep(scored),
    drift: driftBuckets(points, nowMs),
    computed_at: new Date(nowMs).toISOString(),
  };
}
