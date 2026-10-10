// src/lib/nex-agent/code-engine/capability-representation-cell-audit.ts
//
// NEX1 · Iteration 2 · Representation-cell audit (Ledger B substrate).
//
// PURPOSE
//   Compute STRUCTURAL statistics over the prediction-verdict store so
//   NEX-side metacognition can consume them. Statistics ONLY. This module
//   does NOT emit any diagnostic vocabulary — no strings like
//   "representation insufficient", "missing feature", "wrong dimension",
//   "degenerate cell". The mission (2026-09-18) forbids passing the
//   engineer's conclusion into NEX through fields or labels.
//
// WHAT THIS MODULE DOES
//   1. Group verdict-history records by exact cell = JSON-canonicalised
//      hash of features_the_brain_had_at_prediction_time.
//   2. For each cell: count entries, matched, failed, unknown (pending);
//      report whether outcomes are uniform within the cell.
//   3. Compute confidence-bin calibration (match rate by confidence bin).
//   4. Compute per-label performance (prediction_label × match).
//
// WHAT THIS MODULE DOES NOT DO
//   - Does not conclude "representation is insufficient."
//   - Does not name any candidate feature to add.
//   - Does not label cells as "degenerate" or "problematic."
//   - Does not filter, rank, or ORDER cells by any judgement.
//   - Emits raw statistics only. Consumers decide what (if anything) to conclude.
//
// R11-B: computed here, still evidence_kind INFERRED · never SUPPORTING for R-4.

import crypto from "node:crypto";
import { registerAgent, recordHeartbeat } from "./capability-agent-registry";
import type { PredictionVerdictEntry, PredictionFeatures } from "./capability-prediction-verdict-store";

registerAgent({
  id: "representation_cell_audit",
  name: "Representation-cell audit · verdict-history structural statistics",
  cognitive_layer: "metacognition",
  description: "Reads the prediction-verdict store and reports structural statistics per feature-cell: entry count, matched/failed/unknown counts, outcome-uniformity boolean. Also confidence-bin calibration and per-label performance. Emits no diagnostic vocabulary.",
});

// ── Cell key ───────────────────────────────────────────────────────────

export function cellKey(features: PredictionFeatures): string {
  const keys = Object.keys(features).sort();
  const canonical = "{" + keys.map((k) => JSON.stringify(k) + ":" + JSON.stringify(features[k])).join(",") + "}";
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 16);
}

// ── Cell audit result types ────────────────────────────────────────────

export interface CellStats {
  readonly cell_key: string;
  readonly features: PredictionFeatures;
  readonly entry_count: number;
  readonly matched_count: number;
  readonly failed_count: number;
  readonly unknown_count: number;
  /** true iff every joined record in the cell has the same matched value (all true, or all false). */
  readonly outcomes_uniform: boolean;
  /** Distinct prediction labels observed in this cell (uniqueness set). */
  readonly distinct_prediction_labels: readonly (string | number | boolean | null)[];
  /** Distinct ground truth labels observed in this cell (uniqueness set). */
  readonly distinct_ground_truth_labels: readonly (string | number | boolean | null)[];
}

export interface CellAudit {
  readonly total_entries: number;
  readonly total_joined: number; // has verdict
  readonly total_pending: number; // no verdict yet
  readonly cells: readonly CellStats[];
}

