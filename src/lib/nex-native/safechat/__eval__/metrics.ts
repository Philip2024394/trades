// src/lib/nex-native/safechat/__eval__/metrics.ts
//
// NEX SafeChat classification quality · pure confusion-matrix math.
//
// This module computes classical multi-class classification metrics
// (confusion matrix, per-class precision/recall/F1, overall accuracy)
// over the four SafeChat risk levels (0..3) plus two headline rates
// the founder specifically asked us to track:
//   · false-positive rate on benign (expected 0 but classified >= 1)
//   · false-negative rate on serious (expected 3 but classified <= 2)
//
// Zero I/O · zero logging · pure functions only.

import type { RiskLevel } from "../types";

/** A single evaluation outcome · what the runner feeds into metrics. */
export interface MetricsInput {
  readonly expected: RiskLevel;
  readonly actual: RiskLevel;
}

/** 4x4 counts indexed as matrix[expected][actual]. */
export interface ConfusionMatrix {
  readonly counts: readonly (readonly number[])[]; // [expected][actual]
  readonly total: number;
}

/** Per-class precision / recall / F1 / support (support = # expected). */
export interface PerClassMetrics {
  readonly level: RiskLevel;
  readonly precision: number;
  readonly recall: number;
  readonly f1: number;
  readonly support: number;
}

const LEVELS: readonly RiskLevel[] = [0, 1, 2, 3] as const;

/** Build a 4x4 confusion matrix from an iterable of {expected,actual}. */
export function buildConfusionMatrix(
  results: readonly MetricsInput[],
): ConfusionMatrix {
  const counts: number[][] = [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  let total = 0;
  for (const r of results) {
    if (!isLevel(r.expected) || !isLevel(r.actual)) continue;
    counts[r.expected]![r.actual]! += 1;
    total += 1;
  }
  return {
    counts: counts.map((row) => row.slice()),
    total,
  };
}

/** Per-class precision / recall / F1 / support for every level 0..3. */
export function perClassMetrics(
  matrix: ConfusionMatrix,
): readonly PerClassMetrics[] {
  const out: PerClassMetrics[] = [];
  for (const lvl of LEVELS) {
    const row = matrix.counts[lvl]!;
    const truePositive = row[lvl]!;
    const falseNegative = row.reduce((s, v, i) => (i === lvl ? s : s + v), 0);
    let falsePositive = 0;
    for (const other of LEVELS) {
      if (other === lvl) continue;
      falsePositive += matrix.counts[other]![lvl]!;
    }
    const support = truePositive + falseNegative;
    const precision = truePositive + falsePositive === 0
      ? 0
      : truePositive / (truePositive + falsePositive);
    const recall = support === 0 ? 0 : truePositive / support;
    const f1 = precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);
    out.push({
      level: lvl,
      precision: round4(precision),
      recall: round4(recall),
      f1: round4(f1),
      support,
    });
  }
  return out;
}

/** Overall accuracy · diagonal sum / total. */
export function overallAccuracy(matrix: ConfusionMatrix): number {
  if (matrix.total === 0) return 0;
  let diag = 0;
  for (const lvl of LEVELS) {
    diag += matrix.counts[lvl]![lvl]!;
  }
  return round4(diag / matrix.total);
}

/**
 * % of expected-level-0 items that were classified at level >= 1.
 * This is the founder's "do not alarm benign conversations" headline.
 */
export function falsePositiveRateOnBenign(matrix: ConfusionMatrix): number {
  const row = matrix.counts[0]!;
  const total = row.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const nonZero = row[1]! + row[2]! + row[3]!;
  return round4(nonZero / total);
}

/**
 * % of expected-level-3 items that were classified at level <= 2.
 * This is the founder's "do not miss serious risk" headline.
 */
export function falseNegativeRateOnSerious(matrix: ConfusionMatrix): number {
  const row = matrix.counts[3]!;
  const total = row.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;
  const missed = row[0]! + row[1]! + row[2]!;
  return round4(missed / total);
}

function isLevel(x: unknown): x is RiskLevel {
  return x === 0 || x === 1 || x === 2 || x === 3;
}

function round4(x: number): number {
  if (!Number.isFinite(x)) return 0;
  return Math.round(x * 10000) / 10000;
}
