// src/lib/nex-agent/code-engine/hypothesis/capability-evidence-exposure.ts
//
// NEX1 · Evidence Exposure · Ledger B substrate.
//
// Reads NEX's accumulated evidence from existing stores and returns it as
// a structured corpus. Computes ONLY the observable statistics permitted
// by Section 8 of the mission (frequency, support, outcome proportions,
// cell uniformity, collisions, entropy-like measures, calibration).
//
// It does NOT:
//   · label evidence
//   · propose relationships
//   · identify missing features
//   · classify patterns
//   · generate hypotheses
//   · tell the reader what to conclude
//
// The output is fact-shaped, not conclusion-shaped.

import { registerAgent, recordHeartbeat } from "../capability-agent-registry";
import { loadAllVerdicts, type PredictionVerdictEntry } from "../capability-prediction-verdict-store";
import { loadAllReflections, type ReflectionEntry } from "../capability-post-verdict-reflection";
import { computeCellAudit, computeCalibrationAudit, type CellAudit } from "../capability-representation-cell-audit";

registerAgent({
  id: "evidence_exposure",
  name: "Evidence Exposure · read-only accumulated evidence",
  cognitive_layer: "hypothesis_and_experimentation",
  description: "Reads NEX's accumulated evidence stores and computes permitted structural statistics. No labels, no conclusions, no hypothesis suggestions.",
});

// ── Types ─────────────────────────────────────────────────────────────

export interface CellStatistics {
  readonly cell_key: string;
  readonly cell_features: Readonly<Record<string, unknown>>;
  readonly entry_count: number;
  readonly matched_count: number;
  readonly failed_count: number;
  readonly unknown_count: number;
  readonly outcomes_uniform: boolean;
  readonly match_rate: number | null;
}

export interface ExposedEvidence {
  readonly generated_at: string;
  readonly verdict_summary: {
    readonly total: number;
    readonly matched: number;
    readonly failed: number;
    readonly unknown: number;
  };
  readonly reflection_summary: {
    readonly total: number;
    readonly distinct_reflection_keys: number;
  };
  readonly cell_statistics: readonly CellStatistics[];
  readonly calibration_bins: readonly {
    readonly bin_lo: number;
    readonly bin_hi: number;
    readonly n: number;
    readonly empirical_match_rate: number | null;
  }[];
  readonly per_label_performance: readonly {
    readonly label: string;
    readonly n: number;
    readonly matched: number;
    readonly failed: number;
  }[];
  // Raw record references so downstream callers can see provenance
  readonly reflection_ids: readonly string[];
  readonly verdict_ids: readonly string[];
  readonly evidence_kind: "OBSERVED";
}

// ── Reader ────────────────────────────────────────────────────────────

export function exposeAccumulatedEvidence(repo_root?: string): ExposedEvidence {
  const verdicts = loadAllVerdicts(repo_root);
  const reflections = loadAllReflections(repo_root);
  const cellAudit = computeCellAudit(verdicts);
  const cellStats = cellAudit.cells.map((c): CellStatistics => ({
    cell_key: c.cell_key,
    cell_features: c.features,
    entry_count: c.entry_count,
    matched_count: c.matched_count,
    failed_count: c.failed_count,
    unknown_count: c.unknown_count,
    outcomes_uniform: c.outcomes_uniform,
    match_rate: (c.matched_count + c.failed_count) > 0 ? c.matched_count / (c.matched_count + c.failed_count) : null,
  }));

  const calAudit = computeCalibrationAudit(verdicts);
  const bins = calAudit.bins.filter((b) => b.entry_count > 0).map((b) => ({
    bin_lo: b.bin_lo,
    bin_hi: b.bin_hi,
    n: b.entry_count,
    empirical_match_rate: b.empirical_match_rate,
  }));

  const perLabel = new Map<string, { n: number; matched: number; failed: number }>();
  for (const v of verdicts) {
    const k = JSON.stringify(v.prediction_label);
    const g = perLabel.get(k) ?? { n: 0, matched: 0, failed: 0 };
    g.n++;
    if (v.matched === true) g.matched++;
    else if (v.matched === false) g.failed++;
    perLabel.set(k, g);
  }

  const distinctKeys = new Set(reflections.map((r) => r.reflection_key));
  const exposed: ExposedEvidence = {
    generated_at: new Date().toISOString(),
    verdict_summary: {
      total: verdicts.length,
      matched: verdicts.filter((v) => v.matched === true).length,
      failed: verdicts.filter((v) => v.matched === false).length,
      unknown: verdicts.filter((v) => v.matched === null).length,
    },
    reflection_summary: {
      total: reflections.length,
      distinct_reflection_keys: distinctKeys.size,
    },
    cell_statistics: cellStats,
    calibration_bins: bins,
    per_label_performance: [...perLabel.entries()].map(([label, g]) => ({ label, n: g.n, matched: g.matched, failed: g.failed })),
    reflection_ids: reflections.map((r) => r.entry_id),
    verdict_ids: verdicts.map((v) => v.entry_id),
    evidence_kind: "OBSERVED",
  };

  recordHeartbeat({
    agent_id: "evidence_exposure",
    event_type: "expose",
    event_data: {
      verdicts: exposed.verdict_summary.total,
      reflections: exposed.reflection_summary.total,
      cells: exposed.cell_statistics.length,
    },
  });

  return exposed;
}

export const EVIDENCE_EXPOSURE_VERSION = "evidence-exposure.v1";