export function computeCellAudit(entries: readonly PredictionVerdictEntry[]): CellAudit {
  const buckets = new Map<string, PredictionVerdictEntry[]>();
  for (const e of entries) {
    const k = cellKey(e.features_the_brain_had_at_prediction_time);
    const bucket = buckets.get(k) ?? [];
    bucket.push(e);
    buckets.set(k, bucket);
  }
  const cells: CellStats[] = [];
  for (const [key, items] of buckets) {
    let matched = 0, failed = 0, unknown = 0;
    const predLabels = new Set<string>();
    const gtLabels = new Set<string>();
    for (const e of items) {
      if (e.matched === true) matched++;
      else if (e.matched === false) failed++;
      else unknown++;
      predLabels.add(JSON.stringify(e.prediction_label));
      if (e.matched !== null) gtLabels.add(JSON.stringify(e.ground_truth_label));
    }
    const joinedItems = items.filter((e) => e.matched !== null);
    const outcomes_uniform =
      joinedItems.length === 0 ||
      joinedItems.every((e) => e.matched === joinedItems[0].matched);
    cells.push({
      cell_key: key,
      features: items[0].features_the_brain_had_at_prediction_time,
      entry_count: items.length,
      matched_count: matched,
      failed_count: failed,
      unknown_count: unknown,
      outcomes_uniform,
      distinct_prediction_labels: [...predLabels].map((s) => JSON.parse(s)),
      distinct_ground_truth_labels: [...gtLabels].map((s) => JSON.parse(s)),
    });
  }
  const total_joined = entries.filter((e) => e.matched !== null).length;
  const total_pending = entries.length - total_joined;
  const audit = {
    total_entries: entries.length,
    total_joined,
    total_pending,
    cells,
  };
  recordHeartbeat({
    agent_id: "representation_cell_audit",
    event_type: "compute_cell_audit",
    event_data: { total: entries.length, cells: cells.length, joined: total_joined, pending: total_pending },
  });
  return audit;
}

// ── Confidence calibration ─────────────────────────────────────────────

export interface CalibrationBin {
  readonly bin_lo: number;
  readonly bin_hi: number;
  readonly entry_count: number;
  readonly matched_count: number;
  readonly failed_count: number;
  readonly unknown_count: number;
  /** matched / (matched + failed) · null when no joined entries in bin. */
  readonly empirical_match_rate: number | null;
  /** Midpoint of bin · what the confidence "claimed." */
  readonly claimed_confidence: number;
}

export function computeCalibrationAudit(entries: readonly PredictionVerdictEntry[]): {
  readonly bins: readonly CalibrationBin[];
} {
  const width = 0.1;
  const bins: CalibrationBin[] = [];
  for (let lo = 0; lo < 1.0 - 1e-9; lo += width) {
    const hi = Math.min(1.0, lo + width);
    const inBin = entries.filter((e) => e.prediction_confidence >= lo && e.prediction_confidence < hi + (hi === 1.0 ? 1e-9 : 0));
    let m = 0, f = 0, u = 0;
    for (const e of inBin) {
      if (e.matched === true) m++;
      else if (e.matched === false) f++;
      else u++;
    }
    bins.push({
      bin_lo: round(lo),
      bin_hi: round(hi),
      entry_count: inBin.length,
      matched_count: m,
      failed_count: f,
      unknown_count: u,
      empirical_match_rate: (m + f) > 0 ? m / (m + f) : null,
      claimed_confidence: round((lo + hi) / 2),
    });
  }
  recordHeartbeat({
    agent_id: "representation_cell_audit",
    event_type: "compute_calibration_audit",
    event_data: { bins: bins.length },
  });
  return { bins };
}

// ── Label performance ──────────────────────────────────────────────────

export interface LabelPerformance {
  readonly label: string | number | boolean | null;
  readonly entry_count: number;
  readonly matched_count: number;
  readonly failed_count: number;
  readonly unknown_count: number;
  /** matched / (matched + failed) · null when no joined entries. */
  readonly match_rate: number | null;
}

export function computeLabelPerformance(entries: readonly PredictionVerdictEntry[]): {
  readonly labels: readonly LabelPerformance[];
} {
  const buckets = new Map<string, PredictionVerdictEntry[]>();
  for (const e of entries) {
    const k = JSON.stringify(e.prediction_label);
    const b = buckets.get(k) ?? [];
    b.push(e);
    buckets.set(k, b);
  }
  const labels: LabelPerformance[] = [];
  for (const [k, items] of buckets) {
    let m = 0, f = 0, u = 0;
    for (const e of items) {
      if (e.matched === true) m++;
      else if (e.matched === false) f++;
      else u++;
    }
    labels.push({
      label: JSON.parse(k),
      entry_count: items.length,
      matched_count: m,
      failed_count: f,
      unknown_count: u,
      match_rate: (m + f) > 0 ? m / (m + f) : null,
    });
  }
  return { labels };
}

// ── Small utility ──────────────────────────────────────────────────────

function round(x: number, digits = 3): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

export const REPRESENTATION_CELL_AUDIT_VERSION = "representation-cell-audit.v1";
